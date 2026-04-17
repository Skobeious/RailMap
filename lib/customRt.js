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

async function fetchNYCSubway(agency, stopsMap) {
  const cached = cache.get(agency.id);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) return cached.vehicles;

  const { transit_realtime } = require('gtfs-realtime-bindings');

  const results = await Promise.allSettled(MTA_FEEDS.map(fetchBuffer));
  const vehicles = [];
  let feedIdx = 0;

  for (const result of results) {
    feedIdx++;
    if (result.status !== 'fulfilled') continue;
    let feed;
    try { feed = transit_realtime.FeedMessage.decode(result.value); }
    catch (e) { continue; }

    for (const entity of feed.entity) {
      const vp = entity.vehicle;
      if (!vp?.trip?.routeId || !vp.stopId) continue;

      // Look up the stop position from our GTFS static stops
      const stopKey = `nyct-subway:${vp.stopId.replace(/[NS]$/, '')}`;
      const pos = stopsMap.get(stopKey) || stopsMap.get(`nyct-subway:${vp.stopId}`);
      if (!pos) continue;

      vehicles.push({
        id: `rt-nyct-${entity.id}`,
        lat: pos.lat,
        lng: pos.lng,
        heading: 0,
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

// ── Dispatcher ────────────────────────────────────────────────────────────────
async function fetchCustomRt(agency, stopsMap) {
  switch (agency.id) {
    case 'septa':         return fetchSepta(agency);
    case 'metro-transit': return fetchMetroTransit(agency);
    case 'sound-transit': return fetchSoundTransit(agency);
    case 'nyct-subway':   return fetchNYCSubway(agency, stopsMap || new Map());
    default: return null;
  }
}

module.exports = { fetchCustomRt };
