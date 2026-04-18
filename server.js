require('dotenv').config();
const express = require('express');
const path = require('path');
const compression = require('compression');
const AGENCIES = require('./lib/agencies');
const { loadAgency } = require('./lib/gtfsLoader');
const { buildShapeData, generateVehicles } = require('./lib/simulator');
const { fetchRealTimeVehicles } = require('./lib/gtfsRt');
const { fetchCustomRt } = require('./lib/customRt');

const CUSTOM_RT_IDS = new Set(['septa', 'metro-transit', 'sound-transit', 'nyct-subway', 'cta', 'amtrak', 'bart']);
const RT_AGENCIES = new Set(AGENCIES.filter(a => a.gtfsRtUrl).map(a => a.id));

const app = express();
const PORT = process.env.PORT || 3001;

app.use(compression());
app.use(express.static(path.join(__dirname, 'dist')));

let allFeatures = [];
let allStops = [];
let shapesData = [];
let loadedAgencies = [];
let isReady = false;
let rtActiveAgencies = new Set();

async function loadAllAgencies() {
  console.log(`Loading ${AGENCIES.length} agencies…`);
  const results = await Promise.allSettled(AGENCIES.map(a => loadAgency(a)));
  results.forEach((r, i) => {
    if (r.status === 'fulfilled' && r.value) {
      const d = r.value;
      allFeatures.push(...d.features);
      allStops.push(...d.stops);
      if (d.features.length) loadedAgencies.push(AGENCIES[i].id);
    } else {
      console.error(`✗ ${AGENCIES[i].name}: ${r.reason?.message}`);
    }
  });
  shapesData = buildShapeData(allFeatures);
  isReady = true;
  console.log(`Ready — ${allFeatures.length} shapes, ${allStops.length} stops across ${loadedAgencies.length} agencies`);
}

// ── API ──────────────────────────────────────────────────────────────────────

app.get('/api/status', (req, res) => {
  res.json({ ready: isReady, agencies: loadedAgencies.length, shapes: allFeatures.length });
});

app.get('/api/agencies', (req, res) => {
  res.json(AGENCIES.map(a => ({
    id: a.id,
    name: a.name,
    city: a.city,
    center: a.center,
    zoom: a.zoom,
    loaded: loadedAgencies.includes(a.id),
    realtime: rtActiveAgencies.has(a.id),
  })));
});

app.get('/api/shapes', (req, res) => {
  const { agency, bbox } = req.query;
  let features = allFeatures;
  if (agency) features = features.filter(f => f.properties.agencyId === agency);
  if (bbox) {
    const [w, s, e, n] = bbox.split(',').map(Number);
    features = features.filter(f =>
      f.geometry.coordinates.some(([lng, lat]) => lat >= s && lat <= n && lng >= w && lng <= e)
    );
  }
  res.json({ type: 'FeatureCollection', features });
});

app.get('/api/stops', (req, res) => {
  const { agency, bbox } = req.query;
  let stops = allStops;
  if (agency) stops = stops.filter(s => s.agencyId === agency);
  if (bbox) {
    const [w, s, e, n] = bbox.split(',').map(Number);
    stops = stops.filter(st => st.lat >= s && st.lat <= n && st.lng >= w && st.lng <= e);
  }
  res.json(stops);
});

app.get('/api/vehicles', async (req, res) => {
  const { agency, bbox } = req.query;

  // Fetch real-time: protobuf GTFS-RT feeds + custom JSON adapters
  const rtAgencies = AGENCIES.filter(a => RT_AGENCIES.has(a.id));
  const customAgencies = AGENCIES.filter(a => CUSTOM_RT_IDS.has(a.id));

  // Build stop lookup: "agencyId:stopId" -> {lat, lng}
  const stopsMap = new Map();
  allStops.forEach(s => stopsMap.set(`${s.agencyId}:${s.id}`, { lat: s.lat, lng: s.lng, name: s.name }));

  // Build Amtrak route slug -> routeId map for name matching
  const routeSlugMap = new Map();
  allFeatures.filter(f => f.properties.agencyId === 'amtrak').forEach(f => {
    const slug = f.properties.routeName.toLowerCase().replace(/[^a-z0-9]/g, '');
    routeSlugMap.set(slug, f.properties.routeId);
  });

  // Build BART hex color -> routeId map for ETD API matching
  const bartColorMap = new Map();
  allFeatures.filter(f => f.properties.agencyId === 'bart').forEach(f => {
    if (f.properties.color) bartColorMap.set(f.properties.color.toLowerCase(), f.properties.routeId);
  });

  const [rtResults, customResults] = await Promise.all([
    Promise.allSettled(rtAgencies.map(a => fetchRealTimeVehicles(a))),
    Promise.allSettled(customAgencies.map(a => fetchCustomRt(a, stopsMap, routeSlugMap, bartColorMap))),
  ]);

  const rtVehiclesByAgency = new Map();
  rtResults.forEach((r, i) => {
    if (r.status === 'fulfilled' && r.value?.length)
      rtVehiclesByAgency.set(rtAgencies[i].id, r.value);
  });
  customResults.forEach((r, i) => {
    if (r.status === 'fulfilled' && r.value?.length)
      rtVehiclesByAgency.set(customAgencies[i].id, r.value);
  });

  // Track which agencies are actively returning RT data (used by /api/agencies live badge)
  rtActiveAgencies = new Set(rtVehiclesByAgency.keys());

  // Simulated: only shapes for non-RT agencies (or RT agencies where fetch failed)
  const simShapes = shapesData.filter(s => !rtVehiclesByAgency.has(s.properties.agencyId));
  const simVehicles = generateVehicles(simShapes);

  // Merge, tagging sim vehicles explicitly
  const simTagged = simVehicles.map(v => ({ ...v, realtime: false }));
  const rtVehicles = [...rtVehiclesByAgency.values()].flat();

  // Apply colour from shapes data for RT vehicles (GTFS-RT doesn't include it)
  const routeColorMap = new Map();
  allFeatures.forEach(f => {
    routeColorMap.set(`${f.properties.agencyId}:${f.properties.routeId}`, f.properties.color);
  });
  // Filter to rail routes only — drops buses that share the same RT feed
  // Amtrak uses a fallback routeId so exempt it from the strict filter
  const railRtVehicles = rtVehicles.filter(v =>
    v.agencyId === 'amtrak' || routeColorMap.has(`${v.agencyId}:${v.routeId}`)
  );
  railRtVehicles.forEach(v => {
    v.color = routeColorMap.get(`${v.agencyId}:${v.routeId}`);
  });

  let vehicles = [...railRtVehicles, ...simTagged];
  if (agency) vehicles = vehicles.filter(v => v.agencyId === agency);
  if (bbox) {
    const [w, s, e, n] = bbox.split(',').map(Number);
    vehicles = vehicles.filter(v => v.lat >= s && v.lat <= n && v.lng >= w && v.lng <= e);
  }
  res.json(vehicles);
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Start server immediately, load data in background
app.listen(PORT, () => console.log(`RailMap on :${PORT}`));
loadAllAgencies().catch(console.error);
