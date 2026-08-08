import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Dinosaur } from '../components/Dinosaur'
import { courseFrame, START_T, WORLD_LIFT, WORLD_SCALE } from './course'
import { BASE_SPEED, LAP_COUNT, stepRacer, type RacerState } from './raceEngine'

/** Sized so a full grid of six fits across the road without clipping. */
const DINO_SCALE = 0.34

export function Racers({ racers, running, onFinish, onSample, leaderOut }: {
  /** Mutated in place by the frame loop; remount the component to reset. */
  racers: RacerState[]
  running: boolean
  onFinish: (racer: RacerState) => void
  onSample: () => void
  /** Receives the leader's world position for the follow camera. */
  leaderOut?: THREE.Vector3
}) {
  const groups = useRef<(THREE.Group | null)[]>([])
  // Plain ref objects handed to each Dinosaur, so gait changes never re-render.
  const gaits = useRef(racers.map(() => ({ current: 0 })))
  const elapsed = useRef(0)
  const sampleTimer = useRef(0)

  useFrame((_, rawDelta) => {
    // A backgrounded tab can hand back a huge delta; clamping stops racers from
    // teleporting through the finish when the page regains focus.
    const delta = Math.min(rawDelta, 0.05)

    if (running) {
      elapsed.current += delta
      for (const racer of racers) {
        const wasRunning = racer.finishedAt === null
        stepRacer(racer, delta, elapsed.current)
        if (wasRunning && racer.progress >= LAP_COUNT) {
          racer.progress = LAP_COUNT
          racer.finishedAt = elapsed.current
          onFinish(racer)
        }
      }
    }

    let bestProgress = -1
    racers.forEach((racer, index) => {
      const frame = courseFrame(START_T + racer.progress, racer.lane)
      const group = groups.current[index]
      if (group) {
        group.position.copy(frame.position)
        group.rotation.y = frame.heading
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
    </>
  )
}
