import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { TORNADO_LIFETIME, type Pickup } from './pickups'

/** Five-pointed star, built once and shared by every pickup in every mode. */
export const STAR_GEOMETRY = (() => {
  const shape = new THREE.Shape()
  for (let index = 0; index < 10; index++) {
    const radius = index % 2 === 0 ? 1 : 0.44
    const angle = (index / 10) * Math.PI * 2 - Math.PI / 2
    const x = Math.cos(angle) * radius
    const y = Math.sin(angle) * radius
    if (index === 0) shape.moveTo(x, y)
    else shape.lineTo(x, y)
  }
  shape.closePath()
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.3, bevelEnabled: true, bevelSize: 0.09, bevelThickness: 0.09, bevelSegments: 2,
  })
  geometry.center()
  return geometry
})()

/** About one dinosaur wide, so it reads as something to run into. */
const STAR_SCALE = 0.24

function Star({ pickup }: { pickup: Pickup }) {
  const spin = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    if (!spin.current) return
    const time = clock.elapsedTime
    spin.current.rotation.y = time * 2.4 + pickup.id
    spin.current.position.y = 0.46 + Math.sin(time * 3 + pickup.id) * 0.09
  })
  return (
    <group ref={spin}>
      <mesh geometry={STAR_GEOMETRY} scale={STAR_SCALE} castShadow>
        <meshStandardMaterial color="#ffd23f" emissive="#c98a12" emissiveIntensity={0.55} roughness={0.28} metalness={0.25} />
      </mesh>
      {/* Soft halo so it stays findable against bright ground. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.42, 0]}>
        <circleGeometry args={[0.34, 20]} />
        <meshBasicMaterial color="#ffe9a3" transparent opacity={0.4} depthWrite={false} />
      </mesh>
    </group>
  )
}

function Tornado() {
  const spin = useRef<THREE.Group>(null)
  // Ages itself rather than reading race time through a prop: it mounts exactly
  // when it spawns, and a prop would only refresh on the next repaint.
  const age = useRef(0)
  useFrame((_, delta) => {
    age.current += delta
    if (!spin.current) return
    spin.current.rotation.y += delta * 9
    // Spin up on arrival and shrink away at the end of its three seconds.
    const grow = Math.min(1, age.current / 0.35)
    const fade = Math.min(1, Math.max(0, (TORNADO_LIFETIME - age.current) / 0.45))
    spin.current.scale.setScalar(Math.max(0, Math.min(grow, fade)))
  })

  const rings = useMemo(() => [
    { y: 0.1, radius: 0.1, height: 0.24 },
    { y: 0.32, radius: 0.19, height: 0.26 },
    { y: 0.56, radius: 0.28, height: 0.28 },
    { y: 0.82, radius: 0.37, height: 0.3 },
  ], [])

  return (
    <group ref={spin}>
      {rings.map((ring, index) => (
        <mesh key={ring.y} position={[Math.sin(index * 1.7) * 0.05, ring.y, Math.cos(index * 1.7) * 0.05]}>
          <cylinderGeometry args={[ring.radius, ring.radius * 0.62, ring.height, 14, 1, true]} />
          <meshStandardMaterial
            color="#dbe6ef"
            transparent
            opacity={0.52 - index * 0.05}
            roughness={0.8}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      ))}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <circleGeometry args={[0.3, 18]} />
        <meshBasicMaterial color="#9fb4c6" transparent opacity={0.36} depthWrite={false} />
      </mesh>
    </group>
  )
}

export function PickupModel({ pickup }: { pickup: Pickup }) {
  return pickup.kind === 'star' ? <Star pickup={pickup} /> : <Tornado />
}
