import { MapContainer, TileLayer, GeoJSON, useMap, useMapEvents } from 'react-leaflet'
import { useState, useEffect, useCallback, useRef } from 'react'
import TrainMarker from './TrainMarker'
import StationMarker from './StationMarker'

const USA_CENTER = [39.5, -98.35]
const STATION_ZOOM_THRESHOLD = 11

function routeStyle(feature) {
  return {
    color: feature.properties.color || '#888',
    weight: 2.5,
    opacity: 0.85,
  }
}

function VehicleLayer() {
  const [vehicles, setVehicles] = useState([])
  const map = useMap()

  const fetch_ = useCallback(() => {
    const bounds = map.getBounds()
    const bbox = `${bounds.getWest()},${bounds.getSouth()},${bounds.getEast()},${bounds.getNorth()}`
    fetch(`/api/vehicles?bbox=${bbox}`)
      .then(r => r.json())
      .then(setVehicles)
      .catch(console.error)
  }, [map])

  useEffect(() => {
    fetch_()
    const t = setInterval(fetch_, 10000)
    return () => clearInterval(t)
  }, [fetch_])

  useMapEvents({ moveend: fetch_, zoomend: fetch_ })

  return vehicles.map(v => <TrainMarker key={v.id} vehicle={v} />)
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

export default function MapView({ shapes }) {
  const shapesRef = useRef(null)

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
    </MapContainer>
  )
}
