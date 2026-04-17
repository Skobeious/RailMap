const https = require('https');
const http = require('http');
const { transit_realtime } = require('gtfs-realtime-bindings');

const RT_TIMEOUT = 15000;
const RT_CACHE_TTL = 20000; // 20s

const cache = new Map(); // agencyId -> { vehicles, fetchedAt }

function fetchBuffer(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) return reject(new Error('Too many redirects'));
    const protocol = url.startsWith('https') ? https : http;
    const chunks = [];
    const req = protocol.get(url, { timeout: RT_TIMEOUT }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        let next = res.headers.location;
        if (!next.startsWith('http')) next = new URL(next, url).href;
        res.resume();
        return fetchBuffer(next, redirects + 1).then(resolve).catch(reject);
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
    req.on('timeout', () => { req.destroy(); reject(new Error('RT fetch timeout')); });
  });
}

async function fetchRealTimeVehicles(agency) {
  if (!agency.gtfsRtUrl) return null;

  const cached = cache.get(agency.id);
  if (cached && Date.now() - cached.fetchedAt < RT_CACHE_TTL) {
    return cached.vehicles;
  }

  let buf;
  try {
    buf = await fetchBuffer(agency.gtfsRtUrl);
  } catch (err) {
    console.warn(`[${agency.id}] RT fetch failed: ${err.message}`);
    return null;
  }

  let feed;
  try {
    feed = transit_realtime.FeedMessage.decode(buf);
  } catch (err) {
    console.warn(`[${agency.id}] RT decode failed: ${err.message}`);
    return null;
  }

  const vehicles = [];
  for (const entity of feed.entity) {
    const vp = entity.vehicle;
    if (!vp?.position || !vp.trip) continue;

    const { latitude: lat, longitude: lng, bearing } = vp.position;
    if (!lat || !lng) continue;

    vehicles.push({
      id: `rt-${agency.id}-${entity.id}`,
      lat,
      lng,
      heading: bearing ?? 0,
      routeId: vp.trip.routeId || '',
      agencyId: agency.id,
      agencyName: agency.name,
      realtime: true,
    });
  }

  cache.set(agency.id, { vehicles, fetchedAt: Date.now() });
  return vehicles;
}

module.exports = { fetchRealTimeVehicles };
