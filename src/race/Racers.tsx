import { useReducer, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Dinosaur } from '../components/Dinosaur'
import { playStar, playTornado } from '../game/sound'
import { WORLD_LIFT, WORLD_SCALE, type Course } from './course'
import { BASE_SPEED, LAP_COUNT, stepRacer, type RacerState } from './raceEngine'
import { PickupModel } from './PickupModels'
import { STEER_LIMIT, STEER_SPEED, type Steering } from './steering'
import {
  MAX_LIVE_STARS,
  SPIN_TIME,
  STAR_BOOST_TIME,
  STAR_INTERVAL,
  TORNADO_PER_LAP,
  hits,
  reverseTimeFor,
  scheduleTornadoes,
  spawnAhead,
  type Pickup,
} from './pickups'

/** Sized so a full grid of six fits across the road without clipping. */
const DINO_SCALE = 0.34

export interface ChaseTarget {
  position: THREE.Vector3
  heading: number
  active: boolean
}

export function Racers({ racers, course, running, onFinish, onSample, leaderOut, chaseId, chaseOut, steering }: {
  /** Mutated in place by the frame loop; remount the component to reset. */
  racers: RacerState[]
  course: Course
  running: boolean
  onFinish: (racer: RacerState) => void
  onSample: () => void
  /** Receives the leader's world position for the follow camera. */
  leaderOut?: THREE.Vector3
  /** Racer the chase camera should ride behind, if any. */
  chaseId?: string | null
  chaseOut?: ChaseTarget
  /** Steers whichever racer is flagged `driven`, when the player is driving. */
  steering?: Steering | null
}) {
  const groups = useRef<(THREE.Group | null)[]>([])
  // Plain ref objects handed to each Dinosaur, so gait changes never re-render.
  const gaits = useRef(racers.map(() => ({ current: 0 })))
  const elapsed = useRef(0)
  const sampleTimer = useRef(0)

  // Pickups live in a ref because the frame loop owns them; the counter only
  // exists to repaint when one is actually added or removed.
  const pickups = useRef<Pickup[]>([])
  const nextId = useRef(0)
  const nextStarAt = useRef(1.2)
  // Scheduled against how long this course actually takes, so the last tornado
  // lands near the end of the final lap rather than early on the first. Only the
  // first render's schedule is kept; the component remounts to start a new race.
  const tornadoTimes = useRef(scheduleTornadoes(
    TORNADO_PER_LAP * LAP_COUNT,
    (course.length * LAP_COUNT) / BASE_SPEED,
  ))
  const tornadoesSent = useRef(0)
  // Tornadoes are not consumed, so a whole pack can clip one on the same frame.
  // Remembering which have been heard keeps that from firing six swoops at once.
  const heard = useRef(new Set<number>())
  const [, repaint] = useReducer((count: number) => count + 1, 0)

  useFrame((_, rawDelta) => {
    // A backgrounded tab can hand back a huge delta; clamping stops racers from
    // teleporting through the finish when the page regains focus.
    const delta = Math.min(rawDelta, 0.05)

    if (running) {
      elapsed.current += delta
      const now = elapsed.current
      let changed = false

      // Steering first, so a lane change counts against the pickups tested for
      // this same frame rather than lagging a frame behind the player's input.
      if (steering) {
        const direction = steering.input.current
        if (direction !== 0) {
          for (const racer of racers) {
            if (!racer.driven || racer.finishedAt !== null) continue
            const moved = racer.lane + direction * STEER_SPEED * delta
            racer.lane = Math.max(-STEER_LIMIT, Math.min(STEER_LIMIT, moved))
          }
        }
      }

      for (const racer of racers) {
        const wasRunning = racer.finishedAt === null
        stepRacer(racer, delta, now, course)
        if (wasRunning && racer.progress >= LAP_COUNT) {
          racer.progress = LAP_COUNT
          racer.finishedAt = now
          onFinish(racer)
        }
      }

      // Retire spent tornadoes and collected stars. Scanned before filtering so
      // the common case does not allocate a new array every frame.
      let stale = false
      for (const pickup of pickups.current) {
        if (pickup.taken || (pickup.diesAt !== null && pickup.diesAt <= now)) { stale = true; break }
      }
      if (stale) {
        pickups.current = pickups.current.filter((pickup) => !pickup.taken && (pickup.diesAt === null || pickup.diesAt > now))
        changed = true
      }

      // Stars go in front of whoever is last and tornadoes in front of whoever
      // is first, so luck closes the field up rather than stretching it out.
      let trailing = Infinity
      let leading = -Infinity
      for (const racer of racers) {
        if (racer.finishedAt !== null) continue
        if (racer.progress < trailing) trailing = racer.progress
        if (racer.progress > leading) leading = racer.progress
      }
      if (trailing < Infinity) {
        if (now >= nextStarAt.current) {
          nextStarAt.current = now + STAR_INTERVAL
          let stars = 0
          for (const pickup of pickups.current) if (pickup.kind === 'star') stars++
          if (stars < MAX_LIVE_STARS) {
            const at = (course.startT + trailing) % 1
            pickups.current = [...pickups.current, spawnAhead(nextId.current++, 'star', at, now)]
            changed = true
          }
        }

        if (tornadoesSent.current < tornadoTimes.current.length && now >= tornadoTimes.current[tornadoesSent.current]) {
          tornadoesSent.current += 1
          const at = (course.startT + leading) % 1
          pickups.current = [...pickups.current, spawnAhead(nextId.current++, 'tornado', at, now)]
          changed = true
        }
      }

      // Only the player's own hits make a noise while they are driving; a chime
      // for a star a rival took across the field just reads as a bug.
      const driving = steering ? racers.some((racer) => racer.driven) : false

      // Collisions. A racer already spinning cannot be caught again, so one
      // tornado never chains into an unrecoverable loop.
      for (const racer of racers) {
        if (racer.finishedAt !== null) continue
        const racerT = (course.startT + racer.progress) % 1
        const audible = driving ? racer.driven : true
        for (const pickup of pickups.current) {
          if (pickup.taken || !hits(racerT, racer.lane, pickup, course.length, racer.driven)) continue
          if (pickup.kind === 'star') {
            pickup.taken = true
            racer.boostUntil = now + STAR_BOOST_TIME
            changed = true
            if (audible) playStar()
          } else if (now >= racer.reverseUntil) {
            // Strength buys a shorter spin, so how long they are stuck facing
            // the wrong way is something the build decided.
            racer.reverseSpan = reverseTimeFor(racer.profile.strength)
            racer.reverseUntil = now + racer.reverseSpan
            if (audible && !heard.current.has(pickup.id)) {
              heard.current.add(pickup.id)
              playTornado()
            }
          }
        }
      }

      if (changed) repaint()
    }

    let bestProgress = -1
    if (chaseOut) chaseOut.active = false

    racers.forEach((racer, index) => {
      const frame = course.frameAt(course.startT + racer.progress, racer.lane)
      // Turned around while reversing, with a quick spin-out on the way there.
      const spinLeft = racer.reverseUntil - elapsed.current
      const reversing = spinLeft > 0
      const spinOut = Math.max(0, spinLeft - (racer.reverseSpan - SPIN_TIME))
      const heading = frame.heading + (reversing ? Math.PI : 0) + spinOut * 21

      const group = groups.current[index]
      if (group) {
        group.position.copy(frame.position)
        group.rotation.y = heading
      }
      gaits.current[index].current = racer.speed / BASE_SPEED

      if (leaderOut && racer.progress > bestProgress) {
        bestProgress = racer.progress
        leaderOut.set(
          frame.position.x * WORLD_SCALE,
          frame.position.y * WORLD_LIFT,
          frame.position.z * WORLD_SCALE,
        )
      }

      if (chaseOut && chaseId === racer.id) {
        // The spin-out is deliberately left out of the chase heading; riding a
        // camera through two full rotations is unwatchable.
        chaseOut.position.set(
          frame.position.x * WORLD_SCALE,
          frame.position.y * WORLD_LIFT,
          frame.position.z * WORLD_SCALE,
        )
        chaseOut.heading = frame.heading + (reversing ? Math.PI : 0)
        chaseOut.active = true
      }
    })

    sampleTimer.current += delta
    if (sampleTimer.current >= 0.12) {
      sampleTimer.current = 0
      onSample()
    }
  })

  return (
    <>
      {racers.map((racer, index) => (
        <group key={racer.id} ref={(element) => { groups.current[index] = element }}>
          <group scale={DINO_SCALE}>
            <Dinosaur config={racer.config} gait={gaits.current[index]} />
          </group>
        </group>
      ))}

      {pickups.current.map((pickup) => {
        const frame = course.frameAt(pickup.t, pickup.lane)
        return (
          <group key={pickup.id} position={[frame.position.x, frame.position.y, frame.position.z]}>
            <PickupModel pickup={pickup} />
          </group>
        )
      })}
    </>
  )
}
