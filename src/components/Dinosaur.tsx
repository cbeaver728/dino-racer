import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { isBiped, type DinosaurConfig, type FootType, type HeadType } from '../game/dinosaurTypes'
import { buildPalette, type DinoPalette } from '../game/palette'

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

type Vec3 = [number, number, number]

const Skin = ({ color }: { color: string }) => (
  <meshStandardMaterial color={color} roughness={0.48} metalness={0} envMapIntensity={0.55} />
)

const Bone = ({ color }: { color: string }) => (
  <meshStandardMaterial color={color} roughness={0.28} metalness={0} envMapIntensity={0.8} />
)

/** Point along a quadratic bezier, used to bend necks and tails into a curve. */
const bezier = (a: Vec3, control: Vec3, b: Vec3, t: number): Vec3 => {
  const m = 1 - t
  return [
    m * m * a[0] + 2 * m * t * control[0] + t * t * b[0],
    m * m * a[1] + 2 * m * t * control[1] + t * t * b[1],
    m * m * a[2] + 2 * m * t * control[2] + t * t * b[2],
  ]
}

/**
 * One smooth tapered tube swept along the bezier, used for necks and tails.
 *
 * An earlier version stacked overlapping spheres, but once the taper got thin
 * the spacing outgrew the radius and the limb visibly broke into beads. Sweeping
 * a real surface fixes that at any length and costs one draw call instead of ~16.
 */
function TaperedLimb({
  from, control, to, startRadius, endRadius, color, falloff = 1, segments = 30, radial = 16,
}: {
  from: Vec3
  control: Vec3
  to: Vec3
  startRadius: number
  endRadius: number
  color: string
  falloff?: number
  segments?: number
  radial?: number
}) {
  // Keyed on the values rather than the array identities, which change each render.
  const key = `${from}|${control}|${to}|${startRadius}|${endRadius}|${falloff}|${segments}|${radial}`
  const geometry = useMemo(() => {
    const a = new THREE.Vector3(...from)
    const c = new THREE.Vector3(...control)
    const b = new THREE.Vector3(...to)

    const at = (t: number) => new THREE.Vector3()
      .addScaledVector(a, (1 - t) * (1 - t))
      .addScaledVector(c, 2 * (1 - t) * t)
      .addScaledVector(b, t * t)

    const tangentAt = (t: number) => new THREE.Vector3()
      .addScaledVector(new THREE.Vector3().subVectors(c, a), 2 * (1 - t))
      .addScaledVector(new THREE.Vector3().subVectors(b, c), 2 * t)
      .normalize()

    const positions: number[] = []
    const indices: number[] = []
    // Parallel-transported frame keeps the rings from twisting along the curve.
    let normal = new THREE.Vector3(0, 1, 0)

    for (let i = 0; i <= segments; i++) {
      const t = i / segments
      const center = at(t)
      const tangent = tangentAt(t)
      const binormal = new THREE.Vector3().crossVectors(tangent, normal).normalize()
      normal = new THREE.Vector3().crossVectors(binormal, tangent).normalize()
      const radius = startRadius + (endRadius - startRadius) * Math.pow(t, falloff)

      for (let j = 0; j < radial; j++) {
        const angle = (j / radial) * Math.PI * 2
        const vertex = center.clone()
          .addScaledVector(normal, Math.cos(angle) * radius)
          .addScaledVector(binormal, Math.sin(angle) * radius)
        positions.push(vertex.x, vertex.y, vertex.z)
      }
    }

    for (let i = 0; i < segments; i++) {
      for (let j = 0; j < radial; j++) {
        const next = (j + 1) % radial
        const ring = i * radial
        const ringNext = (i + 1) * radial
        indices.push(ring + j, ringNext + j, ring + next)
        indices.push(ring + next, ringNext + j, ringNext + next)
      }
    }

    const tip = at(1)
    positions.push(tip.x, tip.y, tip.z)
    const tipIndex = positions.length / 3 - 1
    for (let j = 0; j < radial; j++) {
      indices.push(segments * radial + j, tipIndex, segments * radial + ((j + 1) % radial))
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geo.setIndex(indices)
    geo.computeVertexNormals()
    return geo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  useEffect(() => () => geometry.dispose(), [geometry])

  return (
    <mesh geometry={geometry}>
      <Skin color={color} />
    </mesh>
  )
}

function Eye({ side, head, palette }: { side: number; head: HeadType; palette: DinoPalette }) {
  const size = head === 'T-Rex' ? 0.185 : 0.16
  // Sit the socket just proud of each skull's own width, and low enough that the
  // eyeball and brow stay inside the silhouette instead of perching on top.
  const depth = head === 'Triceratops' ? 0.66 : head === 'Brachiosaurus' ? 0.5 : 0.54
  return (
    <group position={[head === 'Brachiosaurus' ? 0.12 : 0.2, 0.26, side * depth]}>
      <mesh position={[-0.03, size * 0.6, side * 0.04]} rotation={[0, 0, 0.24]} scale={[1.3, 0.44, 1.08]}>
        <sphereGeometry args={[size * 0.98, 20, 14]} />
        <Skin color={palette.shade} />
      </mesh>
      <mesh scale={[1, 1.05, 0.72]}>
        <sphereGeometry args={[size, 28, 20]} />
        <meshStandardMaterial color={palette.sclera} roughness={0.22} />
      </mesh>
      <mesh position={[0.072, 0.012, side * 0.1]}>
        <sphereGeometry args={[size * 0.48, 22, 16]} />
        <meshStandardMaterial color={palette.pupil} roughness={0.1} />
      </mesh>
      <mesh position={[size * 0.66, size * 0.38, side * 0.14]}>
        <sphereGeometry args={[size * 0.2, 12, 10]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
    </group>
  )
}

function Nostrils({ x, y, spread, palette }: { x: number; y: number; spread: number; palette: DinoPalette }) {
  return (
    <>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[x, y, side * spread]} scale={[0.6, 1, 1]}>
          <sphereGeometry args={[0.055, 14, 10]} />
          <meshStandardMaterial color={palette.pupil} roughness={0.5} />
        </mesh>
      ))}
    </>
  )
}

function Teeth({ x, y, spread, count, size, palette }: {
  x: number; y: number; spread: number; count: number; size: number; palette: DinoPalette
}) {
  return (
    <>
      {[-1, 1].map((side) => (
        Array.from({ length: count }, (_, index) => (
          <mesh
            key={`${side}-${index}`}
            position={[x - index * size * 1.5, y, side * spread]}
            rotation={[0, 0, Math.PI]}
          >
            <coneGeometry args={[size * 0.42, size * 1.5, 10]} />
            <Bone color={palette.bone} />
          </mesh>
        ))
      ))}
    </>
  )
}

function Head({ type, palette }: { type: HeadType; palette: DinoPalette }) {
  const eyes = <><Eye side={-1} head={type} palette={palette} /><Eye side={1} head={type} palette={palette} /></>

  if (type === 'Triceratops') {
    return (
      <group>
        <mesh position={[-0.28, 0.14, 0]} scale={[0.3, 1, 1.15]}>
          <sphereGeometry args={[0.85, 40, 28]} />
          <Skin color={palette.shade} />
        </mesh>
        <mesh position={[-0.21, 0.14, 0]} scale={[0.26, 0.88, 1.02]}>
          <sphereGeometry args={[0.85, 36, 26]} />
          <Skin color={palette.accent} />
        </mesh>
        <mesh scale={[0.95, 0.62, 0.78]}>
          <sphereGeometry args={[0.82, 40, 28]} />
          <Skin color={palette.base} />
        </mesh>
        <mesh position={[0.55, -0.12, 0]} scale={[0.55, 0.22, 0.62]}>
          <sphereGeometry args={[0.8, 32, 22]} />
          <Skin color={palette.belly} />
        </mesh>
        {[-0.45, 0.45].map((z) => (
          <mesh key={z} position={[0.04, 0.66, z]} rotation={[0, 0, -0.25]}>
            <coneGeometry args={[0.12, 0.68, 22]} />
            <Bone color={palette.bone} />
          </mesh>
        ))}
        <mesh position={[0.62, 0.35, 0]} rotation={[0, 0, -0.45]}>
          <coneGeometry args={[0.1, 0.52, 22]} />
          <Bone color={palette.bone} />
        </mesh>
        <Nostrils x={0.86} y={-0.02} spread={0.14} palette={palette} />
        {eyes}
      </group>
    )
  }

  if (type === 'Brachiosaurus') {
    return (
      <group>
        <mesh scale={[0.7, 0.58, 0.62]}>
          <sphereGeometry args={[0.78, 40, 28]} />
          <Skin color={palette.base} />
        </mesh>
        <mesh position={[-0.16, 0.34, 0]} scale={[0.34, 0.34, 0.42]}>
          <sphereGeometry args={[0.78, 28, 20]} />
          <Skin color={palette.accent} />
        </mesh>
        <mesh position={[0.48, -0.1, 0]} scale={[0.52, 0.2, 0.48]}>
          <sphereGeometry args={[0.75, 32, 22]} />
          <Skin color={palette.belly} />
        </mesh>
        <Nostrils x={0.6} y={0.16} spread={0.11} palette={palette} />
        {eyes}
      </group>
    )
  }

  const isRex = type === 'T-Rex'
  const isRaptor = type === 'Raptor'
  const isCrested = type === 'Parasaurolophus'

  return (
    <group>
      <mesh scale={isRex ? [1.05, 0.76, 0.76] : isRaptor ? [0.85, 0.62, 0.65] : [0.92, 0.66, 0.7]}>
        <sphereGeometry args={[0.82, 40, 28]} />
        <Skin color={palette.base} />
      </mesh>
      {/* Short and deep. The previous muzzle reached ~0.8 past the skull at a
          fifth of its height, which read as a duck bill rather than a snout. */}
      <mesh
        position={[isRex ? 0.6 : 0.62, isRex ? -0.16 : -0.12, 0]}
        scale={isRex ? [0.66, 0.42, 0.62] : [0.62, 0.34, 0.46]}
      >
        <sphereGeometry args={[0.72, 34, 24]} />
        <Skin color={palette.belly} />
      </mesh>
      {isCrested && (
        <>
          <mesh position={[-0.48, 0.54, 0]} rotation={[0, 0, -0.82]} scale={[0.32, 1, 0.38]}>
            <coneGeometry args={[0.42, 1.35, 30]} />
            <Skin color={palette.accent} />
          </mesh>
          <mesh position={[-0.62, 0.78, 0]} rotation={[0, 0, -0.82]} scale={[0.2, 0.62, 0.24]}>
            <coneGeometry args={[0.42, 1.35, 26]} />
            <Skin color={palette.accentSoft} />
          </mesh>
        </>
      )}
      {(isRex || isRaptor) && (
        <Teeth
          x={isRex ? 0.95 : 0.9}
          y={isRex ? -0.34 : -0.26}
          spread={isRex ? 0.3 : 0.22}
          count={isRex ? 4 : 3}
          size={isRex ? 0.13 : 0.1}
          palette={palette}
        />
      )}
      <Nostrils x={isRex ? 1.02 : 0.98} y={isRex ? -0.02 : 0.02} spread={0.12} palette={palette} />
      {eyes}
    </group>
  )
}

function Foot({ type, palette }: { type: FootType; palette: DinoPalette }) {
  return (
    <group>
      <mesh
        position={[0.13, 0.1, 0]}
        scale={type === 'Webbed Feet' ? [0.8, 0.22, 0.75] : [0.65, 0.28, 0.6]}
      >
        <sphereGeometry args={[0.55, 32, 22]} />
        <Skin color={type === 'Round Feet' ? palette.belly : palette.shade} />
      </mesh>
      {type === 'Clawed Feet' && [-0.2, 0, 0.2].map((z) => (
        <mesh key={z} position={[0.52, 0.08, z]} rotation={[0, 0, -Math.PI / 2]}>
          <coneGeometry args={[0.075, 0.36, 18]} />
          <Bone color={palette.bone} />
        </mesh>
      ))}
      {type === 'Webbed Feet' && (
        <>
          {[-0.26, 0, 0.26].map((z) => (
            <mesh key={z} position={[0.42, 0.08, z]} rotation={[0, 0, -Math.PI / 2]} scale={[1, 1, 0.7]}>
              <coneGeometry args={[0.07, 0.4, 16]} />
              <Skin color={palette.shade} />
            </mesh>
          ))}
          {[-0.13, 0.13].map((z) => (
            <mesh key={z} position={[0.31, 0.065, z]} scale={[0.45, 0.05, 0.25]}>
              <sphereGeometry args={[0.72, 24, 16]} />
              <meshStandardMaterial
                color={palette.accentSoft}
                transparent
                opacity={0.85}
                roughness={0.35}
                side={THREE.DoubleSide}
              />
            </mesh>
          ))}
        </>
      )}
    </group>
  )
}

function GroundLeg({ x, z, height, palette, foot }: {
  x: number; z: number; height: number; palette: DinoPalette; foot: FootType
}) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, height * 0.7, 0]} scale={[0.46, 0.56 + height * 0.08, 0.5]}>
        <sphereGeometry args={[0.62, 30, 22]} />
        <Skin color={palette.base} />
      </mesh>
      <mesh position={[0, height * 0.33, 0]}>
        <cylinderGeometry args={[0.23, 0.145, height * 0.8, 26]} />
        <Skin color={palette.shade} />
      </mesh>
      <Foot type={foot} palette={palette} />
    </group>
  )
}

/**
 * Body shell with the pale underside baked into vertex colours.
 *
 * Overlaying a second, slightly larger ellipsoid also produces a belly, but the
 * two surfaces cut through each other and leave a hard crease all the way round.
 * Shading the one shell gives a soft gradient and one less mesh.
 */
function Body({ bodySize, palette }: {
  bodySize: readonly [number, number, number]; palette: DinoPalette
}) {
  const geometry = useMemo(() => {
    const geo = new THREE.SphereGeometry(0.72, 64, 44)
    const position = geo.attributes.position
    const base = new THREE.Color(palette.base)
    const belly = new THREE.Color(palette.belly)
    const colors: number[] = []

    for (let i = 0; i < position.count; i++) {
      const height = position.getY(i) / 0.72
      const blend = THREE.MathUtils.smoothstep(height, -0.62, 0.08)
      const color = belly.clone().lerp(base, blend)
      colors.push(color.r, color.g, color.b)
    }

    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    return geo
  }, [palette.base, palette.belly])

  useEffect(() => () => geometry.dispose(), [geometry])

  return (
    <mesh geometry={geometry} scale={bodySize}>
      <meshStandardMaterial vertexColors roughness={0.48} metalness={0} envMapIntensity={0.55} />
    </mesh>
  )
}

function SkinMarkings({ config, palette, bodySize }: {
  config: DinosaurConfig; palette: DinoPalette; bodySize: readonly [number, number, number]
}) {
  if (config.skin === 'Plain') return null

  if (config.skin === 'Spotted') {
    const spots: Vec3[] = [
      [-0.46, 0.52, 0.3], [-0.08, 0.62, -0.24], [0.3, 0.5, 0.32], [0.52, 0.24, -0.3], [-0.2, 0.3, 0.5],
    ]
    return (
      <>
        {spots.map((spot, index) => {
          const position: Vec3 = [spot[0] * bodySize[0], spot[1] * bodySize[1], spot[2] * bodySize[2]]
          const direction = new THREE.Vector3(...position).normalize()
          return (
            <mesh
              key={index}
              position={[
                position[0] + direction.x * 0.02,
                position[1] + direction.y * 0.02,
                position[2] + direction.z * 0.02,
              ]}
              scale={[0.26, 0.26, 0.26]}
            >
              <sphereGeometry args={[0.72, 20, 14]} />
              <Skin color={palette.accentSoft} />
            </mesh>
          )
        })}
      </>
    )
  }

  return (
    <>
      {[-0.72, -0.34, 0.04, 0.42, 0.76].map((x) => (
        <mesh
          key={x}
          position={[x * bodySize[0] * 0.9, 0, 0]}
          rotation={[0, Math.PI / 2, 0]}
          scale={[1, bodySize[1] * 0.71, bodySize[2] * 0.57]}
        >
          <torusGeometry args={[0.72, 0.075, 16, 40]} />
          <Skin color={palette.shade} />
        </mesh>
      ))}
    </>
  )
}

function BackFeature({ config, palette, bodySize }: {
  config: DinosaurConfig; palette: DinoPalette; bodySize: readonly [number, number, number]
}) {
  if (config.feature === 'None' || config.feature === 'Horns') return null

  if (config.feature === 'Wings') {
    return (
      <>
        {[-1, 1].map((side) => (
          <group
            key={side}
            position={[-0.12, 0.4, side * bodySize[2] * 0.54]}
            rotation={[side * 0.26, 0, side * -0.14]}
          >
            {[0, 0.34, 0.67].map((offset, index) => (
              <mesh
                key={offset}
                position={[-0.35 - index * 0.16, 0.15 - index * 0.12, side * offset]}
                rotation={[side * 0.22, 0, -0.4]}
                scale={[1.15 - index * 0.15, 0.16, 0.48]}
              >
                <sphereGeometry args={[0.78, 32, 22]} />
                <Skin color={index === 0 ? palette.shade : index === 1 ? palette.accent : palette.accentSoft} />
              </mesh>
            ))}
          </group>
        ))}
      </>
    )
  }

  const plates = config.feature === 'Plates'
  const height = plates ? 0.74 : 0.66
  return (
    <>
      {[-0.62, -0.24, 0.14, 0.5].map((u, index) => {
        // Ride the ellipsoid's silhouette; a fixed height sinks the outer ones
        // inside the body on larger builds.
        const surface = bodySize[1] * 0.72 * Math.sqrt(Math.max(0, 1 - u * u))
        return (
          <mesh
            key={u}
            position={[u * bodySize[0] * 0.72, surface + height * 0.3, 0]}
            // Cones point +Y by default. The old X rotation tipped them onto
            // their sides, which read as paper darts rather than a spiny back.
            scale={plates ? [1, 1, 0.28] : [1, 1, 1]}
          >
            <coneGeometry args={[plates ? 0.42 : 0.17, height, plates ? 3 : 22]} />
            <Skin color={plates && index % 2 === 1 ? palette.accentSoft : palette.accent} />
          </mesh>
        )
      })}
    </>
  )
}

export function Dinosaur({ config }: { config: DinosaurConfig }) {
  const root = useRef<THREE.Group>(null)
  const tail = useRef<THREE.Group>(null)
  const neck = useRef<THREE.Group>(null)

  const palette = useMemo(() => buildPalette(config.color), [config.color])
  const bodySize = BODY_SIZE[config.body]
  const hindHeight = LEG_HEIGHT[config.hindLegs]
  const biped = isBiped(config)
  const frontHeight = biped ? hindHeight : FRONT_HEIGHT[config.frontLimbs as keyof typeof FRONT_HEIGHT]
  const tilt = biped ? -0.11 : Math.atan2(frontHeight - hindHeight, 1.5) * 0.65
  const bodyY = hindHeight + bodySize[1] * 0.52
  const tailLength = config.tail === 'Stubby Tail' ? 1.35 : config.tail === 'Giant Tail' ? 3.25 : 2.4

  // Head sits off the front of the body, so it has to follow the body's size
  // instead of a fixed offset — otherwise a Big body swallows its own neck.
  const longNeck = config.head === 'Brachiosaurus'
  const headPos: Vec3 = longNeck
    ? [bodySize[0] * 0.72 + 0.62, bodySize[1] * 0.6 + 1.15, 0]
    : [bodySize[0] * 0.72 + 0.55, bodySize[1] * 0.55 + 0.45, 0]
  const neckStart: Vec3 = [bodySize[0] * 0.34, bodySize[1] * 0.2, 0]
  const neckControl: Vec3 = longNeck
    ? [bodySize[0] * 0.55, headPos[1] * 0.72, 0]
    : [bodySize[0] * 0.72 + 0.1, headPos[1] * 0.52, 0]

  // Shadow flags are not inherited in three.js, so stamp every mesh once the
  // configuration changes rather than repeating the props on ~40 meshes.
  useLayoutEffect(() => {
    root.current?.traverse((object) => {
      if ((object as THREE.Mesh).isMesh) {
        object.castShadow = true
        object.receiveShadow = true
      }
    })
  }, [config])

  useFrame(({ clock }) => {
    const time = clock.elapsedTime
    if (root.current) {
      root.current.position.y = 0.04 + Math.sin(time * 2) * 0.035
      root.current.rotation.z = Math.sin(time * 1.4) * 0.012
    }
    if (tail.current) tail.current.rotation.y = Math.sin(time * 1.8) * 0.09
    if (neck.current) {
      neck.current.rotation.z = Math.sin(time * 1.6 + 0.6) * 0.035
      neck.current.rotation.y = Math.sin(time * 0.9) * 0.05
    }
  })

  return (
    <group ref={root} position={[0, 0.04, 0]}>
      {[-1, 1].map((side) => (
        <GroundLeg key={`hind-${side}`} x={-0.62} z={side * 0.56} height={hindHeight} palette={palette} foot={config.feet} />
      ))}
      {!biped && [-1, 1].map((side) => (
        <GroundLeg key={`front-${side}`} x={0.72} z={side * 0.53} height={frontHeight} palette={palette} foot={config.feet} />
      ))}

      <group position={[0, bodyY, 0]} rotation={[0, 0, tilt]}>
        <Body bodySize={bodySize} palette={palette} />
        <SkinMarkings config={config} palette={palette} bodySize={bodySize} />
        <BackFeature config={config} palette={palette} bodySize={bodySize} />

        {biped && [-1, 1].map((side) => {
          const long = config.frontLimbs === 'Long Arms'
          return (
            <group
              key={side}
              position={[bodySize[0] * 0.46, 0.18, side * bodySize[2] * 0.5]}
              rotation={[side * 0.16, 0, long ? -0.72 : -1.05]}
            >
              <mesh position={[0, -0.3, 0]} scale={[0.2, long ? 0.62 : 0.4, 0.2]}>
                <cylinderGeometry args={[0.42, 0.34, 1.2, 24]} />
                <Skin color={palette.base} />
              </mesh>
              <mesh position={[long ? 0.36 : 0.25, long ? -0.62 : -0.43, 0]} scale={[0.34, 0.16, 0.28]}>
                <sphereGeometry args={[0.55, 28, 20]} />
                <Skin color={palette.shade} />
              </mesh>
              {[-0.09, 0.09].map((z) => (
                <mesh
                  key={z}
                  position={[long ? 0.52 : 0.38, long ? -0.68 : -0.48, z]}
                  rotation={[0, 0, -1.9]}
                >
                  <coneGeometry args={[0.045, 0.2, 12]} />
                  <Bone color={palette.bone} />
                </mesh>
              ))}
            </group>
          )
        })}

        <group ref={neck}>
          <TaperedLimb
            from={neckStart}
            control={neckControl}
            to={headPos}
            startRadius={longNeck ? 0.44 : 0.5}
            endRadius={longNeck ? 0.22 : 0.3}
            color={palette.base}
            falloff={0.75}
            segments={longNeck ? 34 : 24}
          />
          <group position={headPos}>
            <Head type={config.head} palette={palette} />
            {config.feature === 'Horns' && config.head !== 'Triceratops' && [-0.36, 0.36].map((z) => (
              <mesh key={z} position={[-0.12, 0.7, z]} rotation={[0, 0, -0.2]}>
                <coneGeometry args={[0.12, 0.64, 22]} />
                <Bone color={palette.bone} />
              </mesh>
            ))}
          </group>
        </group>

        <group ref={tail} position={[-bodySize[0] * 0.58, 0.05, 0]}>
          <TaperedLimb
            from={[0, 0, 0]}
            control={[-tailLength * 0.5, 0.32, 0]}
            to={[-tailLength, 0.12, 0]}
            startRadius={0.48}
            endRadius={0.045}
            color={palette.base}
            falloff={0.85}
            segments={34}
          />
          {config.tail === 'Spiked Tail' && [0.3, 0.52, 0.72, 0.9].map((t, index) => {
            const point = bezier([0, 0, 0], [-tailLength * 0.5, 0.32, 0], [-tailLength, 0.12, 0], t)
            return (
              <mesh
                key={t}
                position={[point[0], point[1] + 0.3 - index * 0.05, point[2]]}
                rotation={[Math.PI / 2, 0, 0]}
              >
                <coneGeometry args={[0.12, 0.52 - index * 0.06, 20]} />
                <Skin color={index % 2 === 0 ? palette.accent : palette.accentSoft} />
              </mesh>
            )
          })}
        </group>
      </group>
    </group>
  )
}
