import { useMemo, useReducer, useRef, type RefObject } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { Dinosaur } from '../components/Dinosaur'
import { STAR_GEOMETRY } from '../race/PickupModels'
import type { DinosaurConfig } from '../game/dinosaurTypes'
import {
  DESPAWN_Z,
  LANES,
  RUN_SECONDS,
  SPAWN_Z,
  SPEED,
  advanceObjects,
  advanceSpawner,
  createSpawnState,
  prune,
  type RunObject,
  type SpawnState,
} from './runEngine'

const seeded = (seed: number) => {
  const value = Math.sin(seed * 975.31) * 43758.5453
  return value - Math.floor(value)
}

const TRACK_HALF_WIDTH = 3.6
const SCENERY_COUNT = 26
const STRIPE_COUNT = 26
const STRIPE_GAP = 3.4

/** Lane lines and verge posts sliding past; without them there is no sense of speed. */
function MovingGround({ running }: { running: boolean }) {
  const stripes = useRef<(THREE.Group | null)[]>([])
  const scenery = useRef<(THREE.Group | null)[]>([])

  const sceneryPlan = useMemo(() => Array.from({ length: SCENERY_COUNT }, (_, index) => ({
    side: index % 2 === 0 ? -1 : 1,
    z: SPAWN_Z + (index / SCENERY_COUNT) * (DESPAWN_Z - SPAWN_Z),
    offset: 1.1 + seeded(index + 31) * 2.4,
    scale: 0.7 + seeded(index + 77) * 0.7,
    kind: seeded(index + 120) > 0.45 ? 'tree' : 'rock',
  })), [])

  useFrame((_, rawDelta) => {
    if (!running) return
    const delta = Math.min(rawDelta, 0.05)
    const span = DESPAWN_Z - SPAWN_Z

    stripes.current.forEach((stripe) => {
      if (!stripe) return
      stripe.position.z += SPEED * delta
      if (stripe.position.z > DESPAWN_Z) stripe.position.z -= STRIPE_COUNT * STRIPE_GAP
    })
    scenery.current.forEach((item) => {
      if (!item) return
      item.position.z += SPEED * delta
      if (item.position.z > DESPAWN_Z) item.position.z -= span
    })
  })

  return (
    <group>
      {Array.from({ length: STRIPE_COUNT }, (_, index) => (
        <group key={index} ref={(el) => { stripes.current[index] = el }} position={[0, 0, DESPAWN_Z - index * STRIPE_GAP]}>
          {[-1, 1].map((side) => (
            <mesh key={side} position={[side * 1.07, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[0.16, 1.7]} />
              <meshBasicMaterial color="#f6e7bd" transparent opacity={0.75} />
            </mesh>
          ))}
        </group>
      ))}

      {sceneryPlan.map((item, index) => (
        <group
          key={index}
          ref={(el) => { scenery.current[index] = el }}
          position={[item.side * (TRACK_HALF_WIDTH + item.offset), 0, item.z]}
          scale={item.scale}
        >
          {item.kind === 'tree' ? (
            <>
              <mesh position={[0, 0.62, 0]} castShadow>
                <cylinderGeometry args={[0.13, 0.22, 1.25, 7]} />
                <meshStandardMaterial color="#65452f" />
              </mesh>
              <mesh position={[0, 1.5, 0]} castShadow>
                <coneGeometry args={[0.85, 1.9, 8]} />
                <meshStandardMaterial color="#2d7c49" roughness={1} />
              </mesh>
            </>
          ) : (
            <mesh position={[0, 0.28, 0]} castShadow>
              <dodecahedronGeometry args={[0.5, 0]} />
              <meshStandardMaterial color="#7b757c" roughness={1} />
            </mesh>
          )}
        </group>
      ))}
    </group>
  )
}

function RunStar() {
  const spin = useRef<THREE.Group>(null)
  useFrame((_, delta) => {
    if (!spin.current) return
    spin.current.rotation.y += delta * 2.6
  })
  return (
    <group ref={spin} position={[0, 1.05, 0]}>
      <mesh geometry={STAR_GEOMETRY} scale={0.62} castShadow>
        <meshStandardMaterial color="#ffd23f" emissive="#c98a12" emissiveIntensity={0.6} roughness={0.28} metalness={0.25} />
      </mesh>
    </group>
  )
}

function RunTornado() {
  const spin = useRef<THREE.Group>(null)
  useFrame((_, delta) => {
    if (!spin.current) return
    spin.current.rotation.y += delta * 8
  })
  const rings = [
    { y: 0.28, radius: 0.3, height: 0.6 },
    { y: 0.86, radius: 0.56, height: 0.62 },
    { y: 1.46, radius: 0.82, height: 0.66 },
    { y: 2.06, radius: 1.05, height: 0.66 },
  ]
  return (
    <group ref={spin}>
      {rings.map((ring, index) => (
        <mesh key={ring.y} position={[Math.sin(index * 1.7) * 0.09, ring.y, Math.cos(index * 1.7) * 0.09]}>
          <cylinderGeometry args={[ring.radius, ring.radius * 0.6, ring.height, 14, 1, true]} />
          <meshStandardMaterial color="#cfdcea" transparent opacity={0.62 - index * 0.05} roughness={0.8} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      ))}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <circleGeometry args={[0.72, 20]} />
        <meshBasicMaterial color="#8fa4b8" transparent opacity={0.4} depthWrite={false} />
      </mesh>
    </group>
  )
}

/**
 * The end of the run, placed by how much time is left rather than spawned.
 * The world moves at a fixed speed, so the remaining seconds are exactly the
 * remaining distance and the dinosaur crosses the line as the clock hits zero.
 */
function FinishLine({ elapsed }: { elapsed: RefObject<number> }) {
  const group = useRef<THREE.Group>(null)
  useFrame(() => {
    if (!group.current) return
    group.current.position.z = -SPEED * Math.max(0, RUN_SECONDS - elapsed.current)
  })

  const squares = [-3.2, -2.4, -1.6, -0.8, 0, 0.8, 1.6, 2.4]
  return (
    <group ref={group} position={[0, 0, -SPEED * RUN_SECONDS]}>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 3.95, 1.7, 0]} castShadow>
          <boxGeometry args={[0.3, 3.4, 0.3]} />
          <meshStandardMaterial color="#493c2f" />
        </mesh>
      ))}
      <mesh position={[0, 3.15, 0]} castShadow>
        <boxGeometry args={[8.2, 0.75, 0.34]} />
        <meshStandardMaterial color="#493c2f" />
      </mesh>
      {squares.map((x, index) => (
        <mesh key={`banner-${x}`} position={[x + 0.4, 3.15, 0.19]}>
          <planeGeometry args={[0.8, 0.62]} />
          <meshBasicMaterial color={index % 2 ? '#20242b' : '#f7f1da'} />
        </mesh>
      ))}
      {squares.map((x, index) => (
        <mesh key={`road-${x}`} position={[x + 0.4, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.8, 1.5]} />
          <meshBasicMaterial color={index % 2 ? '#20242b' : '#f7f1da'} />
        </mesh>
      ))}
    </group>
  )
}

/** Trails just behind the dinosaur and leans with it as it changes lane. */
function RunCamera({ playerX }: { playerX: RefObject<number> }) {
  const camera = useThree((state) => state.camera)
  const look = useRef(new THREE.Vector3())
  useFrame(() => {
    const x = playerX.current
    camera.position.x += (x * 0.55 - camera.position.x) * 0.1
    camera.position.y += (3.5 - camera.position.y) * 0.1
    camera.position.z += (7.4 - camera.position.z) * 0.1
    look.current.set(x * 0.34, 1.1, -9)
    camera.lookAt(look.current)
  })
  return null
}

function Player({ config, playerX }: { config: DinosaurConfig; playerX: RefObject<number> }) {
  const group = useRef<THREE.Group>(null)
  const gait = useRef(1)
  const lastX = useRef(0)
  useFrame(() => {
    if (!group.current) return
    const x = playerX.current
    group.current.position.x = x
    // Lean into the turn by how fast it is crossing lanes.
    const lean = THREE.MathUtils.clamp((x - lastX.current) * 5, -0.32, 0.32)
    lastX.current = x
    group.current.rotation.z = -lean
  })
  return (
    <group ref={group} position={[0, 0, 0]}>
      {/* The model faces +X, so a quarter turn points it down the track. */}
      <group rotation={[0, Math.PI / 2, 0]} scale={0.5}>
        <Dinosaur config={config} gait={gait} />
      </group>
    </group>
  )
}

/**
 * Drives the run. Lives inside the canvas because it needs the frame clock, and
 * only nudges React when the set of objects actually changes.
 */
function RunLoop({ objects, spawner, playerX, running, elapsed, onStar, onTornado, repaint }: {
  objects: RefObject<RunObject[]>
  spawner: RefObject<SpawnState>
  playerX: RefObject<number>
  running: boolean
  elapsed: RefObject<number>
  onStar: () => void
  onTornado: () => void
  repaint: () => void
}) {
  useFrame((_, rawDelta) => {
    if (!running) return
    // A backgrounded tab hands back a huge delta; clamping stops objects from
    // stepping straight over the dinosaur without ever being touched.
    const delta = Math.min(rawDelta, 0.05)
    elapsed.current += delta
    let changed = false

    const spawned = advanceSpawner(spawner.current, delta)
    if (spawned.length) {
      objects.current.push(...spawned)
      changed = true
    }

    const hit = advanceObjects(objects.current, playerX.current, delta)
    if (hit.star) onStar()
    if (hit.tornado) onTornado()

    const kept = prune(objects.current)
    if (kept.length !== objects.current.length) {
      objects.current = kept
      changed = true
    }

    if (changed) repaint()
  })
  return null
}

export function RunWorld({ config, playerX, running, onStar, onTornado }: {
  config: DinosaurConfig
  playerX: RefObject<number>
  running: boolean
  onStar: () => void
  onTornado: () => void
}) {
  const objects = useRef<RunObject[]>([])
  const spawner = useRef<SpawnState>(createSpawnState())
  const elapsed = useRef(0)
  const [, repaint] = useReducer((count: number) => count + 1, 0)

  return (
    <Canvas shadows camera={{ position: [0, 3.5, 7.4], fov: 55 }} dpr={[1, 1.6]}>
      <color attach="background" args={['#8fd4ea']} />
      <fog attach="fog" args={['#8fd4ea', 34, 74]} />
      <hemisphereLight args={['#fff6e2', '#4d7a4a', 2]} />
      <directionalLight
        castShadow
        position={[6, 14, 8]}
        intensity={2.4}
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-14}
        shadow-camera-right={14}
        shadow-camera-top={14}
        shadow-camera-bottom={-14}
      />

      {/* Grass either side, then the running surface on top of it. */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, -32]}>
        <planeGeometry args={[120, 120]} />
        <meshStandardMaterial color="#79b055" roughness={1} />
      </mesh>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -32]}>
        <planeGeometry args={[TRACK_HALF_WIDTH * 2, 120]} />
        <meshStandardMaterial color="#cda968" roughness={0.98} />
      </mesh>

      <MovingGround running={running} />
      <FinishLine elapsed={elapsed} />
      <Player config={config} playerX={playerX} />

      {objects.current.map((object) => <RunProp key={object.id} object={object} />)}

      <RunLoop
        objects={objects}
        spawner={spawner}
        playerX={playerX}
        running={running}
        elapsed={elapsed}
        onStar={onStar}
        onTornado={onTornado}
        repaint={repaint}
      />
      <RunCamera playerX={playerX} />
    </Canvas>
  )
}

/**
 * One group per object, positioned entirely from the frame loop. Collected
 * stars vanish immediately rather than waiting for the next React render.
 */
function RunProp({ object }: { object: RunObject }) {
  const group = useRef<THREE.Group>(null)
  useFrame(() => {
    if (!group.current) return
    group.current.position.set(LANES[object.lane], 0, object.z)
    group.current.visible = !object.gone
  })
  return (
    <group ref={group}>
      {object.kind === 'star' ? <RunStar /> : <RunTornado />}
    </group>
  )
}
