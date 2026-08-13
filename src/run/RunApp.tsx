import { useCallback, useEffect, useRef, useState } from 'react'
import { loadRoster } from '../game/storage'
import { playStar, playTimeUp, playTornado, unlock } from '../game/sound'
import { SoundToggle } from '../components/SoundToggle'
import { RunWorld } from './RunWorld'
import { LANES, LANE_GLIDE, RUN_SECONDS } from './runEngine'
import './run.css'

type Phase = 'pick' | 'running' | 'crashed' | 'timeup'

export default function RunApp() {
  const [roster] = useState(loadRoster)
  const [chosen, setChosen] = useState(0)
  const [phase, setPhase] = useState<Phase>('pick')
  const [score, setScore] = useState(0)
  const [remaining, setRemaining] = useState(RUN_SECONDS)
  const [gameKey, setGameKey] = useState(0)
  const [lane, setLane] = useState(1)

  // The dinosaur's real x, glided toward the chosen lane. Held in a ref so
  // steering never costs a React render mid-run.
  const playerX = useRef(0)
  const targetLane = useRef(1)

  const config = roster[chosen]?.config
  const running = phase === 'running'

  const steer = useCallback((direction: -1 | 1) => {
    setLane((current) => {
      const next = Math.min(LANES.length - 1, Math.max(0, current + direction))
      targetLane.current = next
      return next
    })
  }, [])

  const start = () => {
    // Every route into a run passes through here, so this is the reliable place
    // to let the audio context start on a real gesture.
    unlock()
    playerX.current = LANES[1]
    targetLane.current = 1
    setLane(1)
    setScore(0)
    setRemaining(RUN_SECONDS)
    setGameKey((key) => key + 1)
    setPhase('running')
  }

  const backToPick = () => {
    setPhase('pick')
    setGameKey((key) => key + 1)
  }

  // Glide toward the chosen lane, independent of the render loop.
  useEffect(() => {
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      const delta = Math.min((now - last) / 1000, 0.05)
      last = now
      const goal = LANES[targetLane.current]
      playerX.current += (goal - playerX.current) * Math.min(1, LANE_GLIDE * delta)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  // Countdown to the end of the run. The updater only counts; ending the run is
  // its own effect rather than a side effect inside a state update.
  useEffect(() => {
    if (!running) return
    const timer = setInterval(() => setRemaining((value) => Math.max(0, value - 1)), 1000)
    return () => clearInterval(timer)
  }, [running])

  useEffect(() => {
    if (running && remaining === 0) {
      playTimeUp()
      setPhase('timeup')
    }
  }, [running, remaining])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft' || event.key === 'a') { steer(-1); event.preventDefault() }
      if (event.key === 'ArrowRight' || event.key === 'd') { steer(1); event.preventDefault() }
      if (event.key === ' ' && phase !== 'running') { start(); event.preventDefault() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const onStar = useCallback(() => { playStar(); setScore((value) => value + 1) }, [])
  const onTornado = useCallback(() => { playTornado(); setPhase('crashed') }, [])

  if (!config) {
    return <main className="run-app">
      <div className="run-empty">
        <h1>🌟 STAR DASH</h1>
        <p>Build a dinosaur in the lab first, then come back and run!</p>
        <a className="run-link" href="./">🧪 Open Dino Lab</a>
      </div>
    </main>
  }

  return <main className="run-app">
    <div className="run-world">
      <RunWorld
        key={gameKey}
        config={config}
        playerX={playerX}
        running={running}
        onStar={onStar}
        onTornado={onTornado}
      />
    </div>

    <header className="run-header">
      <a href="./" aria-label="Back to Dino Lab">🧪</a>
      <div className="run-score"><span>⭐</span><strong>{score}</strong></div>
      <div className={`run-timer${remaining <= 10 && running ? ' low' : ''}`}><span>⏱</span><strong>{remaining}</strong></div>
      <SoundToggle />
    </header>

    {phase === 'pick' && <div className="run-card-backdrop">
      <div className="run-card">
        <b className="run-card-emoji">🌟</b>
        <h1>STAR DASH</h1>
        <p className="run-how">Catch the stars. Dodge the tornadoes!</p>
        <div className="run-picker">
          {roster.map((entry, index) => <button
            key={entry.id}
            type="button"
            className={index === chosen ? 'chosen' : ''}
            aria-pressed={index === chosen}
            onClick={() => setChosen(index)}
          >
            <i style={{ background: entry.config.color }} />
            <strong>{entry.config.name}</strong>
          </button>)}
        </div>
        <button className="run-play" type="button" onClick={start}>▶ START RUNNING</button>
      </div>
    </div>}

    {(phase === 'crashed' || phase === 'timeup') && <div className="run-card-backdrop">
      <div className="run-card">
        <b className="run-card-emoji">{phase === 'crashed' ? '🌪️' : '🎉'}</b>
        <h1>{phase === 'crashed' ? 'Spun out!' : 'Time is up!'}</h1>
        <p className="run-final"><strong>{config.name}</strong> collected</p>
        <div className="run-final-score"><span>⭐</span><b>{score}</b></div>
        <button className="run-play" type="button" onClick={start}>↻ RUN AGAIN</button>
        <button className="run-secondary" type="button" onClick={backToPick}>🦖 Pick another dinosaur</button>
        <a className="run-link" href="./">🧪 Back to Dino Lab</a>
      </div>
    </div>}

    {running && <div className="run-controls">
      <button
        type="button"
        aria-label="Move left"
        disabled={lane === 0}
        onPointerDown={(event) => { event.preventDefault(); steer(-1) }}
      >◀</button>
      <button
        type="button"
        aria-label="Move right"
        disabled={lane === LANES.length - 1}
        onPointerDown={(event) => { event.preventDefault(); steer(1) }}
      >▶</button>
    </div>}
  </main>
}
