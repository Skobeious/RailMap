import { Marker, Popup, Tooltip } from 'react-leaflet'
import L from 'leaflet'

function createTrainIcon(color, heading, isLive) {
  const c = color || '#888888'
  const hasDir = heading !== null && heading !== undefined && !isNaN(heading)
  const opacity = isLive ? 1 : 0.65
  const stroke = isLive ? 'white' : 'rgba(255,255,255,0.4)'
  const strokeW = isLive ? 1.5 : 1

  const fin = hasDir
    ? `<polygon points="0,-9 2.5,-5 -2.5,-5" fill="white" opacity="0.9"/>`
    : ''

  const svg = `<svg width="18" height="18" viewBox="-9 -9 18 18" xmlns="http://www.w3.org/2000/svg">
    ${fin}
    <circle r="5" fill="${c}" stroke="${stroke}" stroke-width="${strokeW}" opacity="${opacity}"/>
  </svg>`

  return L.divIcon({
    html: `<div style="transform:rotate(${heading || 0}deg);width:18px;height:18px">${svg}</div>`,
    className: '',
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -10],
  })
}

export default function TrainMarker({ vehicle, zoom }) {
  const isLive = vehicle.realtime
  const icon = createTrainIcon(vehicle.color, vehicle.heading, isLive)
  const showLabel = zoom >= 14
  const label = vehicle.routeName || vehicle.routeId || ''

  return (
    <Marker position={[vehicle.lat, vehicle.lng]} icon={icon}>
      <Popup>
        <div style={{ minWidth: 140, fontSize: '0.78rem', lineHeight: 1.6 }}>
          <div style={{ fontWeight: 700, fontSize: '0.88rem', marginBottom: 4 }}>
            <span style={{
              display: 'inline-block', width: 10, height: 10, borderRadius: '50%',
              background: vehicle.color || '#888', marginRight: 6, verticalAlign: 'middle'
            }} />
            {label}
          </div>
          <div style={{ color: '#aaa' }}>{vehicle.agencyName}</div>
          {vehicle.stopName && (
            <div style={{ marginTop: 4, color: '#ccc' }}>
              📍 {vehicle.stopName}
            </div>
          )}
          <div style={{ marginTop: 4 }}>
            <span style={{
              fontSize: '0.65rem', padding: '1px 5px', borderRadius: 3,
              background: isLive ? 'rgba(0,200,100,0.2)' : 'rgba(255,255,255,0.1)',
              color: isLive ? '#4dbb7a' : '#888',
              border: `1px solid ${isLive ? 'rgba(0,200,100,0.3)' : 'rgba(255,255,255,0.1)'}`,
            }}>
              {isLive ? '● live' : '◌ simulated'}
            </span>
          </div>
        </div>
      </Popup>
      {showLabel && (
        <Tooltip permanent direction="top" offset={[0, -10]}>
          <span style={{ fontWeight: 600, fontSize: '0.72rem' }}>{label}</span>
        </Tooltip>
      )}
    </Marker>
  )
}
