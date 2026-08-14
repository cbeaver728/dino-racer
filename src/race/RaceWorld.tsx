import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { WORLD_LIFT, WORLD_SCALE, type BiomeLayout, type Course } from './course'
import type { ChaseTarget } from './Racers'
import type { Terrain } from './raceTypes'

const seeded = (seed: number) => {
  const value = Math.sin(seed * 975.31) * 43758.5453
  return value - Math.floor(value)
}

/** Points scattered inside a biome's footprint, skipping anything on the road. */
function scatter(count: number, seed: number, layout: BiomeLayout, course: Course, clearance: number) {
  const points: { x: number; z: number; roll: number; index: number }[] = []
  for (let index = 0; index < count; index++) {
    const x = layout.center[0] + (seeded(index + seed) * 2 - 1) * layout.spread[0]
    const z = layout.center[1] + (seeded(index + seed + 517) * 2 - 1) * layout.spread[1]
    if (course.distanceToRoad(x, z) > clearance) {
      points.push({ x, z, roll: seeded(index + seed + 911), index })
    }
  }
  return points
}

function ribbonGeometry(course: Course, width: number, lift = 0) {
  const samples = course.samples
  const positions: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  samples.forEach((point, index) => {
    const previous = samples[(index - 1 + samples.length) % samples.length]
    const next = samples[(index + 1) % samples.length]
    const tangent = next.clone().sub(previous).setY(0).normalize()
    const side = new THREE.Vector3(-tangent.z, 0, tangent.x)
    const left = point.clone().addScaledVector(side, width).add(new THREE.Vector3(0, lift, 0))
    const right = point.clone().addScaledVector(side, -width).add(new THREE.Vector3(0, lift, 0))
    positions.push(left.x, left.y, left.z, right.x, right.y, right.z)
    uvs.push(0, index / samples.length, 1, index / samples.length)
    if (index) indices.push((index - 1) * 2, (index - 1) * 2 + 1, index * 2, (index - 1) * 2 + 1, index * 2 + 1, index * 2)
  })
  const last = samples.length - 1
  indices.push(last * 2, last * 2 + 1, 0, last * 2 + 1, 1, 0)
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

function RaceRoad({ course }: { course: Course }) {
  const shoulder = useMemo(() => ribbonGeometry(course, 1.72, .015), [course])
  const road = useMemo(() => ribbonGeometry(course, 1.46, .035), [course])
  const centerMarkers = course.samples.filter((_, index) => index % 10 < 5)
  return <group>
    <mesh geometry={shoulder} receiveShadow><meshStandardMaterial color="#796647" roughness={1} side={THREE.DoubleSide} /></mesh>
    <mesh geometry={road} receiveShadow><meshStandardMaterial color="#cda968" roughness={.98} side={THREE.DoubleSide} /></mesh>
    {centerMarkers.map((point, index) => <mesh key={index} position={[point.x, point.y + .075, point.z]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[.065, 8]} /><meshBasicMaterial color="#f4dfaa" transparent opacity={.9} />
    </mesh>)}
  </group>
}

/**
 * Legs under any stretch of road carried above the ground. Placed out at the
 * shoulders and skipped wherever a lower piece of track runs beneath, so a
 * bridge never drops a pillar into the roadway it crosses.
 */
function BridgeSupports({ course }: { course: Course }) {
  const supports = useMemo(() => {
    const minY = course.def.bridgeMinY
    if (minY === undefined) return []

    const low = course.samples.filter((point) => point.y < minY * .6)
    const clearOfLowerRoad = (x: number, z: number) => low.every((point) => Math.hypot(point.x - x, point.z - z) > 2.1)

    const legs: { x: number; y: number; z: number }[] = []
    const STEPS = 96
    for (let step = 0; step < STEPS; step++) {
      const t = step / STEPS
      const point = course.curve.getPointAt(t)
      if (point.y <= minY) continue
      const tangent = course.curve.getTangentAt(t).setY(0).normalize()
      const side = new THREE.Vector3(-tangent.z, 0, tangent.x)
      for (const offset of [-1.62, 1.62]) {
        const x = point.x + side.x * offset
        const z = point.z + side.z * offset
        if (clearOfLowerRoad(x, z)) legs.push({ x, y: point.y, z })
      }
    }
    // Thin the run out so the bridge reads as piers rather than a wall.
    return legs.filter((_, index) => index % 6 < 2)
  }, [course])

  return <group>{supports.map((leg, index) => <mesh key={index} position={[leg.x, leg.y / 2, leg.z]} castShadow receiveShadow>
    <cylinderGeometry args={[.15, .21, leg.y, 10]} /><meshStandardMaterial color="#6d5c48" roughness={1} />
  </mesh>)}</group>
}

const TRACK_DETAIL_COLORS: Record<Terrain, string> = {
  Marsh: '#4b9ba5',
  Mountains: '#81737b',
  Forest: '#3c7f46',
  Plains: '#d29c48',
}

/**
 * Painted, nearly-flat terrain cues. They identify each road section without
 * adding anything a racing dinosaur can collide with or hide behind.
 */
function TrackTerrainDetails({ course }: { course: Course }) {
  const details = useMemo(() => Array.from({ length: 44 }, (_, index) => {
    const t = (index + .5) / 44
    const point = course.curve.getPointAt(t)
    const tangent = course.curve.getTangentAt(t).setY(0).normalize()
    const side = new THREE.Vector3(-tangent.z, 0, tangent.x)
    const terrain = course.terrainAt(point.x, point.z)
    const offset = (index % 2 ? 1 : -1) * (.78 + seeded(index + 1500) * .34)
    return {
      terrain,
      position: point.clone().addScaledVector(side, offset),
      angle: Math.atan2(tangent.x, tangent.z),
      scale: .18 + seeded(index + 1540) * .16,
    }
  }), [course])

  return <group>{details.map((detail, index) => <mesh
    key={index}
    position={[detail.position.x, detail.position.y + .086, detail.position.z]}
    rotation={[-Math.PI / 2, 0, detail.angle]}
    scale={[detail.terrain === 'Marsh' ? 1.7 : 1, 1, 1]}
  >
    {detail.terrain === 'Forest'
      ? <ringGeometry args={[detail.scale * .42, detail.scale, 6]} />
      : <circleGeometry args={[detail.scale, detail.terrain === 'Mountains' ? 6 : 12]} />}
    <meshBasicMaterial color={TRACK_DETAIL_COLORS[detail.terrain]} transparent opacity={detail.terrain === 'Marsh' ? .62 : .72} depthWrite={false} />
  </mesh>)}</group>
}

function GroundPatch({ layout, color }: { layout: BiomeLayout; color: string }) {
  return <mesh position={[layout.center[0], -.035, layout.center[1]]} scale={[layout.patch[0], layout.patch[1], 1]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
    <circleGeometry args={[1, 64]} /><meshStandardMaterial color={color} roughness={1} />
  </mesh>
}

function GrassTuft({ x, z, color = '#4e8f48', scale = 1 }: { x: number; z: number; color?: string; scale?: number }) {
  return <group position={[x, .02, z]} scale={scale} rotation={[0, seeded(x * 7 + z) * Math.PI, 0]}>
    {[-.12, 0, .12].map((offset) => <mesh key={offset} position={[offset, .16, 0]} rotation={[0, 0, offset * 2.2]}><coneGeometry args={[.04, .36, 4]} /><meshStandardMaterial color={color} /></mesh>)}
  </group>
}

function Rock({ x, z, scale = 1, color = '#706c70' }: { x: number; z: number; scale?: number; color?: string }) {
  return <mesh position={[x, .24 * scale, z]} scale={[.52 * scale, .38 * scale, .45 * scale]} rotation={[0, seeded(x + z) * Math.PI, 0]} castShadow receiveShadow>
    <dodecahedronGeometry args={[1, 0]} /><meshStandardMaterial color={color} roughness={1} />
  </mesh>
}

function Reed({ x, z }: { x: number; z: number }) {
  return <group position={[x, 0, z]}>{[-.2, .05, .25].map((offset) => <group key={offset} position={[offset, 0, offset * .4]}>
    <mesh position={[0, .43, 0]}><cylinderGeometry args={[.022, .035, .86, 6]} /><meshStandardMaterial color="#315d43" /></mesh>
    <mesh position={[0, .86, 0]} scale={[.09, .23, .09]}><sphereGeometry args={[1, 10, 7]} /><meshStandardMaterial color="#674630" /></mesh>
  </group>)}</group>
}

function MarshBiome({ layout, course }: { layout: BiomeLayout; course: Course }) {
  const reeds = useMemo(() => scatter(56, 10, layout, course, 2), [layout, course])
  const pads = useMemo(() => scatter(26, 133, layout, course, 2.2), [layout, course])
  return <group>
    <GroundPatch layout={layout} color="#5b8763" />
    <mesh position={[layout.center[0], .015, layout.center[1]]} scale={[layout.patch[0] * .84, layout.patch[1] * .81, 1]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <circleGeometry args={[1, 64]} /><meshStandardMaterial color="#4c99a0" roughness={.24} metalness={.08} />
    </mesh>
    {reeds.map((reed, index) => <Reed key={index} x={reed.x} z={reed.z} />)}
    {pads.map((pad, index) => <group key={index} position={[pad.x, .045, pad.z]}>
      <mesh rotation={[-Math.PI / 2, 0, index]}><circleGeometry args={[.21 + pad.roll * .19, 14]} /><meshStandardMaterial color="#76a84e" /></mesh>
      {index % 4 === 0 && <mesh position={[.04, .1, 0]} scale={.07}><sphereGeometry args={[1, 10, 7]} /><meshStandardMaterial color="#f0a0bd" /></mesh>}
    </group>)}
  </group>
}

function Mountain({ position, scale, color }: { position: [number, number, number]; scale: number; color: string }) {
  return <group position={position} scale={scale}>
    <mesh castShadow receiveShadow position={[0, 1.55, 0]}><coneGeometry args={[1.8, 3.1, 9]} /><meshStandardMaterial color={color} roughness={1} /></mesh>
    <mesh castShadow position={[0, 2.98, 0]}><coneGeometry args={[.66, .82, 9]} /><meshStandardMaterial color="#f1eee4" roughness={1} /></mesh>
  </group>
}

function MountainBiome({ layout, course }: { layout: BiomeLayout; course: Course }) {
  const rocks = useMemo(() => scatter(49, 228, layout, course, 2), [layout, course])
  return <group>
    <GroundPatch layout={layout} color="#758060" />
    {(layout.peaks ?? []).map((peak, index) => <Mountain
      key={index}
      position={[peak[0], 0, peak[1]]}
      scale={peak[2]}
      color={index % 2 ? '#626d78' : '#7d7187'}
    />)}
    {rocks.map((rock, index) => <Rock key={index} x={rock.x} z={rock.z} scale={.35 + rock.roll * .7} color={index % 2 ? '#67646b' : '#81767d'} />)}
  </group>
}

function Tree({ x, z, size, broadleaf }: { x: number; z: number; size: number; broadleaf: boolean }) {
  return <group position={[x, 0, z]} scale={size}>
    <mesh castShadow position={[0, .62, 0]}><cylinderGeometry args={[.13, .22, 1.25, 8]} /><meshStandardMaterial color="#65452f" /></mesh>
    {broadleaf ? <>
      <mesh castShadow position={[0, 1.45, 0]} scale={[.9, .72, .9]}><dodecahedronGeometry args={[1, 1]} /><meshStandardMaterial color="#2f7f45" roughness={1} /></mesh>
      <mesh castShadow position={[-.42, 1.25, .05]} scale={.62}><dodecahedronGeometry args={[1, 1]} /><meshStandardMaterial color="#3d9650" roughness={1} /></mesh>
    </> : <>
      <mesh castShadow position={[0, 1.38, 0]}><coneGeometry args={[.92, 1.75, 9]} /><meshStandardMaterial color="#216744" /></mesh>
      <mesh castShadow position={[0, 2.05, 0]}><coneGeometry args={[.66, 1.35, 9]} /><meshStandardMaterial color="#2d7c49" /></mesh>
    </>}
  </group>
}

function ForestBiome({ layout, course }: { layout: BiomeLayout; course: Course }) {
  const trees = useMemo(() => scatter(152, 400, layout, course, 2.65), [layout, course])
  const tufts = useMemo(() => scatter(38, 811, layout, course, 2.1), [layout, course])
  return <group>
    <GroundPatch layout={layout} color="#477d43" />
    {trees.map((tree, index) => <Tree key={index} x={tree.x} z={tree.z} size={.48 + tree.roll * .62} broadleaf={tree.index % 3 !== 0} />)}
    {tufts.map((tuft, index) => <GrassTuft key={index} x={tuft.x} z={tuft.z} color="#8caf54" scale={.7} />)}
  </group>
}

function PlainsBiome({ layout, course }: { layout: BiomeLayout; course: Course }) {
  const grass = useMemo(() => scatter(144, 900, layout, course, 1.9), [layout, course])
  const flowers = useMemo(() => scatter(24, 1300, layout, course, 1.9), [layout, course])
  return <group>
    <GroundPatch layout={layout} color="#8cb85e" />
    {grass.map((item, index) => <GrassTuft key={index} x={item.x} z={item.z} scale={.45 + item.roll * .7} color={index % 4 === 0 ? '#d0b75b' : '#6d9f4d'} />)}
    {flowers.map((flower, index) => <mesh key={index} position={[flower.x, .08, flower.z]} scale={.06 + flower.roll * .04}>
      <sphereGeometry args={[1, 10, 7]} /><meshStandardMaterial color={index % 2 ? '#e78368' : '#f0cc5b'} />
    </mesh>)}
  </group>
}

function StartGate({ course }: { course: Course }) {
  const point = course.curve.getPointAt(course.startT)
  const tangent = course.curve.getTangentAt(course.startT)
  const angle = Math.atan2(tangent.x, tangent.z)
  return <group position={[point.x, point.y, point.z]} rotation={[0, angle, 0]}>
    {[-1.2, 1.2].map((x) => <mesh key={x} castShadow position={[x, .82, 0]}><boxGeometry args={[.18, 1.65, .18]} /><meshStandardMaterial color="#493c2f" /></mesh>)}
    <mesh castShadow position={[0, 1.58, 0]}><boxGeometry args={[2.58, .28, .25]} /><meshStandardMaterial color="#493c2f" /></mesh>
    {[-.9,-.6,-.3,0,.3,.6,.9].map((x, index) => <mesh key={x} position={[x, 1.59, -.14]}><planeGeometry args={[.3,.25]} /><meshBasicMaterial color={index % 2 ? '#f0d96b' : '#f7f1da'} /></mesh>)}
    {/* Chequered strip on the ground marking start and finish. */}
    {[-1.15, -.85, -.55, -.25, .05, .35, .65, .95].map((x, index) => <mesh key={x} position={[x + .15, .045, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[.3, .5]} /><meshBasicMaterial color={index % 2 ? '#20242b' : '#f7f1da'} />
    </mesh>)}
  </group>
}

/** High and back enough to hold the whole circuit in frame. */
export const OVERVIEW_VIEW = [29, 31, 36] as const

/**
 * The offset the leader is followed from. Orbit controls keep the camera the
 * same distance from their target as it moves, so this is a tracking shot: far
 * enough out to see the road ahead and who is closing, rather than a close chase.
 */
export const FOLLOW_VIEW = [23, 25, 28] as const

/**
 * Free orbit until a race is on, then it eases its target onto the leader so the
 * pack stays framed without taking the camera away from the player.
 */
function CourseCamera({ follow, resetView, resetOffset }: {
  follow?: THREE.Vector3 | null
  resetView?: number
  resetOffset?: readonly [number, number, number]
}) {
  const camera = useThree((state) => state.camera)
  const controls = useRef<{ target: THREE.Vector3; update: () => void } | null>(null)

  /*
   * Snap to a known distance when the caller bumps `resetView`.
   *
   * The chase camera moves the shared camera itself, so simply switching back to
   * orbit would leave it parked wherever the chase left it — a foot behind a
   * dinosaur, which is not a view of a race track. The offset is also what the
   * leader is then followed at, since orbit controls hold it as the target moves.
   */
  useEffect(() => {
    if (resetView === undefined) return
    const offset = resetOffset ?? OVERVIEW_VIEW
    camera.position.set(offset[0], offset[1], offset[2])
    if (controls.current) {
      controls.current.target.set(0, 0, 0)
      controls.current.update()
    }
    // resetOffset is read at the moment the counter changes, by design.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetView, camera])

  useFrame(() => {
    if (follow && controls.current) {
      controls.current.target.lerp(follow, .06)
      controls.current.update()
    }
  })
  return <OrbitControls ref={controls as never} makeDefault enableDamping dampingFactor={.08} enablePan minDistance={16} maxDistance={64} minPolarAngle={.42} maxPolarAngle={1.25} target={[0, 0, 0]} />
}

// A racing dinosaur is a bit over two world units long, so the camera sits about
// four body lengths back. Pulled back and raised from where it started: this is
// the view you steer from now, and from lower down the dinosaur filled the frame
// and a tornado only appeared once it was too late to dodge it.
const CHASE_BACK = 5.6
const CHASE_HEIGHT = 2.7
// Aimed down the road rather than at the dinosaur's heels, so the pickups coming
// up have somewhere to be on screen.
const CHASE_AHEAD = 2.9
const CHASE_LOOK_UP = 0.85

/** Rides just behind and above one dinosaur, looking down the road ahead of it. */
function ChaseCamera({ target }: { target: ChaseTarget }) {
  const camera = useThree((state) => state.camera)
  const desired = useRef(new THREE.Vector3())
  const look = useRef(new THREE.Vector3())
  const settled = useRef(false)

  useFrame(() => {
    if (!target.active) return
    const forwardX = Math.cos(target.heading)
    const forwardZ = -Math.sin(target.heading)

    desired.current.set(
      target.position.x - forwardX * CHASE_BACK,
      target.position.y + CHASE_HEIGHT,
      target.position.z - forwardZ * CHASE_BACK,
    )
    // Snap on the first frame, then trail, so switching racer does not sling the
    // camera across the field.
    camera.position.lerp(desired.current, settled.current ? .12 : 1)
    settled.current = true

    look.current.set(
      target.position.x + forwardX * CHASE_AHEAD,
      target.position.y + CHASE_LOOK_UP,
      target.position.z + forwardZ * CHASE_AHEAD,
    )
    camera.lookAt(look.current)
  })

  return null
}

export function RaceWorld({ course, children, follow, chase, resetView, resetOffset }: {
  course: Course
  children?: ReactNode
  follow?: THREE.Vector3 | null
  chase?: ChaseTarget | null
  /** Bump to snap the orbit camera to `resetOffset`. */
  resetView?: number
  resetOffset?: readonly [number, number, number]
}) {
  return <Canvas shadows camera={{ position: [29, 31, 36], fov: 39 }} dpr={[1, 1.6]}>
    <color attach="background" args={['#9bcfd5']} /><fog attach="fog" args={['#9bcfd5', 60, 102]} />
    <hemisphereLight args={['#fff4dc', '#426348', 2.1]} /><directionalLight castShadow position={[-19, 29, 15]} intensity={2.7} shadow-mapSize={[2048, 2048]} shadow-camera-left={-38} shadow-camera-right={38} shadow-camera-top={38} shadow-camera-bottom={-38} />
    <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -.12, 0]}><planeGeometry args={[110, 100]} /><meshStandardMaterial color="#78a956" roughness={1} /></mesh>
    <group scale={[WORLD_SCALE, WORLD_LIFT, WORLD_SCALE]}>
      <PlainsBiome layout={course.def.biomes.Plains} course={course} />
      <MarshBiome layout={course.def.biomes.Marsh} course={course} />
      <MountainBiome layout={course.def.biomes.Mountains} course={course} />
      <ForestBiome layout={course.def.biomes.Forest} course={course} />
      <RaceRoad course={course} />
      <BridgeSupports course={course} />
      <TrackTerrainDetails course={course} />
      <StartGate course={course} />
      {children}
    </group>
    {chase ? <ChaseCamera target={chase} /> : <CourseCamera follow={follow} resetView={resetView} resetOffset={resetOffset} />}
  </Canvas>
}
