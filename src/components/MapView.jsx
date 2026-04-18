import { MapContainer, TileLayer, GeoJSON, useMap, useMapEvents } from 'react-leaflet'
import { useState, useEffect, useCallback, useRef } from 'react'
import TrainMarker from './TrainMarker'
import StationMarker from './StationMarker'
import AgencySidebar from './AgencySidebar'

const USA_CENTER = [39.5, -98.35]
const STATION_ZOOM_THRESHOLD = 11

function routeStyle(feature) {
  return {
    color: feature.properties.color || '#888',
    weight: 2.5,
    opacity: 0.85,
  }
}

const POLL_MS = 10000

// Smoothly interpolates vehicle positions between API updates so live trains
// (especially NYC subway which jumps stop-to-stop) appear to move continuously.
function useAnimatedVehicles(rawVehicles) {
  const [displayed, setDisplayed] = useState([])
  const prevById = useRef({})
  const rafRef = useRef(null)
  const startRef = useRef(0)
  const targetRef = useRef([])

  useEffect(() => {
    if (!rawVehicles.length) return

    targetRef.current = rawVehicles
    startRef.current = performance.now()
    const prev = prevById.current

    if (rafRef.current) clearInterval(rafRef.current)

    function tick() {
      const t = Math.min((performance.now() - startRef.current) / POLL_MS, 1)
      setDisplayed(targetRef.current.map(v => {
        const p = prev[v.id]
        if (!p || t >= 1) return v
        return {
          ...v,
          lat: p.lat + (v.lat - p.lat) * t,
          lng: p.lng + (v.lng - p.lng) * t,
        }
      }))
      if (t >= 1) clearInterval(rafRef.current)
    }

    tick()
    rafRef.current = setInterval(tick, 200)

    // Update prev positions for next interpolation cycle
    const next = {}
    rawVehicles.forEach(v => { next[v.id] = { lat: v.lat, lng: v.lng } })
    prevById.current = next

    return () => { if (rafRef.current) clearInterval(rafRef.current) }
  }, [rawVehicles])

  return displayed
}

function VehicleLayer() {
  const [raw, setRaw] = useState([])
  const [zoom, setZoom] = useState(5)
  const map = useMap()

  const fetch_ = useCallback(() => {
    const bounds = map.getBounds()
    const bbox = `${bounds.getWest()},${bounds.getSouth()},${bounds.getEast()},${bounds.getNorth()}`
    fetch(`/api/vehicles?bbox=${bbox}`)
      .then(r => r.json())
      .then(setRaw)
      .catch(console.error)
  }, [map])

  useEffect(() => {
    fetch_()
    const t = setInterval(fetch_, POLL_MS)
    return () => clearInterval(t)
  }, [fetch_])

  useMapEvents({
    moveend: fetch_,
    zoomend: () => { setZoom(map.getZoom()); fetch_() },
  })

  const vehicles = useAnimatedVehicles(raw)
  return vehicles.map(v => <TrainMarker key={v.id} vehicle={v} zoom={zoom} />)
}

function StationLayer() {
  const [stops, setStops] = useState([])
  const map = useMap()

  const load = useCallback(() => {
    if (map.getZoom() < STATION_ZOOM_THRESHOLD) { setStops([]); return; }
    const bounds = map.getBounds()
    const bbox = `${bounds.getWest()},${bounds.getSouth()},${bounds.getEast()},${bounds.getNorth()}`
    fetch(`/api/stops?bbox=${bbox}`)
      .then(r => r.json())
      .then(setStops)
      .catch(console.error)
  }, [map])

  useMapEvents({ zoomend: load, moveend: load })
  useEffect(load, [load])

  return stops.map(s => <StationMarker key={`${s.agencyId}-${s.id}`} stop={s} />)
}

export default function MapView({ shapes, agencies }) {
  return (
    <MapContainer
      center={USA_CENTER}
      zoom={5}
      minZoom={3}
      maxZoom={16}
      style={{ height: '100vh', width: '100vw' }}
      zoomControl={true}
    >
      <TileLayer
        url="https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://stadiamaps.com/">Stadia Maps</a> &copy; <a href="https://www.openstreetmap.org/">OSM</a>'
        maxZoom={20}
      />
      {shapes && shapes.features?.length > 0 && (
        <GeoJSON
          key={shapes.features.length}
          data={shapes}
          style={routeStyle}
        />
      )}
      <StationLayer />
      <VehicleLayer />
      <AgencySidebar agencies={agencies || []} />
    </MapContainer>
  )
}
