import { CircleMarker, Tooltip } from 'react-leaflet'

export default function TrainMarker({ vehicle }) {
  return (
    <CircleMarker
      center={[vehicle.lat, vehicle.lng]}
      radius={5}
      pathOptions={{
        color: '#fff',
        fillColor: vehicle.color,
        fillOpacity: 1,
        weight: 1.5,
      }}
    >
      <Tooltip>
        <strong>{vehicle.routeName}</strong>
        <br />
        {vehicle.agencyName}
      </Tooltip>
    </CircleMarker>
  )
}
