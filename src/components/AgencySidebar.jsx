import { useMap } from 'react-leaflet'
import { useState } from 'react'

export default function AgencySidebar({ agencies }) {
  const map = useMap()
  const [open, setOpen] = useState(true)

  const loaded = agencies.filter(a => a.loaded)

  return (
    <div className={`agency-sidebar ${open ? 'open' : 'closed'}`}>
      <button className="sidebar-toggle" onClick={() => setOpen(!open)}>
        {open ? '◀' : '▶'}
      </button>
      {open && (
        <>
          <div className="sidebar-title">Agencies</div>
          {loaded.map(a => (
            <div
              key={a.id}
              className="agency-row"
              onClick={() => map.flyTo(a.center, a.zoom, { duration: 1.2 })}
            >
              <span className="agency-name">{a.name}</span>
              <span className="agency-city">{a.city}</span>
              {a.realtime && <span className="live-badge">live</span>}
            </div>
          ))}
        </>
      )}
    </div>
  )
}
