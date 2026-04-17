import { CircleMarker, Tooltip } from 'react-leaflet'

export default function StationMarker({ stop }) {
  return (
    <CircleMarker
      center={[stop.lat, stop.lng]}
      radius={3}
      pathOptions={{
        color: '#ccc',
        fillColor: '#fff',
        fillOpacity: 0.8,
        weight: 1,
      }}
    >
      <Tooltip direction="top" offset={[0, -4]}>{stop.name}</Tooltip>
    </CircleMarker>
  )
}
