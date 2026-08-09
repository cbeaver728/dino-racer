import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { loadRoster } from '../game/storage'
import { COURSE, DEMO_DINO, type Terrain } from './raceTypes'
import { COURSES, toRaceProfile } from './course'
import type { ChaseTarget } from './Racers'
import { estimateRaceTime, evaluateTerrain } from './raceSimulation'
import {
  MAX_RACERS,
  PLACE_LABEL,
  PLACE_MEDAL,
  createRacers,
  standingsOf,
  type RacerState,
} from './raceEngine'
import { RaceWorld } from './RaceWorld'
import { Racers } from './Racers'
import './raceWorld.css'

type Phase = 'setup' | 'countdown' | 'racing' | 'finished'

export default function RaceWorldApp() {
  const [roster] = useState(loadRoster)
  const [selected, setSelected] = useState<string[]>(
    () => roster.slice(0, MAX_RACERS).map((entry) => entry.id),
  )

  const [phase, setPhase] = useState<Phase>('setup')
  const [raceKey, setRaceKey] = useState(0)
  const [countdown, setCountdown] = useState(3)
  const [standings, setStandings] = useState<RacerState[]>([])
  const [finishers, setFinishers] = useState<RacerState[]>([])
  const [podiumOpen, setPodiumOpen] = useState(false)
  const [showInfo, setShowInfo] = useState(false)
  const [selectedTerrain, setSelectedTerrain] = useState<Terrain>('Marsh')
  const [courseIndex, setCourseIndex] = useState(0)

  /**
   * Camera: free orbit, locked to the leader, or riding behind one racer. Held
   * as the racer's id so it survives the field being rebuilt between races.
   */
  const [cameraMode, setCameraMode] = useState<'free' | 'leader' | string>('leader')

  const racers = useRef<RacerState[]>([])
  const podiumShown = useRef(false)
  const leader = useRef(new THREE.Vector3())
  const chase = useRef<ChaseTarget>({ position: new THREE.Vector3(), heading: 0, active: false })

  const course = COURSES[courseIndex]
  const racing = phase === 'racing'
  const started = phase !== 'setup'
  const chasing = cameraMode !== 'free' && cameraMode !== 'leader'

  const toggle = (id: string) => setSelected((current) => {
    if (current.includes(id)) return current.filter((entry) => entry !== id)
    if (current.length >= MAX_RACERS) return current
    return [...current, id]
  })

  /** free → leader → behind each racer in turn → back to free. */
  const cycleCamera = () => setCameraMode((current) => {
    const order = ['free', 'leader', ...racers.current.map((racer) => racer.id)]
    const at = order.indexOf(current)
    return order[(at + 1) % order.length]
  })
  const chasedName = racers.current.find((racer) => racer.id === cameraMode)?.name

  const startRace = () => {
    const entries = roster.filter((entry) => selected.includes(entry.id)).slice(0, MAX_RACERS)
    if (!entries.length) return
    racers.current = createRacers(entries, course)
    podiumShown.current = false
    setStandings(standingsOf(racers.current))
    setFinishers([])
    setPodiumOpen(false)
    setRaceKey((key) => key + 1)
    setCountdown(3)
    setPhase('countdown')
  }

  const resetRace = () => {
    racers.current = []
    podiumShown.current = false
    setStandings([])
    setFinishers([])
    setPodiumOpen(false)
    setPhase('setup')
    setRaceKey((key) => key + 1)
  }

  useEffect(() => {
    if (phase !== 'countdown') return
    if (countdown <= 0) {
      setPhase('racing')
      return
    }
    const timer = setTimeout(() => setCountdown((value) => value - 1), 800)
    return () => clearTimeout(timer)
  }, [phase, countdown])

  const handleFinish = useCallback((racer: RacerState) => {
    setFinishers((current) => {
      if (current.some((entry) => entry.id === racer.id)) return current
      racer.place = current.length + 1
      const next = [...current, racer]
      if (next.length >= racers.current.length) setPhase('finished')
      return next
    })
    // Open on the first finisher only; later arrivals join the card in place
    // rather than popping it back over a player who dismissed it.
    if (!podiumShown.current) {
      podiumShown.current = true
      setPodiumOpen(true)
    }
  }, [])

  const handleSample = useCallback(() => {
    setStandings(standingsOf(racers.current))
  }, [])

  const reportProfile = useMemo(() => {
    const first = roster.find((entry) => entry.id === selected[0])
    return first ? toRaceProfile(first.config) : DEMO_DINO
  }, [roster, selected])
  const result = useMemo(() => evaluateTerrain(reportProfile, selectedTerrain), [reportProfile, selectedTerrain])
  const estimatedTime = useMemo(() => estimateRaceTime(reportProfile), [reportProfile])
  const section = COURSE.find((item) => item.terrain === selectedTerrain)

  return <main className="race-app">
    <div className="race-world">
      <RaceWorld
        key={course.def.id}
        course={course}
        follow={cameraMode === 'leader' && racing ? leader.current : null}
        chase={chasing && started ? chase.current : null}
      >
        {started && <Racers
          key={raceKey}
          racers={racers.current}
          course={course}
          running={racing}
          onFinish={handleFinish}
          onSample={handleSample}
          leaderOut={leader.current}
          chaseId={chasing ? cameraMode : null}
          chaseOut={chase.current}
        />}
      </RaceWorld>
    </div>

    <header className="race-header">
      <a href="./" aria-label="Return to Dino Lab">🧪 DINO LAB</a>
      <div><p>DINOSAUR RACING GROUNDS</p><h1>{course.def.name.toUpperCase()}</h1></div>
      <a href="./run.html" aria-label="Play Star Dash">🌟</a>
    </header>

    <button className="course-info-toggle" type="button" aria-expanded={showInfo} onClick={() => setShowInfo((current) => !current)}>
      {showInfo ? '✕ Hide course info' : 'ⓘ Course info'}
    </button>

    {showInfo && <><aside className="race-map" aria-label="Race course terrain">
      <div className="race-map-title"><span>🗺️</span><div><strong>THE ADVENTURE LOOP</strong><small>A continuous circuit through four wild biomes.</small></div></div>
      <div className="terrain-list">{COURSE.map((item, index) => <button key={item.terrain} className={selectedTerrain === item.terrain ? 'active' : ''} onClick={() => setSelectedTerrain(item.terrain)}>
        <b>{index + 1}</b><span>{item.icon}</span><div><strong>{item.terrain}</strong><small>{item.distance}% of race</small></div><i style={{ background: item.color }} />
      </button>)}</div>
    </aside>
    <section className="race-report">
      <div className="report-top"><span>{section?.icon}</span><div><small>TERRAIN REPORT</small><h2>{selectedTerrain}</h2></div><strong className={result.pace >= 1 ? 'boost' : 'slow'}>{Math.round(result.pace * 100)}% PACE</strong></div>
      <p>{section?.description}</p><div className="terrain-bar"><i style={{ width: `${Math.min(100, result.pace * 65)}%` }} /></div>
      <div className="report-note"><span>{result.pace >= 1 ? '✨' : '⚠️'}</span><div><strong>{result.note}</strong><small>{result.strengths.length ? result.strengths.join(' • ') : result.challenges.join(' • ')}</small></div></div>
      <div className="demo-chip"><span>ESTIMATE</span><b>{roster.find((entry) => entry.id === selected[0])?.config.name ?? 'Demo dino'}</b><em>Full lap: about {estimatedTime.toFixed(0)} seconds</em></div>
    </section></>}

    {!started && <aside className="racer-picker" aria-label="Choose your racers">
      <div className="picker-head">
        <span>🗺️</span>
        <div><strong>CHOOSE A TRACK</strong><small>{course.def.blurb}</small></div>
      </div>
      <div className="track-picker">{COURSES.map((option, index) => <button
        key={option.def.id}
        type="button"
        className={index === courseIndex ? 'chosen' : ''}
        aria-pressed={index === courseIndex}
        onClick={() => setCourseIndex(index)}
      >
        <span>{option.def.icon}</span>
        <strong>{option.def.name}</strong>
        <small>{option.mix.map((entry) => `${entry.terrain} ${entry.share}%`).join(' · ')}</small>
      </button>)}</div>

      <div className="picker-head">
        <span>🦖</span>
        <div><strong>PICK YOUR RACERS</strong><small>{roster.length ? `Up to ${MAX_RACERS} · ${selected.length} chosen` : 'Nothing in the stable yet'}</small></div>
      </div>
      {roster.length === 0
        ? <p className="picker-empty">Build a dinosaur first, then come back and race it.<a href="./">🧪 Open Dino Lab</a></p>
        : <ul className="picker-list">{roster.map((entry) => {
          const chosen = selected.includes(entry.id)
          const full = !chosen && selected.length >= MAX_RACERS
          return <li key={entry.id}>
            <button
              type="button"
              className={chosen ? 'chosen' : ''}
              disabled={full}
              aria-pressed={chosen}
              onClick={() => toggle(entry.id)}
            >
              <i style={{ background: entry.config.color }} />
              <div>
                <strong>{entry.config.name}</strong>
                <small>{entry.config.head} · {entry.config.hindLegs.toLowerCase()} legs · {entry.config.feet.toLowerCase()}</small>
              </div>
              <b>{chosen ? '✓' : '+'}</b>
            </button>
          </li>
        })}</ul>}
      <button
        className="mobile-race-go"
        type="button"
        disabled={selected.length === 0}
        onClick={startRace}
      >🏁 START RACE</button>
    </aside>}

    {started && standings.length > 0 && <aside className="leaderboard" aria-label="Race standings">
      <div className="leaderboard-head"><span>🏁</span><strong>{phase === 'finished' ? 'FINAL RESULTS' : 'RACE ORDER'}</strong></div>
      <ol>{standings.map((racer, index) => <li key={racer.id} className={racer.place ? 'done' : ''}>
        <b>{racer.place ? PLACE_MEDAL[racer.place - 1] : index + 1}</b>
        <i style={{ background: racer.config.color }} />
        <div>
          <strong>{racer.name}{racer.effect === 'boost' ? ' ⭐' : racer.effect === 'reverse' ? ' 🌪️' : ''}</strong>
          <small className={racer.effect ?? undefined}>
            {racer.place ? `Finished ${PLACE_LABEL[racer.place - 1]}`
              : racer.effect === 'boost' ? 'Star boost!'
                : racer.effect === 'reverse' ? 'Spun around!'
                  : racer.terrain}
          </small>
        </div>
        <em>{Math.round(Math.min(1, racer.progress) * 100)}%</em>
      </li>)}</ol>
    </aside>}

    {phase === 'countdown' && <div className="countdown" role="status" aria-live="assertive">
      <span key={countdown}>{countdown > 0 ? countdown : 'GO!'}</span>
    </div>}

    <div className="race-controls">
      {!started && <button
        className="race-go"
        type="button"
        disabled={selected.length === 0}
        onClick={startRace}
      >🏁 START RACE</button>}
      {started && <button className="race-reset" type="button" onClick={resetRace}>↻ NEW RACE</button>}
      {started && <button
        className={`race-follow${cameraMode === 'free' ? '' : ' on'}`}
        type="button"
        onClick={cycleCamera}
      >🎥 {cameraMode === 'free' ? 'Free camera'
        : cameraMode === 'leader' ? 'Following leader'
          : `Behind ${chasedName ?? 'racer'}`}</button>}
      {finishers.length > 0 && !podiumOpen && <button className="race-results" type="button" onClick={() => setPodiumOpen(true)}>🏆 RESULTS</button>}
    </div>

    {podiumOpen && finishers.length > 0 && <div className="podium-backdrop" role="dialog" aria-modal="true" aria-label="Race results">
      <div className="podium">
        <button className="podium-close" type="button" aria-label="Close results" onClick={() => setPodiumOpen(false)}>✕</button>
        <b className="podium-confetti">🎉🏆🎊</b>
        <h2>{finishers[0].name} won 1st place!</h2>
        <ol className="podium-list">{finishers.map((racer) => <li key={racer.id}>
          <span>{PLACE_MEDAL[(racer.place ?? 1) - 1]}</span>
          <i style={{ background: racer.config.color }} />
          <div><strong>{racer.name}</strong><small>{PLACE_LABEL[(racer.place ?? 1) - 1]} place</small></div>
          <em>{racer.finishedAt?.toFixed(1)}s</em>
        </li>)}</ol>
        {phase !== 'finished' && <p className="podium-waiting">Still running… finishers will appear here.</p>}
        <button className="podium-again" type="button" onClick={() => { setPodiumOpen(false); resetRace() }}>↻ RACE AGAIN</button>
      </div>
    </div>}

    <section className="world-controls" aria-label="World camera instructions">
      <span>◉</span>
      <div><strong>EXPLORE THE CIRCUIT</strong><small>Drag to rotate · scroll or pinch to zoom · right-drag to move</small></div>
    </section>
  </main>
}
