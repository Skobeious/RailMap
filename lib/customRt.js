// Adapters for non-protobuf real-time feeds (JSON REST APIs)
const https = require('https');
const http = require('http');

const CACHE_TTL = 20000;
const cache = new Map();

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const chunks = [];
    const req = protocol.get(url, { timeout: 15000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        let next = res.headers.location;
        if (!next.startsWith('http')) next = new URL(next, url).href;
        res.resume();
        return fetchJson(next).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error(`HTTP ${res.statusCode}`)); }
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString())); }
        catch (e) { reject(new Error('JSON parse failed')); }
      });
      res.on('error', reject);
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

// ── SEPTA Regional Rail ───────────────────────────────────────────────────────
// Maps SEPTA line names to GTFS route IDs in the SEPTA GTFS feed
const SEPTA_LINE_MAP = {
  'Airport': 'AIR',
  'Chestnut Hill East': 'CHE',
  'Chestnut Hill West': 'CHW',
  'Cynwyd': 'CYN',
  'Fox Chase': 'FOX',
  'Lansdale/Doylestown': 'LAN',
  'Media/Wawa': 'MED',
  'Manayunk/Norristown': 'NOR',
  'Paoli/Thorndale': 'PAO',
  'Trenton': 'TRE',
  'Warminster': 'WAR',
  'West Trenton': 'WTR',
  'Wilmington/Newark': 'WIL',
  'Elwyn': 'ELW',
};

async function fetchSepta(agency) {
  const cached = cache.get(agency.id);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) return cached.vehicles;

  let data;
  try { data = await fetchJson('https://www3.septa.org/api/TrainView/index.php'); }
  catch (e) { console.warn('[septa] RT failed:', e.message); return null; }

  const vehicles = data
    .filter(t => t.lat && t.lon)
    .map(t => ({
      id: `rt-septa-${t.trainno}`,
      lat: parseFloat(t.lat),
      lng: parseFloat(t.lon),
      heading: parseFloat(t.heading) || 0,
      routeId: SEPTA_LINE_MAP[t.line] || t.line,
      agencyId: agency.id,
      agencyName: agency.name,
      routeName: t.line,
      realtime: true,
    }));

  cache.set(agency.id, { vehicles, fetchedAt: Date.now() });
  return vehicles;
}

// ── Metro Transit Minneapolis ─────────────────────────────────────────────────
// Light Rail route IDs: 901=Blue, 902=Green, 903=Orange, 904=Red
const MT_RAIL_ROUTES = new Set(['901', '902', '903', '904']);

async function fetchMetroTransit(agency) {
  const cached = cache.get(agency.id);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) return cached.vehicles;

  let data;
  try { data = await fetchJson('https://svc.metrotransit.org/nextrip/vehicles'); }
  catch (e) { console.warn('[metro-transit] RT failed:', e.message); return null; }

  const vehicles = data
    .filter(v => v.latitude && v.longitude && MT_RAIL_ROUTES.has(String(v.route_id)))
    .map(v => ({
      id: `rt-mt-${v.trip_id}`,
      lat: v.latitude,
      lng: v.longitude,
      heading: v.bearing || 0,
      routeId: String(v.route_id),
      agencyId: agency.id,
      agencyName: agency.name,
      realtime: true,
    }));

  cache.set(agency.id, { vehicles, fetchedAt: Date.now() });
  return vehicles;
}

// ── Sound Transit via OneBusAway ──────────────────────────────────────────────
// OBA agency ID 40 = Sound Transit. Accepts key=TEST (open API).
// Route IDs embedded in tripId: 100479 = 1 Line, 2LINE, TLINE
const ST_ROUTE_IDS = ['100479', '2LINE', 'TLINE', 'SNDR_TL'];

function parseSTRoute(tripId) {
  for (const id of ST_ROUTE_IDS) {
    if (tripId && tripId.includes(id)) return id;
  }
  return null;
}

async function fetchSoundTransit(agency) {
  const cached = cache.get(agency.id);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) return cached.vehicles;

  const obaKey = process.env.OBA_API_KEY || 'TEST';
  let data;
  try {
    data = await fetchJson(
      `https://api.pugetsound.onebusaway.org/api/where/vehicles-for-agency/40.json?key=${obaKey}`
    );
  } catch (e) { console.warn('[sound-transit] RT failed:', e.message); return null; }

  const list = data?.data?.list || [];
  const vehicles = list
    .filter(v => v.location?.lat && v.location?.lon)
    .map(v => {
      const routeId = parseSTRoute(v.tripId || v.tripStatus?.activeTripId || '');
      if (!routeId) return null;
      return {
        id: `rt-st-${v.vehicleId}`,
        lat: v.location.lat,
        lng: v.location.lon,
        heading: v.tripStatus?.orientation || 0,
        routeId,
        agencyId: agency.id,
        agencyName: agency.name,
        realtime: true,
      };
    })
    .filter(Boolean);

  cache.set(agency.id, { vehicles, fetchedAt: Date.now() });
  return vehicles;
}

// ── Chicago CTA L ─────────────────────────────────────────────────────────────
// Train Tracker API: one request per line, returns real GPS + heading.
// CTA route codes map to GTFS route_ids in the CTA GTFS feed.
const CTA_LINES = ['red','blue','brn','g','org','p','pink','y'];
const CTA_ROUTE_MAP = { red:'Red', blue:'Blue', brn:'Brn', g:'G', org:'Org', p:'P', pink:'Pink', y:'Y' };

async function fetchCTA(agency) {
  const cached = cache.get(agency.id);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) return cached.vehicles;

  const key = process.env.CTA_API_KEY;
  if (!key) return null;

  const results = await Promise.allSettled(
    CTA_LINES.map(line =>
      fetchJson(`https://lapi.transitchicago.com/api/1.0/ttpositions.aspx?key=${key}&rt=${line}&outputType=JSON`)
    )
  );

  const vehicles = [];
  results.forEach((r, i) => {
    if (r.status !== 'fulfilled') return;
    const trains = r.value?.ctatt?.route?.[0]?.train || [];
    const routeId = CTA_ROUTE_MAP[CTA_LINES[i]];
    trains.forEach(t => {
      if (!t.lat || !t.lon) return;
      vehicles.push({
        id: `rt-cta-${t.rn}`,
        lat: parseFloat(t.lat),
        lng: parseFloat(t.lon),
        heading: parseFloat(t.heading) || 0,
        routeId,
        agencyId: agency.id,
        agencyName: agency.name,
        realtime: true,
      });
    });
  });

  cache.set(agency.id, { vehicles, fetchedAt: Date.now() });
  return vehicles;
}

// ── NYC MTA Subway ────────────────────────────────────────────────────────────
// No GPS — vehicle positions come from stop_id (which stop the train is at/approaching).
// We look up lat/lon from the stops map built from GTFS static data.
const MTA_FEEDS = [
  'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs',
  'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-ace',
  'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-bdfm',
  'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-g',
  'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-jz',
  'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-l',
  'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-nqrw',
  'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-si',
];

function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const req = https.get(url, { timeout: 12000 }, res => {
      if (res.statusCode !== 200) { res.resume(); return reject(new Error(`HTTP ${res.statusCode}`)); }
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function toSec(t) {
  if (!t) return null;
  if (typeof t === 'number') return t;
  if (typeof t.toNumber === 'function') return t.toNumber();
  if (typeof t.low === 'number') return t.low;
  return Number(t);
}

async function fetchNYCSubway(agency, stopsMap) {
  const cached = cache.get(agency.id);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) return cached.vehicles;

  const { transit_realtime } = require('gtfs-realtime-bindings');

  const results = await Promise.allSettled(MTA_FEEDS.map(fetchBuffer));

  // Decode all feeds once
  const feeds = [];
  for (const r of results) {
    if (r.status !== 'fulfilled') continue;
    try { feeds.push(transit_realtime.FeedMessage.decode(r.value)); }
    catch (e) { continue; }
  }

  // First pass: build trip stop schedules from TripUpdate entities
  // NYCT feeds include both past (actual) and future (estimated) stop times
  const tripStops = new Map(); // tripId -> [{stopId, time}]
  for (const feed of feeds) {
    for (const entity of feed.entity) {
      const tu = entity.tripUpdate;
      if (!tu?.trip?.tripId || !tu.stopTimeUpdate?.length) continue;
      const stops = tu.stopTimeUpdate.map(stu => ({
        stopId: stu.stopId?.replace(/[NS]$/, ''),
        time: toSec(stu.departure?.time) || toSec(stu.arrival?.time),
      }));
      tripStops.set(tu.trip.tripId, stops);
    }
  }

  // Second pass: vehicle positions, interpolated between stations when in transit
  const vehicles = [];
  for (const feed of feeds) {
    for (const entity of feed.entity) {
      const vp = entity.vehicle;
      if (!vp?.trip?.routeId || !vp.stopId) continue;

      const currentStopId = vp.stopId.replace(/[NS]$/, '');
      const currentPos = stopsMap.get(`nyct-subway:${currentStopId}`)
                      || stopsMap.get(`nyct-subway:${vp.stopId}`);
      if (!currentPos) continue;

      let lat = currentPos.lat;
      let lng = currentPos.lng;

      // STOPPED_AT = 1; for INCOMING_AT (0) or IN_TRANSIT_TO (2), interpolate
      const stopped = vp.currentStatus === 1;
      if (!stopped) {
        const schedule = tripStops.get(vp.trip.tripId);
        if (schedule) {
          const idx = schedule.findIndex(s => s.stopId === currentStopId);
          if (idx > 0) {
            const prev = schedule[idx - 1];
            const curr = schedule[idx];
            const prevPos = stopsMap.get(`nyct-subway:${prev.stopId}`);
            if (prevPos && prev.time && curr.time) {
              const now = Date.now() / 1000;
              const t = Math.max(0, Math.min(1, (now - prev.time) / (curr.time - prev.time)));
              lat = prevPos.lat + (currentPos.lat - prevPos.lat) * t;
              lng = prevPos.lng + (currentPos.lng - prevPos.lng) * t;
            } else if (prevPos) {
              lat = (prevPos.lat + currentPos.lat) / 2;
              lng = (prevPos.lng + currentPos.lng) / 2;
            }
          }
        }
      }

      vehicles.push({
        id: `rt-nyct-${entity.id}`,
        lat,
        lng,
        heading: null,
        stopName: currentPos.name || null,
        routeId: vp.trip.routeId,
        agencyId: agency.id,
        agencyName: agency.name,
        realtime: true,
      });
    }
  }

  cache.set(agency.id, { vehicles, fetchedAt: Date.now() });
  return vehicles;
}

// ── Amtrak (via Amtraker API) ─────────────────────────────────────────────────
// Free unofficial API at api.amtraker.com — real GPS + routeName, no key needed.
// Maps routeName to GTFS routeId via normalised slug comparison.
function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function fetchAmtrak(agency, routeSlugMap) {
  const cached = cache.get(agency.id);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) return cached.vehicles;

  let data;
  try { data = await fetchJson('https://api.amtraker.com/v3/trains'); }
  catch (e) { console.warn('[amtrak] RT failed:', e.message); return null; }

  const trains = Object.values(data).flat();
  const vehicles = trains
    .filter(t => t.lat && t.lon && t.trainState === 'Active')
    .map(t => {
      const slug = slugify(t.routeName || '');
      const routeId = routeSlugMap.get(slug);
      return {
        id: `rt-amtrak-${t.trainID}`,
        lat: t.lat,
        lng: t.lon,
        heading: typeof t.heading === 'string'
          ? { N:0,NE:45,E:90,SE:135,S:180,SW:225,W:270,NW:315 }[t.heading] ?? 0
          : t.heading || 0,
        routeId: routeId || 'amtrak',
        routeName: t.routeName,
        agencyId: agency.id,
        agencyName: agency.name,
        realtime: true,
      };
    });

  cache.set(agency.id, { vehicles, fetchedAt: Date.now() });
  return vehicles;
}

// ── BART ──────────────────────────────────────────────────────────────────────
// ETD API: trains placed at the station they're about to depart (≤2 min).
// hex color from ETD matches route color in GTFS shapes — used to resolve routeId.
async function fetchBART(agency, stopsMap, bartColorMap) {
  const cached = cache.get(agency.id);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) return cached.vehicles;

  const key = process.env.BART_API_KEY;
  if (!key) return null;

  let data;
  try {
    data = await fetchJson(`https://api.bart.gov/api/etd.aspx?cmd=etd&orig=ALL&key=${key}&json=y`);
  } catch (e) { console.warn('[bart] RT failed:', e.message); return null; }

  const stations = data?.root?.station || [];
  const vehicles = [];
  const seen = new Set();

  stations.forEach(station => {
    const pos = stopsMap.get(`bart:${station.abbr}`);
    if (!pos) return;

    (station.etd || []).forEach(route => {
      (route.estimate || []).forEach((est, idx) => {
        const mins = est.minutes === 'Leaving' ? 0 : parseInt(est.minutes);
        if (isNaN(mins) || mins > 2) return;

        const vId = `rt-bart-${station.abbr}-${route.abbreviation}-${idx}`;
        if (seen.has(vId)) return;
        seen.add(vId);

        const hexColor = est.hexcolor?.toLowerCase();
        const routeId = bartColorMap?.get(hexColor) || est.color;

        vehicles.push({
          id: vId,
          lat: pos.lat,
          lng: pos.lng,
          heading: null,
          stopName: pos.name || null,
          routeId,
          agencyId: agency.id,
          agencyName: agency.name,
          realtime: true,
        });
      });
    });
  });

  cache.set(agency.id, { vehicles, fetchedAt: Date.now() });
  return vehicles;
}

// ── Dispatcher ────────────────────────────────────────────────────────────────
async function fetchCustomRt(agency, stopsMap, routeSlugMap, bartColorMap) {
  switch (agency.id) {
    case 'septa':         return fetchSepta(agency);
    case 'metro-transit': return fetchMetroTransit(agency);
    case 'sound-transit': return fetchSoundTransit(agency);
    case 'nyct-subway':   return fetchNYCSubway(agency, stopsMap || new Map());
    case 'cta':           return fetchCTA(agency);
    case 'amtrak':        return fetchAmtrak(agency, routeSlugMap || new Map());
    case 'bart':          return fetchBART(agency, stopsMap || new Map(), bartColorMap || new Map());
    default: return null;
  }
}

module.exports = { fetchCustomRt };
