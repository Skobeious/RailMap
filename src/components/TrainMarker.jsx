import { CircleMarker, Tooltip } from 'react-leaflet'

export default function TrainMarker({ vehicle }) {
  const isLive = vehicle.realtime
  return (
    <CircleMarker
      center={[vehicle.lat, vehicle.lng]}
      radius={isLive ? 9 : 7}
      pathOptions={{
        color: isLive ? '#fff' : 'rgba(255,255,255,0.4)',
        fillColor: vehicle.color || '#888',
        fillOpacity: isLive ? 1 : 0.65,
        weight: isLive ? 2 : 1,
      }}
    >
      <Tooltip>
        <strong>{vehicle.routeName || vehicle.routeId}</strong>
        <br />
        {vehicle.agencyName}
        <br />
        <span style={{ opacity: 0.7, fontSize: '0.7em' }}>
          {isLive ? '● live' : '◌ simulated'}
        </span>
      </Tooltip>
    </CircleMarker>
  )
}
