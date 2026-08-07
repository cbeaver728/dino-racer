import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { isBiped, type DinosaurConfig, type FootType, type HeadType } from '../game/dinosaurTypes'

const BODY_SIZE = {
  Small: [1.25, 0.8, 1.65],
  Medium: [1.55, 1, 2],
  Big: [1.9, 1.2, 2.3],
} as const

const LEG_HEIGHT = { Short: 0.75, Normal: 1.05, Long: 1.4 } as const
const FRONT_HEIGHT = {
  'Short Front Legs': 0.75,
  'Normal Front Legs': 1.05,
  'Long Front Legs': 1.4,
} as const

function DinoMaterial({ color }: { color: string }) {
  return <meshStandardMaterial color={color} roughness={0.6} metalness={0.02} />
}

function Eye({ side, head }: { side: number; head: HeadType }) {
  const eyeSize = head === 'T-Rex' ? 0.17 : 0.15
  return (
    <group position={[0.2, 0.35, side * 0.56]}>
      <mesh scale={[1, 1.05, 0.7]}>
        <sphereGeometry args={[eyeSize, 24, 18]} />
        <meshStandardMaterial color="#fffdf4" roughness={0.4} />
      </mesh>
      <mesh position={[0.075, 0.01, side * 0.105]}>
        <sphereGeometry args={[eyeSize * 0.45, 20, 16]} />
        <meshStandardMaterial color="#162536" roughness={0.25} />
      </mesh>
    </group>
  )
}

function Head({ type, color }: { type: HeadType; color: string }) {
  const cream = '#f5ddb4'

  if (type === 'Triceratops') {
    return (
      <group>
        <mesh position={[-0.25, 0.12, 0]} scale={[0.32, 0.95, 1.1]}>
          <sphereGeometry args={[0.85, 32, 24]} />
          <DinoMaterial color={color} />
        </mesh>
        <mesh scale={[0.95, 0.62, 0.78]}>
          <sphereGeometry args={[0.82, 32, 24]} />
          <DinoMaterial color={color} />
        </mesh>
        <mesh position={[0.55, -0.12, 0]} scale={[0.55, 0.22, 0.62]}>
          <sphereGeometry args={[0.8, 28, 20]} />
          <meshStandardMaterial color={cream} roughness={0.7} />
        </mesh>
        {[-0.45, 0.45].map((z) => (
          <mesh key={z} position={[0.04, 0.66, z]} rotation={[0, 0, -0.25]}>
            <coneGeometry args={[0.12, 0.65, 20]} />
            <meshStandardMaterial color="#fff0c9" roughness={0.8} />
          </mesh>
        ))}
        <mesh position={[0.62, 0.35, 0]} rotation={[0, 0, -0.45]}>
          <coneGeometry args={[0.1, 0.5, 20]} />
          <meshStandardMaterial color="#fff0c9" roughness={0.8} />
        </mesh>
        <Eye side={-1} head={type} /><Eye side={1} head={type} />
      </group>
    )
  }

  if (type === 'Brachiosaurus') {
    return (
      <group>
        <mesh scale={[0.7, 0.58, 0.62]}>
          <sphereGeometry args={[0.78, 32, 24]} />
          <DinoMaterial color={color} />
        </mesh>
        <mesh position={[0.48, -0.1, 0]} scale={[0.52, 0.2, 0.48]}>
          <sphereGeometry args={[0.75, 28, 20]} />
          <meshStandardMaterial color={cream} roughness={0.7} />
        </mesh>
        <Eye side={-1} head={type} /><Eye side={1} head={type} />
      </group>
    )
  }

  const isRaptor = type === 'Raptor'
  const isRex = type === 'T-Rex'
  return (
    <group>
      <mesh scale={isRex ? [1.05, 0.76, 0.76] : isRaptor ? [0.85, 0.62, 0.65] : [0.92, 0.66, 0.7]}>
        <sphereGeometry args={[0.82, 32, 24]} />
        <DinoMaterial color={color} />
      </mesh>
      <mesh position={[isRex ? 0.72 : 0.78, -0.14, 0]} scale={isRex ? [0.78, 0.28, 0.7] : [0.9, 0.22, 0.56]}>
        <sphereGeometry args={[0.72, 30, 22]} />
        <meshStandardMaterial color={cream} roughness={0.65} />
      </mesh>
      {type === 'Parasaurolophus' && (
        <mesh position={[-0.48, 0.54, 0]} rotation={[0, 0, -0.82]} scale={[0.32, 1, 0.38]}>
          <coneGeometry args={[0.42, 1.35, 28]} />
          <DinoMaterial color="#efb947" />
        </mesh>
      )}
      <Eye side={-1} head={type} /><Eye side={1} head={type} />
    </group>
  )
}

function Foot({ type, color }: { type: FootType; color: string }) {
  return (
    <group>
      <mesh position={[0.13, 0.1, 0]} scale={type === 'Webbed Feet' ? [0.8, 0.22, 0.75] : [0.65, 0.28, 0.6]}>
        <sphereGeometry args={[0.55, 28, 20]} />
        <DinoMaterial color={type === 'Round Feet' ? '#f3dfb6' : color} />
      </mesh>
      {type === 'Clawed Feet' && [-0.2, 0, 0.2].map((z) => (
        <mesh key={z} position={[0.52, 0.08, z]} rotation={[0, 0, -Math.PI / 2]}>
          <coneGeometry args={[0.075, 0.34, 18]} />
          <meshStandardMaterial color="#fff0ce" roughness={0.75} />
        </mesh>
      ))}
      {type === 'Webbed Feet' && (
        <>
          {[-0.26, 0, 0.26].map((z) => (
            <mesh key={z} position={[0.42, 0.08, z]} rotation={[0, 0, -Math.PI / 2]} scale={[1, 1, 0.7]}>
              <coneGeometry args={[0.07, 0.4, 16]} />
              <DinoMaterial color={color} />
            </mesh>
          ))}
          {[-0.13, 0.13].map((z) => (
            <mesh key={z} position={[0.31, 0.065, z]} scale={[0.45, 0.05, 0.25]}>
              <sphereGeometry args={[0.72, 22, 14]} />
              <meshStandardMaterial color={color} transparent opacity={0.82} side={THREE.DoubleSide} />
            </mesh>
          ))}
        </>
      )}
    </group>
  )
}

function GroundLeg({ x, z, height, color, foot }: { x: number; z: number; height: number; color: string; foot: FootType }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, height * 0.5, 0]} scale={[0.38, height * 0.5, 0.38]}>
        <cylinderGeometry args={[0.48, 0.62, 2, 28]} />
        <DinoMaterial color={color} />
      </mesh>
      <mesh position={[0, height, 0]} scale={[0.42, 0.4, 0.42]}>
        <sphereGeometry args={[0.55, 28, 20]} />
        <DinoMaterial color={color} />
      </mesh>
      <Foot type={foot} color={color} />
    </group>
  )
}

function SkinMarkings({ config, bodySize }: { config: DinosaurConfig; bodySize: readonly [number, number, number] }) {
  if (config.skin === 'Plain') return null
  if (config.skin === 'Spotted') {
    const spots = [[-0.7, 0.5, 0.63], [-0.15, 0.72, 0.72], [0.45, 0.55, 0.67], [0.78, 0.18, 0.48]]
    return <>{spots.map((position, index) => (
      <mesh key={index} position={position as [number, number, number]} scale={[0.3, 0.16, 0.08]}>
        <sphereGeometry args={[1, 24, 16]} />
        <meshStandardMaterial color="#fff4b8" transparent opacity={0.65} roughness={0.65} />
      </mesh>
    ))}</>
  }
  return <>{[-0.72, -0.34, 0.04, 0.42, 0.76].map((x) => (
    <mesh key={x} position={[x, 0, 0]} rotation={[0, Math.PI / 2, 0]} scale={[1, bodySize[1] * 0.7, bodySize[2] * 0.56]}>
      <torusGeometry args={[0.72, 0.07, 14, 36]} />
      <meshStandardMaterial color="#244b58" transparent opacity={0.36} roughness={0.8} />
    </mesh>
  ))}</>
}

function BackFeature({ config, bodySize }: { config: DinosaurConfig; bodySize: readonly [number, number, number] }) {
  if (config.feature === 'None' || config.feature === 'Horns') return null
  if (config.feature === 'Wings') {
    return <>{[-1, 1].map((side) => (
      <group key={side} position={[-0.12, 0.4, side * bodySize[2] * 0.54]} rotation={[side * 0.26, 0, side * -0.14]}>
        {[0, 0.34, 0.67].map((offset, index) => (
          <mesh key={offset} position={[-0.35 - index * 0.16, 0.15 - index * 0.12, side * offset]} rotation={[side * 0.22, 0, -0.4]} scale={[1.15 - index * 0.15, 0.16, 0.48]}>
            <sphereGeometry args={[0.78, 28, 18]} />
            <meshStandardMaterial color={index === 0 ? config.color : '#f4c95d'} roughness={0.68} />
          </mesh>
        ))}
      </group>
    ))}</>
  }
  return <>{[-0.8, -0.38, 0.04, 0.46].map((x) => (
    <mesh key={x} position={[x, bodySize[1] * 0.64, 0]} rotation={[Math.PI / 2, 0, 0]}>
      <coneGeometry args={[config.feature === 'Plates' ? 0.34 : 0.17, config.feature === 'Plates' ? 0.72 : 0.65, config.feature === 'Plates' ? 3 : 20]} />
      <meshStandardMaterial color="#ffd45e" roughness={0.72} />
    </mesh>
  ))}</>
}

export function Dinosaur({ config }: { config: DinosaurConfig }) {
  const root = useRef<THREE.Group>(null)
  const tail = useRef<THREE.Group>(null)
  const bodySize = BODY_SIZE[config.body]
  const hindHeight = LEG_HEIGHT[config.hindLegs]
  const biped = isBiped(config)
  const frontHeight = biped ? hindHeight : FRONT_HEIGHT[config.frontLimbs as keyof typeof FRONT_HEIGHT]
  const tilt = biped ? -0.11 : Math.atan2(frontHeight - hindHeight, 1.5) * 0.65
  const bodyY = hindHeight + bodySize[1] * 0.52
  const tailLength = config.tail === 'Stubby Tail' ? 1.35 : config.tail === 'Giant Tail' ? 3.25 : 2.4

  useFrame(({ clock }) => {
    const time = clock.elapsedTime
    if (root.current) {
      root.current.position.y = 0.04 + Math.sin(time * 2) * 0.035
      root.current.rotation.z = Math.sin(time * 1.4) * 0.012
    }
    if (tail.current) tail.current.rotation.y = Math.sin(time * 1.8) * 0.09
  })

  return (
    <group ref={root} position={[0, 0.04, 0]}>
      {[-1, 1].map((side) => <GroundLeg key={`hind-${side}`} x={-0.62} z={side * 0.56} height={hindHeight} color={config.color} foot={config.feet} />)}
      {!biped && [-1, 1].map((side) => <GroundLeg key={`front-${side}`} x={0.72} z={side * 0.53} height={frontHeight} color={config.color} foot={config.feet} />)}

      <group position={[0, bodyY, 0]} rotation={[0, 0, tilt]}>
        <mesh scale={bodySize}>
          <sphereGeometry args={[0.72, 40, 28]} />
          <DinoMaterial color={config.color} />
        </mesh>
        <SkinMarkings config={config} bodySize={bodySize} />
        <BackFeature config={config} bodySize={bodySize} />

        {biped && [-1, 1].map((side) => {
          const long = config.frontLimbs === 'Long Arms'
          return (
            <group key={side} position={[0.72, 0.18, side * bodySize[2] * 0.5]} rotation={[side * 0.16, 0, long ? -0.72 : -1.05]}>
              <mesh position={[0, -0.3, 0]} scale={[0.2, long ? 0.62 : 0.4, 0.2]}>
                <cylinderGeometry args={[0.42, 0.34, 1.2, 24]} />
                <DinoMaterial color={config.color} />
              </mesh>
              <mesh position={[long ? 0.36 : 0.25, long ? -0.62 : -0.43, 0]} scale={[0.34, 0.16, 0.28]}>
                <sphereGeometry args={[0.55, 24, 18]} />
                <DinoMaterial color={config.color} />
              </mesh>
            </group>
          )
        })}

        <mesh position={[1.1, 0.5, 0]} rotation={[0, 0, -0.35]} scale={[0.54, config.head === 'Brachiosaurus' ? 1.65 : 0.88, 0.54]}>
          <cylinderGeometry args={[0.4, 0.54, 1.35, 32]} />
          <DinoMaterial color={config.color} />
        </mesh>
        <group position={config.head === 'Brachiosaurus' ? [1.72, 1.75, 0] : [1.64, 1.02, 0]}>
          <Head type={config.head} color={config.color} />
          {config.feature === 'Horns' && config.head !== 'Triceratops' && [-0.36, 0.36].map((z) => (
            <mesh key={z} position={[-0.12, 0.7, z]} rotation={[0, 0, -0.2]}>
              <coneGeometry args={[0.12, 0.62, 20]} />
              <meshStandardMaterial color="#fff0c9" roughness={0.8} />
            </mesh>
          ))}
        </group>

        <group ref={tail} position={[-bodySize[0] * 0.62, 0.05, 0]}>
          <mesh position={[-tailLength * 0.47, 0, 0]} rotation={[0, 0, Math.PI / 2]} scale={[1, 1, 1]}>
            <coneGeometry args={[0.5, tailLength, 32]} />
            <DinoMaterial color={config.color} />
          </mesh>
          {config.tail === 'Spiked Tail' && [0.28, 0.68, 1.08, 1.48].map((distance, index) => (
            <mesh key={distance} position={[-distance, 0.38 - index * 0.06, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <coneGeometry args={[0.12, 0.5 - index * 0.05, 18]} />
              <meshStandardMaterial color="#ffd45e" roughness={0.75} />
            </mesh>
          ))}
        </group>
      </group>
    </group>
  )
}
