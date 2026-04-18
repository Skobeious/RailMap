// GTFS URLs verified April 2026. Disabled agencies need key/registration or block scraping.
const AGENCIES = [

  // ── Amtrak ──────────────────────────────────────────────────────────────────
  {
    id: 'amtrak',
    name: 'Amtrak',
    city: 'National',
    gtfsUrl: 'https://content.amtrak.com/content/gtfs/GTFS.zip',
    gtfsRtUrl: null,
    routeTypes: [2],
    center: [39.5, -98.35],
    zoom: 5,
    perRouteColors: true, // GTFS uses single pale #CAE4F1 for all routes — generate distinct colours per route instead
  },

  // ── Subways / Heavy Rail ────────────────────────────────────────────────────
  {
    id: 'nyct-subway',
    name: 'NYC Subway',
    city: 'New York, NY',
    gtfsUrl: 'http://web.mta.info/developers/data/nyct/subway/google_transit.zip',
    gtfsRtUrl: null,
    routeTypes: [1],
    center: [40.712, -74.006],
    zoom: 12,
  },
  {
    id: 'cta',
    name: 'Chicago L',
    city: 'Chicago, IL',
    gtfsUrl: 'https://www.transitchicago.com/downloads/sch_data/google_transit.zip',
    gtfsRtUrl: null,
    routeTypes: [1],
    center: [41.878, -87.630],
    zoom: 12,
  },
  {
    id: 'bart',
    name: 'BART',
    city: 'San Francisco, CA',
    gtfsUrl: 'https://www.bart.gov/dev/schedules/google_transit.zip',
    gtfsRtUrl: null,
    routeTypes: [1, 2],
    center: [37.773, -122.418],
    zoom: 10,
  },
  {
    id: 'mbta-rapid',
    name: 'MBTA Subway',
    city: 'Boston, MA',
    gtfsUrl: 'https://cdn.mbta.com/MBTA_GTFS.zip',
    get gtfsRtUrl() { return process.env.MBTA_API_KEY ? `https://cdn.mbta.com/realtime/VehiclePositions.pb?api_key=${process.env.MBTA_API_KEY}` : null; },
    routeTypes: [0, 1],
    center: [42.361, -71.057],
    zoom: 12,
  },
  {
    id: 'septa',
    name: 'SEPTA Rail',
    city: 'Philadelphia, PA',
    gtfsUrl: 'https://github.com/septadev/GTFS/releases/latest/download/gtfs_public.zip',
    gtfsRtUrl: null,
    routeTypes: [0, 1, 2],
    center: [39.952, -75.165],
    zoom: 11,
  },

  // ── Light Rail / Trams ──────────────────────────────────────────────────────
  {
    id: 'lametro-rail',
    name: 'LA Metro Rail',
    city: 'Los Angeles, CA',
    gtfsUrl: 'https://gitlab.com/LACMTA/gtfs_rail/-/raw/master/gtfs_rail.zip',
    gtfsRtUrl: null, // GitHub pages URL gone — find new URL from developer.metro.net
    routeTypes: [0, 1, 2],
    center: [34.052, -118.244],
    zoom: 10,
  },
  {
    id: 'rtd',
    name: 'Denver RTD',
    city: 'Denver, CO',
    gtfsUrl: 'https://www.rtd-denver.com/files/gtfs/google_transit.zip',
    gtfsRtUrl: 'https://www.rtd-denver.com/api/download?feedType=gtfs-rt&filename=VehiclePosition.pb',
    routeTypes: [0, 2],
    center: [39.739, -104.990],
    zoom: 10,
  },
  {
    id: 'dart',
    name: 'DART Light Rail',
    city: 'Dallas, TX',
    gtfsUrl: 'https://www.dart.org/transitdata/latest/google_transit.zip',
    gtfsRtUrl: null,
    routeTypes: [0],
    center: [32.779, -96.800],
    zoom: 10,
  },
  {
    id: 'metro-transit',
    name: 'Metro Transit',
    city: 'Minneapolis, MN',
    gtfsUrl: 'https://svc.metrotransit.org/mtgtfs/gtfs.zip',
    gtfsRtUrl: null,
    routeTypes: [0, 1],
    allowedRouteIds: new Set(['901', '902', '903', '904']),
    center: [44.979, -93.265],
    zoom: 11,
  },
  {
    id: 'sound-transit',
    name: 'Sound Transit Link',
    city: 'Seattle, WA',
    gtfsUrl: 'https://www.soundtransit.org/GTFS-rail/40_gtfs.zip',
    gtfsRtUrl: null,
    routeTypes: [0, 2],
    center: [47.606, -122.332],
    zoom: 11,
  },

  // ── Canada ──────────────────────────────────────────────────────────────────
  {
    id: 'stm',
    name: 'STM Métro',
    city: 'Montréal, QC',
    gtfsUrl: 'https://www.stm.info/sites/default/files/gtfs/gtfs_stm.zip',
    gtfsRtUrl: null,
    routeTypes: [1],
    center: [45.508, -73.554],
    zoom: 12,
  },
  {
    id: 'ttc',
    name: 'TTC Subway',
    city: 'Toronto, ON',
    gtfsUrl: 'https://opendata.toronto.ca/toronto.transit.commission/ttc-routes-and-schedules/OpenData_TTC_Schedules.zip',
    gtfsRtUrl: null,
    routeTypes: [1],
    center: [43.653, -79.383],
    zoom: 12,
  },
  {
    id: 'go-transit',
    name: 'GO Transit',
    city: 'Toronto, ON',
    gtfsUrl: 'https://assets.metrolinx.com/raw/upload/Documents/Metrolinx/Open%20Data/GO-GTFS.zip',
    gtfsRtUrl: null,
    routeTypes: [2],
    center: [43.653, -79.383],
    zoom: 9,
  },
  {
    id: 'translink',
    name: 'TransLink SkyTrain',
    city: 'Vancouver, BC',
    get gtfsUrl() { return process.env.TRANSLINK_API_KEY ? `https://gtfs.translink.ca/v2/gtfs?apikey=${process.env.TRANSLINK_API_KEY}` : null; },
    gtfsRtUrl: null,
    routeTypes: [0, 1],
    allowedRouteIds: new Set(['099', '098', '097', '095', '096']),
    center: [49.246, -123.116],
    zoom: 11,
  },

  // ── Pending (403 / need API key / registration required) ─────────────────────
  // amtrak:       403 on direct download — needs browser session or registered key
  // wmata:        gtfs.wmata.com unreachable — needs developer.wmata.com API key
  // trimet:       developer.trimet.org unreachable — needs appID key
  // sfmuni:       gtfs.sfmta.com unreachable — try 511.org feed when key available
  // valley-metro: 403 on direct download
  // houston-metro: 404 — URL changed
  // metra:        403 on direct download
  // nj-transit:   needs developer registration
];

module.exports = AGENCIES;
