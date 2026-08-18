import { useReducer, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Dinosaur } from '../components/Dinosaur'
import { WORLD_LIFT, WORLD_SCALE, type Course } from './course'
import { DINO_SCALE, type ChaseTarget } from './Racers'
import { PickupModel } from './PickupModels'
import type { Pickup } from './pickups'
import { emptySample, routeOf, sampleReplay, type Playback, type Replay, type ReplayPickupSpan } from './replay'

/**
 * Plays a recorded race back through the same models and camera rigs the live
 * race uses, so a replay looks like the race rather than like a diagram of it.
 *
 * The playhead lives in a ref and advances inside this frame loop. Driving it
 * from React state would re-render the whole page sixty times a second, which
 * is the same reason the live race keeps its racers in a ref.
 */
export function ReplayRacers({ replay, course, playback, onTick, leaderOut, chaseId, chaseOut }: {
  replay: Replay
  course: Course
  /** Mutated in place: playback position, transport and rate. */
  playback: Playback
  /** Throttled, for the scrub bar and standings. */
  onTick: () => void
  leaderOut?: THREE.Vector3
  chaseId?: string | null
  chaseOut?: ChaseTarget
}) {
  const groups = useRef<(THREE.Group | null)[]>([])
  const gaits = useRef(replay.entries.map(() => ({ current: 0 })))
  const samples = useRef(replay.entries.map(emptySample))
  // Playback normally walks forward, so the last frame found is where the next
  // search starts. Scrubbing just costs a slightly longer walk.
  const cursor = useRef(0)
  const tickTimer = useRef(0)
  const visible = useRef<ReplayPickupSpan[]>([])
  const [, repaint] = useReducer((count: number) => count + 1, 0)

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05)

    if (playback.playing) {
      playback.time += delta * playback.speed
      if (playback.time >= replay.duration) {
        playback.time = replay.duration
        playback.playing = false
      }
    }

    cursor.current = sampleReplay(replay, playback.time, samples.current, cursor.current)

    let bestProgress = -1
    if (chaseOut) chaseOut.active = false

    replay.entries.forEach((entry, index) => {
      const sample = samples.current[index]
      const route = routeOf(sample.branches, course.splits.length)
      const frame = course.frameAt(course.startT + sample.progress, sample.lane, route)
      const heading = frame.heading + (sample.flip ? Math.PI : 0) + sample.spin

      const group = groups.current[index]
      if (group) {
        group.position.copy(frame.position)
        group.rotation.y = heading
      }
      gaits.current[index].current = sample.gait

      if (leaderOut && sample.progress > bestProgress) {
        bestProgress = sample.progress
        leaderOut.set(
          frame.position.x * WORLD_SCALE,
          frame.position.y * WORLD_LIFT,
          frame.position.z * WORLD_SCALE,
        )
      }

      if (chaseOut && chaseId === entry.id) {
        chaseOut.position.set(
          frame.position.x * WORLD_SCALE,
          frame.position.y * WORLD_LIFT,
          frame.position.z * WORLD_SCALE,
        )
        chaseOut.heading = frame.heading + (sample.flip ? Math.PI : 0)
        chaseOut.active = true
      }
    })

    // Which pickups were on the track at this moment. Repainting only when the
    // set actually changes keeps this from re-rendering every frame.
    const now = playback.time
    const live = replay.pickups.filter((span) => now >= span.from && now < span.to)
    const changed = live.length !== visible.current.length
      || live.some((span, index) => span.id !== visible.current[index]?.id)
    if (changed) {
      visible.current = live
      repaint()
    }

    tickTimer.current += delta
    if (tickTimer.current >= 0.12) {
      tickTimer.current = 0
      onTick()
    }
  })

  return (
    <>
      {replay.entries.map((entry, index) => (
        <group key={entry.id} ref={(element) => { groups.current[index] = element }}>
          <group scale={DINO_SCALE}>
            <Dinosaur config={entry.config} gait={gaits.current[index]} />
          </group>
        </group>
      ))}

      {visible.current.map((span) => {
        const frame = course.frameAt(span.t, span.lane, span.route)
        // The pickup models only read id and kind; the rest keeps the shape.
        const pickup: Pickup = {
          id: span.id,
          kind: span.kind,
          t: span.t,
          lane: span.lane,
          bornAt: span.from,
          diesAt: span.kind === 'tornado' ? span.to : null,
          taken: false,
        }
        return (
          <group key={span.id} position={[frame.position.x, frame.position.y, frame.position.z]}>
            <PickupModel pickup={pickup} />
          </group>
        )
      })}
    </>
  )
}
