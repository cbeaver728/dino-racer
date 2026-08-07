import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'

export type BalloonMove = { x: number; z: number; nonce: number }

type Point = [number, number, number]

// A closed, mostly flat loop. Only the mountain pass rises above the landscape.
const roadPoints: Point[] = [
  [-18, .16, -5], [-14, .16, -7], [-9, .16, -5], [-7, .5, -1], [-5, 2.05, 3],
  [-1, 1.6, 6], [4, .18, 6], [8, .18, 3], [11, .18, -1], [16, .18, -4],
  [13, .16, -8], [6, .16, -9], [-2, .16, -9], [-10, .16, -8], [-18, .16, -5],
]

const seeded = (seed: number) => {
  const x = Math.sin(seed * 999.91) * 43758.5453
  return x - Math.floor(x)
}

function FlatRoad() {
  const geometry = useMemo(() => {
    const points = roadPoints.map((point) => new THREE.Vector3(...point))
    const vertices: number[] = [], uvs: number[] = [], indices: number[] = []
    points.forEach((point, index) => {
      const previous = points[(index - 1 + points.length) % points.length]
      const next = points[(index + 1) % points.length]
      const direction = next.clone().sub(previous).setY(0).normalize()
      const side = new THREE.Vector3(-direction.z, 0, direction.x)
      const width = index >= 3 && index <= 5 ? 1.15 : 1.32
      const left = point.clone().addScaledVector(side, width)
      const right = point.clone().addScaledVector(side, -width)
      vertices.push(left.x, left.y, left.z, right.x, right.y, right.z)
      uvs.push(0, index / (points.length - 1), 1, index / (points.length - 1))
      if (index) indices.push((index - 1) * 2, (index - 1) * 2 + 1, index * 2, (index - 1) * 2 + 1, index * 2 + 1, index * 2)
    })
    const road = new THREE.BufferGeometry()
    road.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
    road.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
    road.setIndex(indices)
    road.computeVertexNormals()
    return road
  }, [])
  return <group>
    <mesh geometry={geometry} receiveShadow><meshStandardMaterial color="#c98e4d" roughness={1} side={THREE.DoubleSide} /></mesh>
    <mesh geometry={geometry} position={[0, .015, 0]} receiveShadow><meshBasicMaterial color="#f5d88b" transparent opacity={.3} side={THREE.DoubleSide} /></mesh>
    {roadPoints.filter((_, index) => index % 2 === 0).map((point, index) => <mesh key={index} position={[point[0], point[1] + .035, point[2]]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[.11, 10]} /><meshBasicMaterial color="#fff0bf" transparent opacity={.8} />
    </mesh>)}
  </group>
}

function Grass({ x, z, scale = 1 }: { x: number; z: number; scale?: number }) {
  return <group position={[x, .02, z]} scale={scale} rotation={[0, (x + z) % 3, 0]}>
    {[-.13, 0, .13].map((offset) => <mesh key={offset} position={[offset, .18, 0]} rotation={[0, 0, offset * 2.2]}><coneGeometry args={[.045, .42, 4]} /><meshStandardMaterial color="#4c934e" /></mesh>)}
  </group>
}

function Reeds({ x, z }: { x: number; z: number }) {
  return <group position={[x, .03, z]}>{[-.35, 0, .32].map((offset) => <group key={offset} position={[offset, 0, offset * .35]}>
    <mesh position={[0, .52, 0]}><cylinderGeometry args={[.024, .04, 1.04, 7]} /><meshStandardMaterial color="#315e3c" /></mesh>
    <mesh position={[.05, 1.02, 0]} scale={[.13, .3, .13]}><sphereGeometry args={[1, 10, 8]} /><meshStandardMaterial color="#76523a" /></mesh>
  </group>)}</group>
}

function Marsh() {
  const reeds = useMemo(() => Array.from({ length: 26 }, (_, i) => ({ x: -19 + seeded(i + 4) * 9.5, z: -7.5 + seeded(i + 40) * 7 })), [])
  return <group>
    <mesh position={[-14.6, .005, -3.1]} rotation={[-Math.PI / 2, 0, -.09]} receiveShadow><circleGeometry args={[7.1, 64]} /><meshStandardMaterial color="#4e9ca4" roughness={.3} metalness={.15} /></mesh>
    <mesh position={[-15.2, .018, -3.4]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[4.5, 6.9, 64]} /><meshBasicMaterial color="#6cb46b" transparent opacity={.3} /></mesh>
    {reeds.map((reed, i) => <Reeds key={i} {...reed} />)}
    {Array.from({ length: 18 }, (_, i) => <group key={i} position={[-19 + seeded(i + 100) * 8.5, .07, -6.2 + seeded(i + 132) * 5.8]}>
      <mesh rotation={[-Math.PI / 2, 0, i]}><circleGeometry args={[.26 + seeded(i) * .22, 12]} /><meshStandardMaterial color="#84b957" /></mesh>
      {i % 3 === 0 && <mesh position={[.06, .1, 0]} scale={.075}><sphereGeometry args={[1, 12, 8]} /><meshStandardMaterial color="#f2a9bd" /></mesh>}
    </group>)}
  </group>
}

function Mountain({ position, scale, color }: { position: Point; scale: number; color: string }) {
  return <group position={position} scale={scale}><mesh castShadow receiveShadow position={[0, 1.8, 0]}><coneGeometry args={[2, 3.6, 8]} /><meshStandardMaterial color={color} roughness={1} /></mesh><mesh position={[0, 3.52, 0]}><coneGeometry args={[.78, 1.05, 8]} /><meshStandardMaterial color="#f6f3e8" roughness={.9} /></mesh></group>
}

function Mountains() {
  const rocks = useMemo(() => Array.from({ length: 30 }, (_, i) => ({ x: -9 + seeded(i + 44) * 10, z: .5 + seeded(i + 64) * 8, s: .13 + seeded(i + 80) * .35 })), [])
  return <group><Mountain position={[-7, 0, 4.8]} scale={1.45} color="#77728e" /><Mountain position={[-2.4, 0, 8.2]} scale={1.25} color="#8b7d9c" /><Mountain position={[-3.7, 0, 1.6]} scale={.98} color="#69758c" />
    {rocks.map((rock, i) => <mesh key={i} position={[rock.x, rock.s / 2, rock.z]} scale={[rock.s * 1.25, rock.s, rock.s]} castShadow><dodecahedronGeometry args={[1, 0]} /><meshStandardMaterial color={i % 2 ? '#5f6077' : '#817589'} roughness={1} /></mesh>)}
  </group>
}

function Tree({ x, z, size, hue }: { x: number; z: number; size: number; hue: string }) {
  return <group position={[x, 0, z]} scale={size}><mesh castShadow position={[0, .65, 0]}><cylinderGeometry args={[.13, .24, 1.3, 8]} /><meshStandardMaterial color="#704d36" /></mesh>
    <mesh castShadow position={[0, 1.43, 0]}><coneGeometry args={[1.08, 1.95, 9]} /><meshStandardMaterial color={hue} /></mesh><mesh castShadow position={[0, 2.12, 0]}><coneGeometry args={[.78, 1.45, 9]} /><meshStandardMaterial color={hue} /></mesh>
  </group>
}

function Forest() {
  const trees = useMemo(() => Array.from({ length: 76 }, (_, i) => ({ x: -.5 + seeded(i + 190) * 11, z: .5 + seeded(i + 238) * 9, size: .56 + seeded(i + 287) * .72, hue: i % 3 === 0 ? '#28734d' : i % 3 === 1 ? '#358b58' : '#236541' })), [])
  return <group>{trees.map((tree, i) => <Tree key={i} {...tree} />)}
    {Array.from({ length: 40 }, (_, i) => <Grass key={i} x={-.5 + seeded(i + 322) * 11} z={.2 + seeded(i + 366) * 9} scale={.6 + seeded(i + 400)} />)}
  </group>
}

function Plains() {
  return <group>{Array.from({ length: 65 }, (_, i) => <Grass key={i} x={7 + seeded(i + 480) * 13} z={-8 + seeded(i + 530) * 11} scale={.55 + seeded(i + 582)} />)}
    {[[18,-4],[18,2],[10,-7]].map(([x, z], index) => <group key={index} position={[x, .15, z]}><mesh position={[0,.35,0]}><coneGeometry args={[.24,.82,8]} /><meshStandardMaterial color="#d3b55a" /></mesh><mesh position={[.28,.2,.1]} scale={.1}><sphereGeometry args={[1,10,8]} /><meshStandardMaterial color="#f58e76" /></mesh></group>)}
    <mesh position={[16,.75,-4]}><boxGeometry args={[.12,1.5,.12]} /><meshStandardMaterial color="#fff9dc" /></mesh><mesh position={[16.42,1.25,-4]}><planeGeometry args={[.82,.52]} /><meshStandardMaterial color="#e65f5c" side={THREE.DoubleSide} /></mesh>
  </group>
}

function HotAirBalloon({ destination }: { destination: React.MutableRefObject<THREE.Vector3> }) {
  const balloon = useRef<THREE.Group>(null)
  useFrame(({ clock }, delta) => {
    if (!balloon.current) return
    balloon.current.position.lerp(new THREE.Vector3(destination.current.x, 6.2, destination.current.z), 1 - Math.exp(-delta * 2.2))
    balloon.current.position.y += Math.sin(clock.elapsedTime * .9) * .003
  })
  return <group ref={balloon} position={[destination.current.x, 6.2, destination.current.z]}><mesh castShadow scale={[1.08,1.38,1.08]}><sphereGeometry args={[1,28,20]} /><meshStandardMaterial color="#f4a942" roughness={.65} /></mesh>
    <mesh position={[0,.18,1.08]} scale={[.7,1.08,.12]}><sphereGeometry args={[1,24,18]} /><meshStandardMaterial color="#e86460" /></mesh>
    {[-.55,.55].flatMap((x)=>[-.46,.46].map(z=><mesh key={`${x}${z}`} position={[x,-1.55,z]} rotation={[0,0,x*.15]}><cylinderGeometry args={[.022,.022,1.35,6]} /><meshStandardMaterial color="#6d5037" /></mesh>))}<mesh position={[0,-2.18,0]}><boxGeometry args={[.78,.36,.68]} /><meshStandardMaterial color="#80573d" /></mesh>
  </group>
}

function BalloonCamera({ move }: { move: BalloonMove }) {
  const controls = useRef<React.ElementRef<typeof OrbitControls>>(null)
  const { camera } = useThree()
  const destination = useRef(new THREE.Vector3(-1, 0, -11))
  const actual = useRef(new THREE.Vector3(-1, 0, -11))
  const handled = useRef(0)
  useEffect(() => { camera.position.set(8, 12, -22) }, [camera])
  useFrame((_, delta) => {
    if (move.nonce !== handled.current) { handled.current = move.nonce; destination.current.x += move.x; destination.current.z += move.z }
    actual.current.lerp(destination.current, 1 - Math.exp(-delta * 2.0))
    if (controls.current) { controls.current.target.lerp(actual.current, 1 - Math.exp(-delta * 2.8)); controls.current.update() }
  })
  return <><HotAirBalloon destination={destination} /><OrbitControls ref={controls} enableDamping dampingFactor={.08} minDistance={7} maxDistance={34} maxPolarAngle={Math.PI / 2.06} minPolarAngle={.28} target={[-1,0,-11]} /></>
}

export function RaceWorld({ move }: { move: BalloonMove }) {
  return <Canvas shadows camera={{ position: [8,12,-22], fov: 46 }} dpr={[1,1.6]}>
    <color attach="background" args={['#8ad2e4']} /><fog attach="fog" args={['#8ad2e4', 25, 58]} /><ambientLight intensity={1.5} /><directionalLight castShadow position={[-10,18,8]} intensity={2.25} shadow-mapSize={[1024,1024]} />
    <mesh receiveShadow rotation={[-Math.PI/2,0,0]} position={[0,-.03,0]}><planeGeometry args={[70,70]} /><meshStandardMaterial color="#76b65a" roughness={1} /></mesh>
    <Marsh /><Mountains /><Forest /><Plains /><FlatRoad /><BalloonCamera move={move} />
  </Canvas>
}
