import { useMemo, useState } from 'react'
import { COURSE, DEMO_DINO, TERRAIN_ORDER, type Terrain } from './raceTypes'
import { estimateRaceTime, evaluateTerrain } from './raceSimulation'
import { RaceWorld, type BalloonMove } from './RaceWorld'
import './raceWorld.css'

const initialMove: BalloonMove = { x: 0, z: 0, nonce: 0 }

export default function RaceWorldApp() {
  const [selectedTerrain, setSelectedTerrain] = useState<Terrain>('Marsh')
  const [move, setMove] = useState(initialMove)
  const result = useMemo(() => evaluateTerrain(DEMO_DINO, selectedTerrain), [selectedTerrain])
  const estimatedTime = useMemo(() => estimateRaceTime(DEMO_DINO), [])
  const fly = (x: number, z: number) => setMove((current) => ({ x, z, nonce: current.nonce + 1 }))

  return <main className="race-app">
    <div className="race-world"><RaceWorld move={move} /></div>
    <header className="race-header"><a href="./" aria-label="Return to Dino Lab">🧪 DINO LAB</a><div><p>HOT AIR BALLOON VIEW</p><h1>RACE WORLD</h1></div><span>🎈</span></header>
    <aside className="race-map" aria-label="Race course terrain">
      <div className="race-map-title"><span>🗺️</span><div><strong>THE ADVENTURE LOOP</strong><small>Each landscape tests a different dino skill.</small></div></div>
      <div className="terrain-list">{COURSE.map((section, index) => <button key={section.terrain} className={selectedTerrain === section.terrain ? 'active' : ''} onClick={() => setSelectedTerrain(section.terrain)}>
        <b>{index + 1}</b><span>{section.icon}</span><div><strong>{section.terrain}</strong><small>{section.distance}% of race</small></div><i style={{ background: section.color }} />
      </button>)}</div>
    </aside>
    <section className="race-report">
      <div className="report-top"><span>{COURSE.find((section) => section.terrain === selectedTerrain)?.icon}</span><div><small>TERRAIN REPORT</small><h2>{selectedTerrain}</h2></div><strong className={result.pace >= 1 ? 'boost' : 'slow'}>{Math.round(result.pace * 100)}% PACE</strong></div>
      <p>{COURSE.find((section) => section.terrain === selectedTerrain)?.description}</p>
      <div className="terrain-bar"><i style={{ width: `${Math.min(100, result.pace * 65)}%` }} /></div>
      <div className="report-note"><span>{result.pace >= 1 ? '✨' : '⚠️'}</span><div><strong>{result.note}</strong><small>{result.strengths.length ? result.strengths.join(' • ') : result.challenges.join(' • ')}</small></div></div>
      <div className="demo-chip"><span>DEMO DINO</span><b>Medium · normal legs · clawed feet</b><em>Estimated full lap: {estimatedTime.toFixed(0)} seconds</em></div>
    </section>
    <section className="balloon-controls" aria-label="Balloon controls"><div><span>🎈</span><div><strong>FLY THE BALLOON</strong><small>Drag the world, pinch/scroll to zoom, or use these buttons.</small></div></div><div className="fly-pad"><button aria-label="Fly forward" onClick={() => fly(0, 3)}>▲</button><button aria-label="Fly left" onClick={() => fly(-3, 0)}>◀</button><button aria-label="Fly back" onClick={() => fly(0, -3)}>▼</button><button aria-label="Fly right" onClick={() => fly(3, 0)}>▶</button></div></section>
    <div className="race-legend"><span>🌱 World foundation ready</span><span>🏁 Race logic ready</span><span>🦖 Dinosaur models plug in next</span></div>
  </main>
}
