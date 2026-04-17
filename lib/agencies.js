// GTFS URLs verified April 2026. Disabled agencies need key/registration or block scraping.
const AGENCIES = [

  // ── Amtrak ──────────────────────────────────────────────────────────────────
  {
    id: 'amtrak',
    name: 'Amtrak',
    city: 'National',
    gtfsUrl: 'https://content.amtrak.com/content/gtfs/GTFS.zip',
    gtfsRtUrl: null, // Azure blob URL dead — rrgtfsrt.blob.core.windows.net resolves to nothing
    routeTypes: [2],
    center: [39.5, -98.35],
    zoom: 5,
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
    gtfsRtUrl: null,
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
    routeTypes: [0],
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
