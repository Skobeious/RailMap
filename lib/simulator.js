// Simulates vehicle positions along GTFS shapes using wall-clock time.
// Each shape gets TRAINS_PER_SHAPE trains evenly distributed along it,
// advancing at TRAIN_SPEED m/s continuously.

const TRAIN_SPEED = 13.4; // ~30mph in m/s — realistic urban rail average
const TRAINS_PER_SHAPE = 2;

function haversine(a, b) {
  const R = 6371000;
  const dLat = (b[1] - a[1]) * Math.PI / 180;
  const dLon = (b[0] - a[0]) * Math.PI / 180;
  const lat1 = a[1] * Math.PI / 180;
  const lat2 = b[1] * Math.PI / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

function buildShapeData(features) {
  return features
    .filter(f => f.geometry.coordinates.length >= 2)
    .map(f => {
      const coords = f.geometry.coordinates;
      const cumDist = [0];
      for (let i = 1; i < coords.length; i++) {
        cumDist.push(cumDist[i - 1] + haversine(coords[i - 1], coords[i]));
      }
      return { ...f, cumDist, totalLength: cumDist[cumDist.length - 1] };
    })
    .filter(s => s.totalLength > 100); // discard malformed shapes
}

function interpolate(coords, cumDist, totalLength, progress) {
  const target = Math.max(0, Math.min(1, progress)) * totalLength;
  let lo = 0, hi = cumDist.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (cumDist[mid] < target) lo = mid; else hi = mid;
  }
  const seg = cumDist[lo + 1] - cumDist[lo];
  const t = seg > 0 ? (target - cumDist[lo]) / seg : 0;
  return [
    coords[lo][0] + t * (coords[lo + 1][0] - coords[lo][0]),
    coords[lo][1] + t * (coords[lo + 1][1] - coords[lo][1]),
  ];
}

function heading(coords, cumDist, totalLength, progress) {
  const target = Math.max(0, Math.min(0.9999, progress)) * totalLength;
  let i = 0;
  while (i < cumDist.length - 2 && cumDist[i + 1] < target) i++;
  const dx = coords[i + 1][0] - coords[i][0];
  const dy = coords[i + 1][1] - coords[i][1];
  return Math.atan2(dx, dy) * 180 / Math.PI;
}

function generateVehicles(shapesData) {
  const now = Date.now() / 1000;
  const vehicles = [];

  for (const shape of shapesData) {
    const travelTime = shape.totalLength / TRAIN_SPEED;
    for (let i = 0; i < TRAINS_PER_SHAPE; i++) {
      const offset = (i / TRAINS_PER_SHAPE) * travelTime;
      const progress = ((now + offset) % travelTime) / travelTime;
      const [lng, lat] = interpolate(
        shape.geometry.coordinates, shape.cumDist, shape.totalLength, progress
      );
      vehicles.push({
        id: `${shape.properties.shapeId}-${i}`,
        lat,
        lng,
        heading: heading(shape.geometry.coordinates, shape.cumDist, shape.totalLength, progress),
        color: shape.properties.color,
        routeName: shape.properties.routeName,
        agencyId: shape.properties.agencyId,
        agencyName: shape.properties.agencyName,
      });
    }
  }

  return vehicles;
}

module.exports = { buildShapeData, generateVehicles };
