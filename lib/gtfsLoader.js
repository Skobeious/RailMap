const AdmZip = require('adm-zip');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
const DOWNLOAD_TIMEOUT = 45000; // 45s per agency

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function cachePath(agencyId) {
  return path.join(DATA_DIR, `${agencyId}.json`);
}

function isCacheFresh(agencyId) {
  const p = cachePath(agencyId);
  if (!fs.existsSync(p)) return false;
  return Date.now() - fs.statSync(p).mtimeMs < CACHE_TTL;
}

function downloadZip(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) return reject(new Error('Too many redirects'));
    const protocol = url.startsWith('https') ? https : http;
    const chunks = [];
    const options = { timeout: DOWNLOAD_TIMEOUT, headers: { 'User-Agent': 'RailMap/1.0 (transit data aggregator)' } };
    const req = protocol.get(url, options, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        let next = res.headers.location;
        if (!next.startsWith('http')) next = new URL(next, url).href;
        res.resume();
        return downloadZip(next, redirects + 1).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Download timeout')); });
  });
}

function parseCSV(text) {
  const lines = text.split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].replace(/\r/g, '').split(',').map(h => h.replace(/"/g, '').trim());
  const result = [];
  for (let li = 1; li < lines.length; li++) {
    const line = lines[li].replace(/\r/g, '');
    if (!line.trim()) continue;
    const values = [];
    let cur = '', inQ = false;
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ; }
      else if (ch === ',' && !inQ) { values.push(cur); cur = ''; }
      else { cur += ch; }
    }
    values.push(cur);
    const obj = {};
    headers.forEach((h, i) => { obj[h] = (values[i] || '').trim(); });
    result.push(obj);
  }
  return result;
}

// Ramer-Douglas-Peucker simplification
function perpDist(point, lineStart, lineEnd) {
  const dx = lineEnd[0] - lineStart[0];
  const dy = lineEnd[1] - lineStart[1];
  if (dx === 0 && dy === 0) {
    return Math.hypot(point[0] - lineStart[0], point[1] - lineStart[1]);
  }
  return Math.abs(dy * point[0] - dx * point[1] + lineEnd[0] * lineStart[1] - lineEnd[1] * lineStart[0])
    / Math.hypot(dx, dy);
}

function rdp(points, epsilon) {
  if (points.length <= 2) return points;
  let maxDist = 0, maxIdx = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const d = perpDist(points[i], points[0], points[points.length - 1]);
    if (d > maxDist) { maxDist = d; maxIdx = i; }
  }
  if (maxDist > epsilon) {
    const left = rdp(points.slice(0, maxIdx + 1), epsilon);
    const right = rdp(points.slice(maxIdx), epsilon);
    return [...left.slice(0, -1), ...right];
  }
  return [points[0], points[points.length - 1]];
}

async function loadAgency(agency) {
  ensureDataDir();

  if (isCacheFresh(agency.id)) {
    console.log(`[${agency.id}] cache hit`);
    return JSON.parse(fs.readFileSync(cachePath(agency.id)));
  }

  console.log(`[${agency.id}] downloading…`);
  let buffer;
  try {
    buffer = await downloadZip(agency.gtfsUrl);
  } catch (err) {
    console.error(`[${agency.id}] download failed: ${err.message}`);
    return { agencyId: agency.id, agencyName: agency.name, features: [], stops: [] };
  }

  let zip;
  try {
    zip = new AdmZip(buffer);
  } catch (err) {
    console.error(`[${agency.id}] zip parse failed: ${err.message}`);
    return { agencyId: agency.id, agencyName: agency.name, features: [], stops: [] };
  }

  const getText = (name) => {
    const e = zip.getEntry(name);
    return e ? zip.readAsText(e) : '';
  };

  const routeTypes = agency.routeTypes;

  // Parse routes — keep only rail types
  const allRoutes = parseCSV(getText('routes.txt'));
  const routeMap = {};
  allRoutes.forEach(r => {
    if (routeTypes.includes(parseInt(r.route_type || '3'))) {
      routeMap[r.route_id] = r;
    }
  });

  if (!Object.keys(routeMap).length) {
    console.warn(`[${agency.id}] no matching route types found`);
    return { agencyId: agency.id, agencyName: agency.name, features: [], stops: [] };
  }

  // Parse trips — map shape_id -> route_id (one shape per route, deduplicated)
  const trips = parseCSV(getText('trips.txt'));
  const shapeToRoute = {};
  trips.forEach(t => {
    if (routeMap[t.route_id] && t.shape_id && !shapeToRoute[t.shape_id]) {
      shapeToRoute[t.shape_id] = t.route_id;
    }
  });

  // Parse shapes.txt — group by shape_id, only for rail shapes
  const rawShapes = parseCSV(getText('shapes.txt'));
  const shapePoints = {};
  rawShapes.forEach(s => {
    if (!shapeToRoute[s.shape_id]) return;
    if (!shapePoints[s.shape_id]) shapePoints[s.shape_id] = [];
    shapePoints[s.shape_id].push([
      parseFloat(s.shape_pt_lon),
      parseFloat(s.shape_pt_lat),
      parseInt(s.shape_pt_sequence || '0'),
    ]);
  });

  // Build GeoJSON features
  const epsilon = 0.0001; // ~11m tolerance for RDP
  const features = [];
  Object.entries(shapePoints).forEach(([shapeId, pts]) => {
    const routeId = shapeToRoute[shapeId];
    const route = routeMap[routeId];
    pts.sort((a, b) => a[2] - b[2]);
    const coords = pts.map(p => [p[0], p[1]]);
    const simplified = rdp(coords, epsilon);
    features.push({
      type: 'Feature',
      properties: {
        shapeId,
        routeId,
        routeName: route.route_short_name || route.route_long_name || routeId,
        color: agency.overrideColor || (route.route_color ? '#' + route.route_color : '#888888'),
        agencyId: agency.id,
        agencyName: agency.name,
      },
      geometry: { type: 'LineString', coordinates: simplified },
    });
  });

  // Parse stops — prefer location_type=1 (parent stations).
  // Fall back to all stops only if <20 stations found (some feeds don't use location_type).
  // Cap at 1500 to avoid flooding the API with bus stops from mixed feeds.
  const allStops = parseCSV(getText('stops.txt'));
  const valid = allStops.filter(s => s.stop_lat && s.stop_lon && parseFloat(s.stop_lat) !== 0);
  const stations = valid.filter(s => s.location_type === '1');
  const stopSource = stations.length >= 20 ? stations : valid;
  const stops = stopSource
    .slice(0, 1500)
    .map(s => ({
      id: s.stop_id,
      name: s.stop_name || '',
      lat: parseFloat(s.stop_lat),
      lng: parseFloat(s.stop_lon),
      agencyId: agency.id,
    }));

  const data = { agencyId: agency.id, agencyName: agency.name, features, stops };
  fs.writeFileSync(cachePath(agency.id), JSON.stringify(data));
  console.log(`[${agency.id}] ✓ ${features.length} shapes, ${stops.length} stops`);
  return data;
}

module.exports = { loadAgency };
