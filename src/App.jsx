import { useEffect, useState } from 'react'
import MapView from './components/MapView'
import Header from './components/Header'

export default function App() {
  const [shapes, setShapes] = useState(null)
  const [agencies, setAgencies] = useState([])
  const [status, setStatus] = useState({ ready: false, agencies: 0, shapes: 0 })
  const [mode, setMode] = useState('seattle')

  useEffect(() => {
    const load = () => {
      Promise.all([
        fetch('/api/shapes').then(r => r.json()),
        fetch('/api/agencies').then(r => r.json()),
        fetch('/api/status').then(r => r.json()),
      ]).then(([shapesData, agenciesData, statusData]) => {
        setShapes(shapesData)
        setAgencies(agenciesData)
        setStatus(statusData)
      }).catch(console.error)
    }

    load()

    const poll = setInterval(() => {
      fetch('/api/status').then(r => r.json()).then(s => {
        setStatus(s)
        if (s.ready) {
          clearInterval(poll)
          fetch('/api/shapes').then(r => r.json()).then(setShapes)
        }
      })
    }, 5000)

    return () => clearInterval(poll)
  }, [])

  return (
    <>
      <Header mode={mode} onMode={setMode} />
      <MapView shapes={shapes} agencies={agencies} mode={mode} />
      {!status.ready && (
        <div className="loading-bar">
          Loading transit data… {status.agencies} agencies, {status.shapes} shapes loaded
        </div>
      )}
    </>
  )
}
