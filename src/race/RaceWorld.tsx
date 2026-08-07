import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { Terrain } from './raceTypes'

export type BalloonMove = { x: number; z: number; nonce: number }

const trackSegments: { terrain: Terrain; points: [number, number, number][]; color: string }[] = [
  { terrain: 'Marsh', color: '#d7b65e', points: [[-18, .25, -5], [-15, .26, -5], [-12, .3, -3], [-10, .4, -1]] },
  { terrain: 'Mountains', color: '#ded3c3', points: [[-10, .4, -1], [-7, 1.4, 2], [-4, 2.7, 5], [-.5, 2.3, 6]] },
  { terrain: 'Forest', color: '#d3b66d', points: [[-.5, .4, 6], [3, .4, 6.1], [6, .38, 4.8], [8, .35, 2]] },
  { terrain: 'Plains', color: '#f3d36c', points: [[8, .35, 2], [11, .28, -.5], [15, .28, -2.3], [18, .28, -3]] },
]

function Track() {
  const curves = useMemo(() => trackSegments.map((segment) => ({ ...segment, curve: new THREE.CatmullRomCurve3(segment.points.map((point) => new THREE.Vector3(...point))) })), [])
  return <group>{curves.map(({ terrain, color, curve }) => (
    <group key={terrain}>
      <mesh castShadow receiveShadow>
        <tubeGeometry args={[curve, 44, .58, 10, false]} />
        <meshStandardMaterial color={color} roughness={.9} />
      </mesh>
      <mesh position={curve.getPoint(.5).add(new THREE.Vector3(0, .09, 0))}>
        <sphereGeometry args={[.16, 16, 12]} />
        <meshStandardMaterial color="#fff5ce" emissive="#f4cf61" emissiveIntensity={.35} />
      </mesh>
    </group>
  ))}</group>
}

function Reeds({ position }: { position: [number, number, number] }) {
  return <group position={position}>{[-.35, 0, .32].map((offset) => <group key={offset} position={[offset, 0, offset * .3]} rotation={[0, offset, 0]}>
    <mesh position={[0, .55, 0]}><cylinderGeometry args={[.035, .05, 1.1, 8]} /><meshStandardMaterial color="#305f43" /></mesh>
    <mesh position={[.05, 1.08, 0]} scale={[.16, .36, .16]}><sphereGeometry args={[1, 12, 8]} /><meshStandardMaterial color="#765237" /></mesh>
  </group>)}</group>
}

function Marsh() {
  return <group>
    <mesh position={[-14, .01, -2.8]} rotation={[-Math.PI / 2, 0, -.12]} receiveShadow>
      <circleGeometry args={[6.2, 48]} /><meshStandardMaterial color="#4c9ca0" roughness={.38} metalness={.15} />
    </mesh>
    {[[ -17, -1.8 ],[-15.5, .2],[-13.3,-.8],[-11.3,-2.3],[-16.3,-4.6]].map(([x, z], index) => <group key={index} position={[x, .08, z]}>
      <mesh rotation={[-Math.PI / 2, 0, index]}><circleGeometry args={[.45, 16]} /><meshStandardMaterial color="#85b855" /></mesh>
      {index % 2 === 0 && <mesh position={[.1, .14, 0]} scale={[.12, .12, .12]}><sphereGeometry args={[1, 14, 10]} /><meshStandardMaterial color="#f3a4bc" /></mesh>}
    </group>)}
    {[[-18, -4],[-16, .5],[-13,-5],[-11.4,.4]].map(([x, z], index) => <Reeds key={index} position={[x, .05, z]} />)}
  </group>
}

function Mountain({ position, scale, color }: { position: [number, number, number]; scale: number; color: string }) {
  return <group position={position} scale={scale}><mesh castShadow receiveShadow position={[0, 1.6, 0]}><coneGeometry args={[1.7, 3.2, 7]} /><meshStandardMaterial color={color} roughness={.92} /></mesh><mesh position={[0, 3.15, 0]}><coneGeometry args={[.7, 1.1, 7]} /><meshStandardMaterial color="#f6f4e7" roughness={.85} /></mesh></group>
}

function Mountains() {
  return <group><Mountain position={[-6.4, 0, 5]} scale={1.35} color="#756f94" /><Mountain position={[-2.7, 0, 7.3]} scale={1.05} color="#8a7c9d" /><Mountain position={[-4.2, 0, 1.7]} scale={.75} color="#6d7895" />
    {[[-8,3],[-5,7],[-3.5,4.5]].map(([x,z], index)=><mesh key={index} position={[x,.3,z]} rotation={[-Math.PI/2,0,index]}><circleGeometry args={[.45,8]} /><meshStandardMaterial color="#504a61" /></mesh>)}
  </group>
}

function Tree({ position, size = 1 }: { position: [number, number, number]; size?: number }) {
  return <group position={position} scale={size}><mesh castShadow position={[0,.65,0]}><cylinderGeometry args={[.18,.25,1.3,10]} /><meshStandardMaterial color="#76513d" /></mesh><mesh castShadow position={[0,1.65,0]}><coneGeometry args={[.95,2.1,10]} /><meshStandardMaterial color="#2f8055" /></mesh><mesh castShadow position={[0,2.35,0]}><coneGeometry args={[.7,1.7,10]} /><meshStandardMaterial color="#3b9b5d" /></mesh></group>
}

function Forest() {
  const trees = [[1,4.2,1.1],[2.8,7.6,.85],[4.2,3.1,1.25],[5.6,6.1,.95],[7,4.2,1.2],[7.7,6.9,.7],[.6,7.3,.75],[9,1.1,1]]
  return <group>{trees.map(([x,z,size], index)=><Tree key={index} position={[x,0,z]} size={size} />)}
    {[ [2.3,4.9],[4.8,5],[7,2.8] ].map(([x,z],index)=><mesh key={index} position={[x,.18,z]} rotation={[-Math.PI/2,0,index]}><circleGeometry args={[.16,12]} /><meshStandardMaterial color="#e9c358" /></mesh>)}
  </group>
}

function Plains() {
  return <group>{[[10,-2],[12,1],[14,-.5],[16,-3],[17,1.5]].map(([x,z], index)=><group key={index} position={[x,.15,z]}>
    <mesh position={[0,.3,0]}><coneGeometry args={[.24,.8,8]} /><meshStandardMaterial color="#d6b858" /></mesh>
    <mesh position={[.32,.2,.12]} scale={[.12,.12,.12]}><sphereGeometry args={[1,12,8]} /><meshStandardMaterial color="#f58e76" /></mesh>
  </group>)}
    <mesh position={[18,.55,-3]}><boxGeometry args={[.16,1.2,.16]} /><meshStandardMaterial color="#fffdf2" /></mesh>
    <mesh position={[18.42,1.1,-3]} rotation={[0,0,.15]}><planeGeometry args={[.8,.52]} /><meshStandardMaterial color="#ed5d5d" side={THREE.DoubleSide} /></mesh>
  </group>
}

function HotAirBalloon() {
  const balloon = useRef<THREE.Group>(null)
  useFrame(({ clock }) => { if (balloon.current) balloon.current.position.y = 7.6 + Math.sin(clock.elapsedTime * .8) * .18 })
  return <group ref={balloon} position={[1,7.6,-8]}><mesh castShadow scale={[1.2,1.5,1.2]}><sphereGeometry args={[1,28,20]} /><meshStandardMaterial color="#f4a942" roughness={.65} /></mesh>
    {[-.62,.62].flatMap((x)=>[-.52,.52].map(z=><mesh key={`${x}${z}`} position={[x,-1.65,z]} rotation={[0,0,x*.15]}><cylinderGeometry args={[.025,.025,1.45,6]} /><meshStandardMaterial color="#6d5037" /></mesh>))}
    <mesh position={[0,-2.35,0]}><boxGeometry args={[.82,.38,.72]} /><meshStandardMaterial color="#7f563d" /></mesh>
    <mesh position={[0,0,1.18]} scale={[.7,1.16,.14]}><sphereGeometry args={[1,24,18]} /><meshStandardMaterial color="#ed6e68" transparent opacity={.82} /></mesh>
  </group>
}

function BalloonCamera({ move }: { move: BalloonMove }) {
  const controls = useRef<React.ElementRef<typeof OrbitControls>>(null)
  const { camera } = useThree()
  const handled = useRef(0)
  useEffect(() => { camera.position.set(10, 13, -18) }, [camera])
  useFrame(() => {
    if (!controls.current || move.nonce === handled.current) return
    handled.current = move.nonce
    controls.current.target.add(new THREE.Vector3(move.x, 0, move.z))
    camera.position.add(new THREE.Vector3(move.x, 0, move.z))
    controls.current.update()
  })
  return <OrbitControls ref={controls} enableDamping dampingFactor={.08} minDistance={8} maxDistance={32} maxPolarAngle={Math.PI / 2.08} minPolarAngle={.3} target={[0,1,0]} />
}

export function RaceWorld({ move }: { move: BalloonMove }) {
  return <Canvas shadows camera={{ position: [10,13,-18], fov: 47 }} dpr={[1,1.6]}>
    <color attach="background" args={['#8bd3e4']} />
    <fog attach="fog" args={['#8bd3e4', 23, 55]} />
    <ambientLight intensity={1.45} />
    <directionalLight castShadow position={[-10,18,8]} intensity={2.3} shadow-mapSize={[1024,1024]} />
    <mesh receiveShadow rotation={[-Math.PI/2,0,0]} position={[0,-.03,0]}><planeGeometry args={[70,70]} /><meshStandardMaterial color="#77b858" roughness={1} /></mesh>
    <Marsh /><Mountains /><Forest /><Plains /><Track /><HotAirBalloon />
    <BalloonCamera move={move} />
  </Canvas>
}
