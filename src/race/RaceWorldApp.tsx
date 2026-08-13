import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { loadRoster } from '../game/storage'
import { fillWithRivals } from '../game/rivals'
import { playCountBeep, playFinish, playGo, playTap, unlock } from '../game/sound'
import { SoundToggle } from '../components/SoundToggle'
import { COURSE, DEMO_DINO, LAP_COUNT, type Terrain } from './raceTypes'
import { COURSES, toRaceProfile } from './course'
import type { ChaseTarget } from './Racers'
import { estimateRaceTime, evaluateTerrain } from './raceSimulation'
import { usePlayerSteering, type SteerDirection } from './steering'
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
type Mode = 'watch' | 'drive'

/** Racers a grid is topped up to with rivals. Lively without being a crowd. */
const GRID_TARGET = 4

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
  const [mode, setMode] = useState<Mode>(roster.length ? 'drive' : 'watch')
  const [useRivals, setUseRivals] = useState(true)
  const [driver, setDriver] = useState<string | null>(null)
  /** Full standings, or just your own row. Collapsed while driving so the
   * steering pads and the track are not competing with a list. */
  const [standingsOpen, setStandingsOpen] = useState(true)

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

  // Derived rather than synced, so deselecting the dinosaur you were going to
  // drive quietly falls back to another one instead of leaving a dead id.
  const driverId = driver && selected.includes(driver) ? driver : selected[0] ?? null
  const driving = mode === 'drive' && driverId !== null
  const steering = usePlayerSteering(racing && driving)

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
    // The first real gesture of the session, and the only moment a browser will
    // let the audio context start.
    unlock()
    const chosen = roster.filter((entry) => selected.includes(entry.id)).slice(0, MAX_RACERS)
    const field = useRivals
      ? fillWithRivals(chosen, Math.min(MAX_RACERS, Math.max(chosen.length, GRID_TARGET)))
      : chosen
    if (!field.length) return

    racers.current = createRacers(field, course, driving ? driverId : null)
    podiumShown.current = false
    setStandings(standingsOf(racers.current))
    setFinishers([])
    setPodiumOpen(false)
    setRaceKey((key) => key + 1)
    setCountdown(3)
    setPhase('countdown')
    // Driving needs the screen for the track and the pads; watching wants the
    // whole field. Open the standings only when there is room for them.
    setStandingsOpen(!driving)
    // You cannot steer from a map view, so driving takes the chase camera.
    if (driving && driverId) setCameraMode(driverId)
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

  useEffect(() => {
    if (phase !== 'countdown') return
    if (countdown > 0) playCountBeep()
    else playGo()
  }, [phase, countdown])

  const handleFinish = useCallback((racer: RacerState) => {
    // Read before the podium flag moves: the first dinosaur across the line is
    // the one that won, and that decides which fanfare plays.
    const won = !podiumShown.current
    const anyDriven = racers.current.some((entry) => entry.driven)
    if (racer.driven || (!anyDriven && won)) playFinish(won)

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
  const estimatedTime = useMemo(() => estimateRaceTime(reportProfile, course), [reportProfile, course])
  const section = COURSE.find((item) => item.terrain === selectedTerrain)

  const selectedEntries = roster.filter((entry) => selected.includes(entry.id))
  const leaderLap = standings.length
    ? Math.min(LAP_COUNT, Math.floor(standings[0].progress) + 1)
    : 1

  // Positions are kept alongside each racer so a collapsed board can still show
  // the real place rather than renumbering the one row it draws.
  const ranked = standings.map((racer, index) => ({ racer, index }))
  const focused = ranked.find((entry) => entry.racer.driven) ?? ranked[0]
  const shownRows = standingsOpen ? ranked : focused ? [focused] : []

  /** Hold-to-steer. Capturing the pointer keeps a finger that slides off the pad
   * from leaving the dinosaur locked at full lock. */
  const steerPad = (direction: SteerDirection) => ({
    onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => {
      event.preventDefault()
      event.currentTarget.setPointerCapture(event.pointerId)
      steering.press(direction)
    },
    onPointerUp: (event: React.PointerEvent<HTMLButtonElement>) => {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
      steering.release(direction)
    },
    onPointerCancel: () => steering.release(direction),
  })

  return <main className={`race-app${started ? ' running' : ''}`}>
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
          steering={driving ? steering : null}
        />}
      </RaceWorld>
    </div>

    <header className="race-header">
      <a href="./" aria-label="Return to Dino Lab">🧪 DINO LAB</a>
      <div><p>DINOSAUR RACING GROUNDS</p><h1>{course.def.name.toUpperCase()}</h1></div>
      <div className="race-header-actions">
        <SoundToggle />
        <a className="race-play-link" href="./run.html" aria-label="Play Star Dash">🌟</a>
      </div>
    </header>

    {/* Setup reading. It would otherwise land on top of the driving controls. */}
    {!started && <button className="course-info-toggle" type="button" aria-expanded={showInfo} onClick={() => setShowInfo((current) => !current)}>
      {showInfo ? '✕ Hide course info' : 'ⓘ Course info'}
    </button>}

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
      <div className="demo-chip"><span>ESTIMATE</span><b>{roster.find((entry) => entry.id === selected[0])?.config.name ?? 'Demo dino'}</b><em>{LAP_COUNT} laps: about {estimatedTime.toFixed(0)} seconds</em></div>
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
        <span>🎮</span>
        <div><strong>HOW DO YOU RACE?</strong><small>Drive one dinosaur, or watch them all</small></div>
      </div>
      <div className="mode-picker">
        <button
          type="button"
          className={mode === 'drive' ? 'chosen' : ''}
          aria-pressed={mode === 'drive'}
          disabled={!roster.length}
          onClick={() => { unlock(); playTap(); setMode('drive') }}
        ><span>🎮</span><strong>Drive</strong><small>Steer for stars, dodge tornadoes</small></button>
        <button
          type="button"
          className={mode === 'watch' ? 'chosen' : ''}
          aria-pressed={mode === 'watch'}
          onClick={() => { unlock(); playTap(); setMode('watch') }}
        ><span>👀</span><strong>Watch</strong><small>Sit back and cheer them on</small></button>
      </div>

      <div className="picker-head">
        <span>🦖</span>
        <div><strong>PICK YOUR RACERS</strong><small>{roster.length ? `Up to ${MAX_RACERS} · ${selected.length} chosen` : 'Nothing in the stable yet'}</small></div>
      </div>
      {roster.length === 0
        ? <p className="picker-empty">Build a dinosaur to race one of your own — or start now and watch the rivals go.<a href="./">🧪 Open Dino Lab</a></p>
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

      {mode === 'drive' && selectedEntries.length > 1 && <div className="driver-strip">
        <small>YOU DRIVE</small>
        <div>{selectedEntries.map((entry) => <button
          key={entry.id}
          type="button"
          className={entry.id === driverId ? 'chosen' : ''}
          aria-pressed={entry.id === driverId}
          onClick={() => { playTap(); setDriver(entry.id) }}
        ><i style={{ background: entry.config.color }} /><strong>{entry.config.name}</strong></button>)}</div>
      </div>}

      <button
        type="button"
        role="switch"
        aria-checked={useRivals}
        className={`rival-toggle${useRivals ? ' on' : ''}`}
        onClick={() => { playTap(); setUseRivals((current) => !current) }}
      >
        <span>{useRivals ? '✓' : ''}</span>
        <div><strong>Race the rivals</strong><small>Fills the grid up to {GRID_TARGET} dinosaurs</small></div>
      </button>

      {/* Sticks to the foot of the panel. It used to sit in the bottom bar and
          be hidden on narrow screens, which left the button buried below a
          scroll on a short window with no way to see it. */}
      <button
        className="picker-race-go"
        type="button"
        disabled={selected.length === 0 && !useRivals}
        onClick={startRace}
      >🏁 START RACE</button>
    </aside>}

    {started && standings.length > 0 && <aside
      className={`leaderboard${driving ? ' driving' : ''}${standingsOpen ? '' : ' collapsed'}`}
      aria-label="Race standings"
    >
      <div className="leaderboard-head">
        <span>🏁</span>
        <strong>{phase === 'finished' ? 'FINAL RESULTS' : standingsOpen ? 'RACE ORDER' : 'YOU'}</strong>
        {phase !== 'finished' && <em className="lap-chip">LAP {leaderLap}/{LAP_COUNT}</em>}
        <button
          className="standings-toggle"
          type="button"
          aria-expanded={standingsOpen}
          aria-label={standingsOpen ? 'Hide the other racers' : 'Show all racers'}
          onClick={() => { playTap(); setStandingsOpen((current) => !current) }}
        >{standingsOpen ? '▾' : '▸'}</button>
      </div>
      <ol>{shownRows.map(({ racer, index }) => <li key={racer.id} className={`${racer.place ? 'done' : ''}${racer.driven ? ' you' : ''}`}>
        <b>{racer.place ? PLACE_MEDAL[racer.place - 1] : index + 1}</b>
        <i style={{ background: racer.config.color }} />
        <div>
          <strong>{racer.name}{racer.driven ? ' 🎮' : ''}{racer.effect === 'boost' ? ' ⭐' : racer.effect === 'reverse' ? ' 🌪️' : ''}</strong>
          <small className={racer.effect ?? undefined}>
            {racer.place ? `Finished ${PLACE_LABEL[racer.place - 1]}`
              : racer.effect === 'boost' ? 'Star boost!'
                : racer.effect === 'reverse' ? 'Spun around!'
                  : racer.terrain}
          </small>
        </div>
        <em>{Math.round(Math.min(1, racer.progress / LAP_COUNT) * 100)}%</em>
      </li>)}</ol>
    </aside>}

    {phase === 'countdown' && <div className="countdown" role="status" aria-live="assertive">
      <span key={countdown}>{countdown > 0 ? countdown : 'GO!'}</span>
    </div>}

    {started && <div className={`race-controls${racing && driving ? ' driving' : ''}`}>
      <button className="race-reset" type="button" onClick={resetRace}>↻ NEW RACE</button>
      <button
        className={`race-follow${cameraMode === 'free' ? '' : ' on'}`}
        type="button"
        onClick={cycleCamera}
      >🎥 {cameraMode === 'free' ? 'Free camera'
        : cameraMode === 'leader' ? 'Following leader'
          : `Behind ${chasedName ?? 'racer'}`}</button>
      {finishers.length > 0 && !podiumOpen && <button className="race-results" type="button" onClick={() => setPodiumOpen(true)}>🏆 RESULTS</button>}
    </div>}

    {racing && driving && <div className="race-steer">
      <button type="button" aria-label="Steer left" {...steerPad(-1)}>◀</button>
      <button type="button" aria-label="Steer right" {...steerPad(1)}>▶</button>
    </div>}

    {podiumOpen && finishers.length > 0 && <div className="podium-backdrop" role="dialog" aria-modal="true" aria-label="Race results">
      <div className="podium">
        <button className="podium-close" type="button" aria-label="Close results" onClick={() => setPodiumOpen(false)}>✕</button>
        <b className="podium-confetti">🎉🏆🎊</b>
        <h2>{finishers[0].name} won 1st place!</h2>
        <ol className="podium-list">{finishers.map((racer) => <li key={racer.id}>
          <span>{PLACE_MEDAL[(racer.place ?? 1) - 1]}</span>
          <i style={{ background: racer.config.color }} />
          <div><strong>{racer.name}{racer.driven ? ' 🎮' : ''}</strong><small>{PLACE_LABEL[(racer.place ?? 1) - 1]} place</small></div>
          <em>{racer.finishedAt?.toFixed(1)}s</em>
        </li>)}</ol>
        {phase !== 'finished' && <p className="podium-waiting">Still running… finishers will appear here.</p>}
        <button className="podium-again" type="button" onClick={() => { setPodiumOpen(false); resetRace() }}>↻ RACE AGAIN</button>
      </div>
    </div>}

    <section className={`world-controls${racing && driving ? ' steering' : ''}`} aria-label="World camera instructions">
      <span>{racing && driving ? '🎮' : '◉'}</span>
      <div>{racing && driving
        ? <><strong>STEER YOUR DINOSAUR</strong><small>Hold ◀ ▶ or the arrow keys · grab stars, dodge tornadoes</small></>
        : <><strong>EXPLORE THE CIRCUIT</strong><small>Drag to rotate · scroll or pinch to zoom · right-drag to move</small></>}</div>
    </section>
  </main>
}
