const ST_LINES = [
  { name: '1 Line', color: '#28813F' },
  { name: '2 Line', color: '#007CAD' },
  { name: 'T Line', color: '#F38B00' },
]

export default function Header({ mode, onMode }) {
  return (
    <header className="app-header">
      <div className="header-brand">soundtransit.co</div>

      <div className="header-tabs">
        <button
          className={`tab-btn ${mode === 'seattle' ? 'active' : ''}`}
          onClick={() => onMode('seattle')}
        >
          {mode === 'seattle' && (
            <span className="line-dots">
              {ST_LINES.map(l => (
                <span key={l.name} className="line-dot" style={{ background: l.color }} title={l.name} />
              ))}
            </span>
          )}
          Seattle
        </button>
        <button
          className={`tab-btn ${mode === 'usa' ? 'active' : ''}`}
          onClick={() => onMode('usa')}
        >
          USA Rail
        </button>
      </div>

      <div className="header-disclaimer">Unofficial fan project</div>
    </header>
  )
}
