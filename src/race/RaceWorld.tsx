import { useMemo, useRef, type ReactNode } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import {
  COURSE_CURVE,
  COURSE_SAMPLES,
  START_T,
  WORLD_LIFT,
  WORLD_SCALE,
  distanceToRoad,
  terrainAt,
  type Point,
} from './course'
import type { Terrain } from './raceTypes'

const seeded = (seed: number) => {
  const value = Math.sin(seed * 975.31) * 43758.5453
  return value - Math.floor(value)
}

function ribbonGeometry(width: number, lift = 0) {
  const positions: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  COURSE_SAMPLES.forEach((point, index) => {
    const previous = COURSE_SAMPLES[(index - 1 + COURSE_SAMPLES.length) % COURSE_SAMPLES.length]
    const next = COURSE_SAMPLES[(index + 1) % COURSE_SAMPLES.length]
    const tangent = next.clone().sub(previous).setY(0).normalize()
    const side = new THREE.Vector3(-tangent.z, 0, tangent.x)
    const left = point.clone().addScaledVector(side, width).add(new THREE.Vector3(0, lift, 0))
    const right = point.clone().addScaledVector(side, -width).add(new THREE.Vector3(0, lift, 0))
    positions.push(left.x, left.y, left.z, right.x, right.y, right.z)
    uvs.push(0, index / COURSE_SAMPLES.length, 1, index / COURSE_SAMPLES.length)
    if (index) indices.push((index - 1) * 2, (index - 1) * 2 + 1, index * 2, (index - 1) * 2 + 1, index * 2 + 1, index * 2)
  })
  const last = COURSE_SAMPLES.length - 1
  indices.push(last * 2, last * 2 + 1, 0, last * 2 + 1, 1, 0)
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

function RaceRoad() {
  const shoulder = useMemo(() => ribbonGeometry(1.72, .015), [])
  const road = useMemo(() => ribbonGeometry(1.46, .035), [])
  const centerMarkers = COURSE_SAMPLES.filter((_, index) => index % 10 < 5)
  return <group>
    <mesh geometry={shoulder} receiveShadow><meshStandardMaterial color="#796647" roughness={1} side={THREE.DoubleSide} /></mesh>
    <mesh geometry={road} receiveShadow><meshStandardMaterial color="#cda968" roughness={.98} side={THREE.DoubleSide} /></mesh>
    {centerMarkers.map((point, index) => <mesh key={index} position={[point.x, point.y + .075, point.z]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[.065, 8]} /><meshBasicMaterial color="#f4dfaa" transparent opacity={.9} />
    </mesh>)}
  </group>
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
function TrackTerrainDetails() {
  const details = useMemo(() => Array.from({ length: 44 }, (_, index) => {
    const t = (index + .5) / 44
    const point = COURSE_CURVE.getPointAt(t)
    const tangent = COURSE_CURVE.getTangentAt(t).setY(0).normalize()
    const side = new THREE.Vector3(-tangent.z, 0, tangent.x)
    const terrain = terrainAt(point.x, point.z)
    const offset = (index % 2 ? 1 : -1) * (.78 + seeded(index + 1500) * .34)
    return {
      terrain,
      position: point.clone().addScaledVector(side, offset),
      angle: Math.atan2(tangent.x, tangent.z),
      scale: .18 + seeded(index + 1540) * .16,
    }
  }), [])

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

function GroundPatch({ position, scale, color, opacity = 1 }: { position: [number, number]; scale: [number, number]; color: string; opacity?: number }) {
  return <mesh position={[position[0], -.035, position[1]]} scale={[scale[0], scale[1], 1]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
    <circleGeometry args={[1, 64]} /><meshStandardMaterial color={color} roughness={1} transparent={opacity < 1} opacity={opacity} />
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

function MarshBiome() {
  const reeds = useMemo(() => Array.from({ length: 56 }, (_, index) => {
    const x = -19 + seeded(index + 10) * 12
    const z = -9 + seeded(index + 80) * 11
    return { x, z }
  }).filter(({ x, z }) => distanceToRoad(x, z) > 2), [])
  return <group>
    <GroundPatch position={[-13.5, -3.6]} scale={[7.4, 6.7]} color="#5b8763" />
    <mesh position={[-13.7, .015, -3.6]} scale={[6.2, 5.4, 1]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow><circleGeometry args={[1, 64]} /><meshStandardMaterial color="#4c99a0" roughness={.24} metalness={.08} /></mesh>
    {reeds.map((reed, index) => <Reed key={index} {...reed} />)}
    {Array.from({ length: 22 }, (_, index) => <group key={index} position={[-18 + seeded(index + 133) * 9, .045, -7 + seeded(index + 174) * 7]}>
      <mesh rotation={[-Math.PI / 2, 0, index]}><circleGeometry args={[.21 + seeded(index) * .19, 14]} /><meshStandardMaterial color="#76a84e" /></mesh>
      {index % 4 === 0 && <mesh position={[.04, .1, 0]} scale={.07}><sphereGeometry args={[1, 10, 7]} /><meshStandardMaterial color="#f0a0bd" /></mesh>}
    </group>)}
  </group>
}

function Mountain({ position, scale, color }: { position: Point; scale: number; color: string }) {
  return <group position={position} scale={scale}>
    <mesh castShadow receiveShadow position={[0, 1.55, 0]}><coneGeometry args={[1.8, 3.1, 9]} /><meshStandardMaterial color={color} roughness={1} /></mesh>
    <mesh castShadow position={[0, 2.98, 0]}><coneGeometry args={[.66, .82, 9]} /><meshStandardMaterial color="#f1eee4" roughness={1} /></mesh>
  </group>
}

function MountainBiome() {
  const rocks = useMemo(() => Array.from({ length: 49 }, (_, index) => {
    const x = -14 + seeded(index + 228) * 13
    const z = 4 + seeded(index + 278) * 9
    return { x, z, scale: .35 + seeded(index + 320) * .7 }
  }).filter(({ x, z }) => distanceToRoad(x, z) > 2), [])
  return <group>
    <GroundPatch position={[-7.5, 8.8]} scale={[9.4, 7.4]} color="#758060" />
    <Mountain position={[-7.5, 0, 15.2]} scale={1.4} color="#7d7187" /><Mountain position={[-17.8, 0, 12.5]} scale={1.05} color="#626d78" />
    {rocks.map((rock, index) => <Rock key={index} {...rock} color={index % 2 ? '#67646b' : '#81767d'} />)}
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

function ForestBiome() {
  const trees = useMemo(() => Array.from({ length: 152 }, (_, index) => {
    const x = -.5 + seeded(index + 400) * 17
    const z = 3.5 + seeded(index + 530) * 10
    return { x, z, size: .48 + seeded(index + 680) * .62, broadleaf: index % 3 !== 0 }
  }).filter(({ x, z }) => distanceToRoad(x, z) > 2.65), [])
  return <group>
    <GroundPatch position={[7.5, 8.2]} scale={[10.1, 6.4]} color="#477d43" />
    {trees.map((tree, index) => <Tree key={index} {...tree} />)}
    {Array.from({ length: 38 }, (_, index) => {
      const x = seeded(index + 811) * 16
      const z = 4 + seeded(index + 860) * 9
      return distanceToRoad(x, z) > 2.1 ? <GrassTuft key={index} x={x} z={z} color="#8caf54" scale={.7} /> : null
    })}
  </group>
}

function PlainsBiome() {
  const grass = useMemo(() => Array.from({ length: 144 }, (_, index) => {
    const x = -2 + seeded(index + 900) * 22
    const z = -13 + seeded(index + 1040) * 11
    return { x, z, scale: .45 + seeded(index + 1170) * .7 }
  }).filter(({ x, z }) => distanceToRoad(x, z) > 1.9), [])
  return <group>
    <GroundPatch position={[8.5, -8]} scale={[13.4, 7]} color="#8cb85e" />
    {grass.map((item, index) => <GrassTuft key={index} {...item} color={index % 4 === 0 ? '#d0b75b' : '#6d9f4d'} />)}
    {Array.from({ length: 22 }, (_, index) => <mesh key={index} position={[-1 + seeded(index + 1300) * 21, .08, -12 + seeded(index + 1340) * 10]} scale={.06 + seeded(index) * .04}>
      <sphereGeometry args={[1, 10, 7]} /><meshStandardMaterial color={index % 2 ? '#e78368' : '#f0cc5b'} />
    </mesh>)}
  </group>
}

function StartGate() {
  const point = COURSE_CURVE.getPointAt(START_T)
  const tangent = COURSE_CURVE.getTangentAt(START_T)
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

/**
 * Free orbit until a race is on, then it eases its target onto the leader so the
 * pack stays framed without taking the camera away from the player.
 */
function CourseCamera({ follow }: { follow?: THREE.Vector3 | null }) {
  const controls = useRef<{ target: THREE.Vector3; update: () => void } | null>(null)
  useFrame(() => {
    if (follow && controls.current) {
      controls.current.target.lerp(follow, .06)
      controls.current.update()
    }
  })
  return <OrbitControls ref={controls as never} makeDefault enableDamping dampingFactor={.08} enablePan minDistance={16} maxDistance={64} minPolarAngle={.42} maxPolarAngle={1.25} target={[0, 0, 0]} />
}

export function RaceWorld({ children, follow }: { children?: ReactNode; follow?: THREE.Vector3 | null }) {
  return <Canvas shadows camera={{ position: [29, 31, 36], fov: 39 }} dpr={[1, 1.6]}>
    <color attach="background" args={['#9bcfd5']} /><fog attach="fog" args={['#9bcfd5', 60, 102]} />
    <hemisphereLight args={['#fff4dc', '#426348', 2.1]} /><directionalLight castShadow position={[-19, 29, 15]} intensity={2.7} shadow-mapSize={[2048, 2048]} shadow-camera-left={-38} shadow-camera-right={38} shadow-camera-top={38} shadow-camera-bottom={-38} />
    <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -.12, 0]}><planeGeometry args={[100, 92]} /><meshStandardMaterial color="#78a956" roughness={1} /></mesh>
    <group scale={[WORLD_SCALE, WORLD_LIFT, WORLD_SCALE]}>
      <PlainsBiome /><MarshBiome /><MountainBiome /><ForestBiome />
      <RaceRoad /><TrackTerrainDetails /><StartGate />
      {children}
    </group>
    <CourseCamera follow={follow} />
  </Canvas>
}
