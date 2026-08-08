import { useMemo, useState } from 'react'
import { COURSE, DEMO_DINO, type Terrain } from './raceTypes'
import { estimateRaceTime, evaluateTerrain } from './raceSimulation'
import { RaceWorld } from './RaceWorld'
import './raceWorld.css'

export default function RaceWorldApp() {
  const [selectedTerrain, setSelectedTerrain] = useState<Terrain>('Marsh')
  const result = useMemo(() => evaluateTerrain(DEMO_DINO, selectedTerrain), [selectedTerrain])
  const estimatedTime = useMemo(() => estimateRaceTime(DEMO_DINO), [])
  const section = COURSE.find((item) => item.terrain === selectedTerrain)

  return <main className="race-app">
    <div className="race-world"><RaceWorld /></div>
    <header className="race-header"><a href="./" aria-label="Return to Dino Lab">🧪 DINO LAB</a><div><p>DINOSAUR RACING GROUNDS</p><h1>THE WILD CIRCUIT</h1></div><span>🏁</span></header>
    <aside className="race-map" aria-label="Race course terrain">
      <div className="race-map-title"><span>🗺️</span><div><strong>THE ADVENTURE LOOP</strong><small>A continuous circuit through four wild biomes.</small></div></div>
      <div className="terrain-list">{COURSE.map((item, index) => <button key={item.terrain} className={selectedTerrain === item.terrain ? 'active' : ''} onClick={() => setSelectedTerrain(item.terrain)}>
        <b>{index + 1}</b><span>{item.icon}</span><div><strong>{item.terrain}</strong><small>{item.distance}% of race</small></div><i style={{ background: item.color }} />
      </button>)}</div>
    </aside>
    <section className="race-report">
      <div className="report-top"><span>{section?.icon}</span><div><small>TERRAIN REPORT</small><h2>{selectedTerrain}</h2></div><strong className={result.pace >= 1 ? 'boost' : 'slow'}>{Math.round(result.pace * 100)}% PACE</strong></div>
      <p>{section?.description}</p><div className="terrain-bar"><i style={{ width: `${Math.min(100, result.pace * 65)}%` }} /></div>
      <div className="report-note"><span>{result.pace >= 1 ? '✨' : '⚠️'}</span><div><strong>{result.note}</strong><small>{result.strengths.length ? result.strengths.join(' • ') : result.challenges.join(' • ')}</small></div></div>
      <div className="demo-chip"><span>DEMO DINO</span><b>Medium · normal legs · clawed feet</b><em>Estimated full lap: {estimatedTime.toFixed(0)} seconds</em></div>
    </section>
    <section className="world-controls" aria-label="World camera instructions"><span>◉</span><div><strong>EXPLORE THE CIRCUIT</strong><small>Drag to rotate · scroll or pinch to zoom · right-drag to move</small></div></section>
    <div className="race-legend"><span>🌲 Clear forest route</span><span>⛰️ Raised mountain pass</span><span>🏁 Race-ready circuit</span></div>
  </main>
}
