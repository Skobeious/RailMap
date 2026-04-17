import { CircleMarker, Tooltip } from 'react-leaflet'

export default function TrainMarker({ vehicle, zoom }) {
  const isLive = vehicle.realtime
  const showLabel = zoom >= 14
  const label = vehicle.routeName || vehicle.routeId || ''

  return (
    <CircleMarker
      center={[vehicle.lat, vehicle.lng]}
      radius={isLive ? 5 : 4}
      pathOptions={{
        color: isLive ? '#fff' : 'rgba(255,255,255,0.4)',
        fillColor: vehicle.color || '#888',
        fillOpacity: isLive ? 1 : 0.65,
        weight: isLive ? 2 : 1,
      }}
    >
      <Tooltip permanent={showLabel} direction="top" offset={[0, -6]}>
        {showLabel ? (
          <span style={{ fontWeight: 600, fontSize: '0.72rem' }}>{label}</span>
        ) : (
          <>
            <strong>{label}</strong>
            <br />
            {vehicle.agencyName}
            <br />
            <span style={{ opacity: 0.7, fontSize: '0.7em' }}>
              {isLive ? '● live' : '◌ simulated'}
            </span>
          </>
        )}
      </Tooltip>
    </CircleMarker>
  )
}
