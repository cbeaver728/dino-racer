import { useEffect, useLayoutEffect, useMemo, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { isBiped, type DinosaurConfig, type FootType, type HeadType } from '../game/dinosaurTypes'
import { buildPalette, type DinoPalette } from '../game/palette'
import { createDinoSkinMaterial, type DinoSkinOptions } from '../game/dinoSkin'
import {
  bodySliceAt,
  ankleHeight,
  createLegGeometry,
  createBodyGeometry,
  createFrillGeometry,
  createPlateGeometry,
  createSweptGeometry,
  createTubeGeometry,
  profileSliceAt,
  bezier,
  type BodyDims,
  type Vec3,
} from './dinoGeometry'
import { headShape } from './headProfiles'

const BODY_SIZE = {
  Small: [1.25, 0.8, 1.65],
  Medium: [1.55, 1, 2],
  Big: [1.9, 1.2, 2.3],
} as const

/** The three reaches preserve the builder's short/normal/long silhouettes. */
const LEG_HEIGHT = { Short: 0.55, Normal: 0.95, Long: 1.42 } as const
const FRONT_HEIGHT = {
  'Short Front Legs': 0.55,
  'Normal Front Legs': 0.95,
  'Long Front Legs': 1.42,
} as const

const EYE_SCALE = 0.66

/**
 * The tail's taper, shared by the geometry and by anything mounted on it.
 *
 * Above 1 the tail holds its thickness out of the hips before tapering, which is
 * how a real one carries its muscle. Below 1 it shed most of its width in the
 * first fraction of its length and the rest read as a whip. The spikes used a
 * different exponent from the tail they sit on, so they drifted off the surface
 * along its length.
 */
const TAIL_FALLOFF = 1.18
const TAIL_TIP_RADIUS = 0.04

function Skin({ color }: { color: string }) {
  const material = useSkinMaterial({ base: color, belly: color, pattern: color, skin: 'Plain' }, [0, 0, 0])
  return <primitive object={material} attach="material" />
}

const Bone = ({ color }: { color: string }) => (
  <meshStandardMaterial color={color} roughness={0.56} metalness={0} envMapIntensity={0.4} />
)

function useDisposable<T extends { dispose(): void }>(factory: () => T, key: string) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const value = useMemo(factory, [key])
  useEffect(() => () => value.dispose(), [value])
  return value
}

/** One patterned hide material per part; the offset keeps the pattern aligned. */
function useSkinMaterial(options: DinoSkinOptions, offset: Vec3) {
  const material = useMemo(() => createDinoSkinMaterial(options), [])
  useEffect(() => () => material.dispose(), [material])
  useEffect(() => {
    material.applySkin(options)
  }, [material, options.base, options.belly, options.pattern, options.skin, options.scale])
  useEffect(() => {
    material.setPatternOffset({ x: offset[0], y: offset[1], z: offset[2] })
  }, [material, offset[0], offset[1], offset[2]])
  return material
}

function Eye({ side, shape, palette }: {
  side: number
  shape: ReturnType<typeof headShape>
  palette: DinoPalette
}) {
  const { x, y, depth } = shape.eye
  const size = shape.eye.size * EYE_SCALE
  return (
    <group position={[x, y, side * (depth - size * 0.18)]}>
      <mesh scale={[1.26, 1.04, 0.5]}>
        <sphereGeometry args={[size, 24, 16]} />
        <Skin color={palette.shade} />
      </mesh>
      <mesh position={[-0.015, size * 0.68, 0]} rotation={[0, 0, -0.12]} scale={[1.5, 0.36, 0.64]}>
        <sphereGeometry args={[size, 20, 14]} />
        <Skin color={palette.shade} />
      </mesh>
      <mesh position={[0, 0, side * size * 0.24]} scale={[1, 0.84, 0.44]}>
        <sphereGeometry args={[size, 26, 18]} />
        <meshStandardMaterial color={palette.sclera} roughness={0.22} />
      </mesh>
      <mesh position={[size * 0.1, 0, side * size * 0.57]} scale={[1, 1, 0.3]}>
        <sphereGeometry args={[size * 0.65, 24, 18]} />
        <meshStandardMaterial color={palette.iris} roughness={0.28} />
      </mesh>
      <mesh position={[size * 0.15, 0, side * size * 0.75]} scale={[0.56, 1, 0.25]}>
        <sphereGeometry args={[size * 0.45, 20, 16]} />
        <meshStandardMaterial color={palette.pupil} roughness={0.12} />
      </mesh>
      <mesh position={[size * 0.22, size * 0.24, side * size * 0.83]}>
        <sphereGeometry args={[size * 0.1, 10, 8]} />
        <meshBasicMaterial color="#fff6da" />
      </mesh>
    </group>
  )
}

function Head({ type, palette, scale, skinOptions, offset }: {
  type: HeadType; palette: DinoPalette; scale: number; skinOptions: DinoSkinOptions; offset: Vec3
}) {
  const shape = headShape(type)
  const skull = useDisposable(
    () => createSweptGeometry(shape.skull, shape.dims, 40, 34),
    `skull-${type}`,
  )
  const jaw = useDisposable(
    () => createSweptGeometry(shape.jaw, shape.jawDims, 36, 28),
    `jaw-${type}`,
  )

  const teeth = shape.toothRow
  const nostrilSlice = profileSliceAt(shape.skull, shape.dims, shape.nostril.x / shape.dims.halfLength)
  const nostrilY = THREE.MathUtils.clamp((shape.nostril.y - nostrilSlice.centerY) / nostrilSlice.radiusY, -0.95, 0.95)
  const nostrilZ = Math.sqrt(1 - nostrilY * nostrilY) * nostrilSlice.radiusZ - 0.004
  const frill = useDisposable(() => type === 'Triceratops' ? createFrillGeometry() : new THREE.BufferGeometry(), `frill-${type}`)
  const skullMaterial = useSkinMaterial({ ...skinOptions, scale }, offset)
  const jawMaterial = useSkinMaterial({ ...skinOptions, base: palette.belly, scale }, offset)
  const crest = useDisposable(() => type === 'Parasaurolophus' ? createTubeGeometry({
    from: [-0.18, 0.24, 0], control: [-0.68, 0.95, 0], to: [-1.13, 0.57, 0],
    startRadius: 0.18, endRadius: 0.055, flatten: 0.7, segments: 32,
  }) : new THREE.BufferGeometry(), `crest-${type}`)
  return (
    <group scale={scale}>
      <mesh geometry={skull} material={skullMaterial} />
      <mesh geometry={jaw} position={[0.02, shape.jawDrop, 0]} material={jawMaterial} />
      {/* Cheek muscles bridge the jaw hinge into the rear of the skull. */}
      <mesh position={[-shape.dims.halfLength * 0.5, shape.jawDrop * 0.45, 0]}
        scale={[shape.dims.halfLength * 0.43, shape.dims.halfHeight * 0.74, shape.dims.halfWidth * 0.86]}>
        <sphereGeometry args={[1, 28, 20]} />
        <Skin color={palette.base} />
      </mesh>

      {teeth && [-1, 1].map((side) => (
        Array.from({ length: teeth.count }, (_, index) => {
          // Hang from the skull's lower edge along the mouth line, following it
          // as the snout narrows. A fixed spread left the front teeth outside
          // the snout on the T-Rex.
          const along = index / Math.max(1, teeth.count - 1)
          const x = THREE.MathUtils.lerp(teeth.from, shape.dims.halfLength * 0.84, along)
          const slice = profileSliceAt(shape.skull, shape.dims, x / shape.dims.halfLength)
          return (
            <mesh
              key={`${side}-${index}`}
              position={[
                x,
                slice.centerY - slice.radiusY * 0.62,
                side * slice.radiusZ * 0.72,
              ]}
              rotation={[0, 0, Math.PI]}
            >
              <coneGeometry args={[teeth.size * 0.4, teeth.size * (1.5 - along * 0.3), 10]} />
              <Bone color={palette.bone} />
            </mesh>
          )
        })
      ))}

      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[shape.nostril.x, shape.nostril.y, side * nostrilZ]}
          scale={[1, 0.48, 0.42]}
        >
          <sphereGeometry args={[0.037, 14, 10]} />
          <meshStandardMaterial color={palette.pupil} roughness={0.5} />
        </mesh>
      ))}

      {type === 'Triceratops' && (
        <>
          <mesh geometry={frill} position={[-shape.dims.halfLength * 0.62, 0.16, 0]}>
            <Skin color={palette.shade} />
          </mesh>
          <mesh geometry={frill} position={[-shape.dims.halfLength * 0.57, 0.16, 0]} scale={[1, 0.88, 0.88]}>
            <Skin color={palette.pattern} />
          </mesh>
          {Array.from({ length: 9 }, (_, i) => {
            const angle = (i / 8) * Math.PI
            return <mesh key={`rim-${i}`}
              position={[-shape.dims.halfLength * 0.66, 0.16 + Math.sin(angle) * 0.68, Math.cos(angle) * 0.76]}
              rotation={[Math.PI / 2 - angle, 0, 0]}>
              <coneGeometry args={[0.04, 0.13, 12]} />
              <Bone color={palette.bone} />
            </mesh>
          })}
          {[-0.3, 0.3].map((z) => (
            <mesh key={z} position={[0.04, 0.42, z]} rotation={[0, 0, -0.3]}>
              <coneGeometry args={[0.085, 0.5, 20]} />
              <Bone color={palette.bone} />
            </mesh>
          ))}
          <mesh position={[0.42, 0.12, 0]} rotation={[0, 0, -0.6]}>
            <coneGeometry args={[0.07, 0.34, 20]} />
            <Bone color={palette.bone} />
          </mesh>
        </>
      )}

      {type === 'Parasaurolophus' && (
        <mesh geometry={crest}><Skin color={palette.pattern} /></mesh>
      )}

      {type === 'Brachiosaurus' && (
        <mesh position={[-0.1, 0.24, 0]} scale={[0.4, 0.42, 0.5]}>
          <sphereGeometry args={[0.5, 26, 18]} />
          <Skin color={palette.pattern} />
        </mesh>
      )}

      <Eye side={-1} shape={shape} palette={palette} />
      <Eye side={1} shape={shape} palette={palette} />
    </group>
  )
}

function Foot({ type, palette }: { type: FootType; palette: DinoPalette }) {
  return (
    <group>
      {/* Webbed feet get a small pad so the membrane is the wide part, the way a
          duck's foot reads. A full-size pad simply swallowed the web. */}
      <mesh
        position={[type === 'Webbed Feet' ? 0.08 : 0.13, 0.1, 0]}
        scale={type === 'Webbed Feet' ? [0.5, 0.22, 0.42] : type === 'Clawed Feet' ? [0.5, 0.23, 0.47] : [0.65, 0.28, 0.6]}
      >
        <sphereGeometry args={[0.55, 32, 22]} />
        <Skin color={type === 'Round Feet' ? palette.belly : palette.shade} />
      </mesh>
      {type === 'Clawed Feet' && [-0.17, 0, 0.17].map((z) => (
        <mesh key={`toe-${z}`} position={[0.3, 0.075, z]} rotation={[0, -z * 0.5, 0]} scale={[0.28, 0.078, 0.078]}>
          <sphereGeometry args={[1, 22, 14]} />
          <Skin color={palette.base} />
        </mesh>
      ))}
      {type === 'Clawed Feet' && [-0.2, 0, 0.2].map((z) => (
        <mesh key={z} position={[0.57, 0.062, z]} rotation={[0, -z * 0.5, -1.72]}>
          <coneGeometry args={[0.052, 0.24, 18]} />
          <Bone color={palette.bone} />
        </mesh>
      ))}
      {type === 'Webbed Feet' && (
        <>
          {/* One broad fan spanning the whole splay, toes riding its edge. Two
              small blobs between the toes barely read as webbing at all. */}
          <mesh position={[0.44, 0.088, 0]} scale={[0.38, 0.028, 0.52]}>
            <sphereGeometry args={[1, 36, 22]} />
            <meshStandardMaterial
              color={palette.patternSoft}
              transparent
              opacity={0.95}
              roughness={0.28}
              side={THREE.DoubleSide}
            />
          </mesh>
          {[-0.34, 0, 0.34].map((z) => (
            <mesh key={z} position={[0.58, 0.108, z]} rotation={[0, 0, -Math.PI / 2]} scale={[1, 1, 0.78]}>
              <coneGeometry args={[0.078, 0.46, 16]} />
              <Skin color={palette.shade} />
            </mesh>
          ))}
        </>
      )}
    </group>
  )
}

/**
 * The outer group sits at the hip so the leg can swing about it; everything
 * inside is offset back down to the ground. Rotating a group rooted at the foot
 * would pivot the leg around its toes instead.
 */
function GroundLeg({ x, z, height, palette, foot, geometry, material, swing }: {
  x: number
  z: number
  height: number
  palette: DinoPalette
  foot: FootType
  geometry: THREE.BufferGeometry
  material: THREE.Material
  swing?: RefObject<THREE.Group | null>
}) {
  const ankle = ankleHeight(height)
  const toes = useRef<THREE.Group>(null)
  useFrame(() => {
    // Counter-rotate the ankle during the stride so toes reach forward and
    // plant, instead of moving as one rigid piece with the hip.
    if (toes.current) toes.current.rotation.z = -(swing?.current?.rotation.z ?? 0) * 0.72
  })
  return (
    <group position={[x, height, z]} ref={swing}>
      <group position={[0, -height, 0]}>
        <mesh geometry={geometry} material={material} />
        {/* Knuckle at the ankle, so the taper meets the foot in a joint rather
            than an edge. */}
        <mesh position={[-height * 0.08, ankle, 0]} scale={[1, 0.84, 0.94]}>
          <sphereGeometry args={[0.15 + Math.min(height, 1.2) * 0.02, 24, 18]} />
          <Skin color={palette.shade} />
        </mesh>
        <group ref={toes} position={[-height * 0.08, ankle, 0]}>
          <group position={[0, -ankle, 0]}><Foot type={foot} palette={palette} /></group>
        </group>
      </group>
    </group>
  )
}

/** Short forelimb, rooted on the chest wall so it cannot sink into the torso. */
function Arm({ side, dims, long, palette }: {
  side: number; dims: BodyDims; long: boolean; palette: DinoPalette
}) {
  const slice = bodySliceAt(dims, 0.52)
  const upper = long ? 0.62 : 0.38
  const fore = long ? 0.5 : 0.3

  return (
    <group
      position={[slice.x, slice.centerY + slice.radiusY * 0.12, side * slice.radiusZ * 1.02]}
      // Negative, so each arm swings away from the flank. A positive X rotation
      // sweeps the limb toward -z, which buried the far arm inside the torso.
      rotation={[-side * 0.42, 0, long ? -0.5 : -0.85]}
    >
      <mesh position={[0, -upper * 0.5, 0]}>
        <capsuleGeometry args={[0.115, Math.max(0.05, upper - 0.23), 6, 20]} />
        <Skin color={palette.base} />
      </mesh>
      <mesh position={[0, -upper, 0]}>
        <sphereGeometry args={[0.115, 18, 14]} />
        <Skin color={palette.shade} />
      </mesh>
      <group position={[0, -upper, 0]} rotation={[0, 0, 0.75]}>
        <mesh position={[0, -fore * 0.5, 0]}>
          <capsuleGeometry args={[0.082, Math.max(0.05, fore - 0.164), 6, 18]} />
          <Skin color={palette.base} />
        </mesh>
        <mesh position={[0, -fore, 0]} scale={[0.9, 0.7, 0.8]}>
          <sphereGeometry args={[0.1, 18, 14]} />
          <Skin color={palette.shade} />
        </mesh>
        {[-0.05, 0.05].map((z) => (
          <mesh key={z} position={[0.05, -fore - 0.06, z]} rotation={[0, 0, -2.5]}>
            <coneGeometry args={[0.032, 0.16, 12]} />
            <Bone color={palette.bone} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

function BackFeature({ config, palette, dims }: {
  config: DinosaurConfig; palette: DinoPalette; dims: BodyDims
}) {
  const plateGeometry = useDisposable(() => config.feature === 'Plates' ? createPlateGeometry() : new THREE.BufferGeometry(), `dorsal-${config.feature}`)
  if (config.feature === 'None' || config.feature === 'Horns') return null

  if (config.feature === 'Wings') {
    const slice = bodySliceAt(dims, 0.1)
    return (
      <>
        {[-1, 1].map((side) => (
          <group
            key={side}
            position={[slice.x, slice.centerY + slice.radiusY * 0.45, side * slice.radiusZ * 0.86]}
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
                <Skin color={index === 2 ? palette.patternSoft : palette.pattern} />
              </mesh>
            ))}
          </group>
        ))}
      </>
    )
  }

  const plates = config.feature === 'Plates'
  const height = plates ? 0.78 : 0.6
  return (
    <>
      {[-0.55, -0.24, 0.08, 0.4].map((u, index) => {
        const slice = bodySliceAt(dims, u)
        return (
          <mesh
            key={u}
            position={[slice.x, slice.centerY + slice.radiusY + (plates ? -0.05 : height * 0.3), 0]}
            scale={plates ? [0.86, index === 1 || index === 2 ? 1 : 0.8, 1] : [1, 1, 1]}
          >
            {plates
              ? <primitive object={plateGeometry} attach="geometry" />
              : <coneGeometry args={[0.17, height, 22]} />}
            <Skin color={plates && index % 2 === 1 ? palette.patternSoft : palette.pattern} />
          </mesh>
        )
      })}
    </>
  )
}

export function Dinosaur({ config, gait }: {
  config: DinosaurConfig
  /**
   * Live running speed, 0 when standing. Read through a ref inside the frame
   * loop so a racing dinosaur animates without re-rendering every tick.
   */
  gait?: RefObject<number>
}) {
  const root = useRef<THREE.Group>(null)
  const tail = useRef<THREE.Group>(null)
  const neck = useRef<THREE.Group>(null)
  const hindLeft = useRef<THREE.Group>(null)
  const hindRight = useRef<THREE.Group>(null)
  const frontLeft = useRef<THREE.Group>(null)
  const frontRight = useRef<THREE.Group>(null)
  /** Running phases, advanced per frame so a speed change never jumps them. */
  const gaitPhase = useRef({ stride: 0, tail: 0, neck: 0, run: 0 })

  const palette = useMemo(
    () => buildPalette(config.color, config.patternColor),
    [config.color, config.patternColor],
  )
  const bodySize = BODY_SIZE[config.body]
  // An elongated ribcage and narrower flanks give the limbs room to articulate.
  const dims: BodyDims = useMemo(() => ({
    halfLength: bodySize[0] * 0.91,
    halfHeight: bodySize[1] * 0.72,
    halfWidth: bodySize[1] * 0.59,
  }), [bodySize])

  const hindHeight = LEG_HEIGHT[config.hindLegs]
  const biped = isBiped(config)
  const frontHeight = biped ? hindHeight : FRONT_HEIGHT[config.frontLimbs as keyof typeof FRONT_HEIGHT]
  const tailLength = config.tail === 'Stubby Tail' ? 1.15 : config.tail === 'Giant Tail' ? 2.9 : 2.15

  const shape = headShape(config.head)
  const longNeck = config.head === 'Brachiosaurus'
  const headScale = (longNeck ? 0.9 : config.head === 'T-Rex' ? 1.22 : 1.08) * bodySize[1]
  const skullHalf = shape.dims.halfLength * headScale
  // Hind legs carry a biped under its centre of mass, further forward than the
  // hips of a four-legged build.
  const hipU = biped ? -0.3 : -0.62
  const shoulder = bodySliceAt(dims, 0.82)
  const hip = bodySliceAt(dims, hipU)
  const tailBase = bodySliceAt(dims, -0.84)
  const frontSlice = bodySliceAt(dims, 0.62)

  /**
   * Stance: how the torso sits on its legs.
   *
   * Matching the leg-length difference exactly is geometrically right but
   * pitches the animal up to ~50 degrees at the extremes, nose in the dirt or
   * pointed at the sky. These race, so the pitch is capped to a slope a real
   * animal carries. The torso then hangs from the average of its two sockets and
   * each leg is drawn to reach its own, which keeps everything joined at any
   * pair of leg lengths — capping the angle alone would detach them.
   */
  const MAX_PITCH = 0.38
  const OVERLAP = 0.1
  const hipSocket = { x: hip.x, y: hip.centerY - hip.radiusY * 0.95 }
  const frontSocket = { x: frontSlice.x, y: frontSlice.centerY - frontSlice.radiusY * 0.95 }
  const spanX = frontSocket.x - hipSocket.x
  const spanY = frontSocket.y - hipSocket.y
  const reach = Math.hypot(spanX, spanY)
  // Solve spanX*sin + spanY*cos = rise for the angle that lands both sockets.
  const levelPitch = Math.asin(THREE.MathUtils.clamp((frontHeight - hindHeight) / reach, -1, 1))
    - Math.atan2(spanY, spanX)
  const tilt = biped ? -0.1 : THREE.MathUtils.clamp(levelPitch, -MAX_PITCH, MAX_PITCH)

  const spin = (point: { x: number; y: number }) => ({
    x: point.x * Math.cos(tilt) - point.y * Math.sin(tilt),
    y: point.x * Math.sin(tilt) + point.y * Math.cos(tilt),
  })
  const hipWorld = spin(hipSocket)
  const frontWorld = spin(frontSocket)
  const wantedMean = biped ? hindHeight : (hindHeight + frontHeight) / 2
  const socketMean = biped ? hipWorld.y : (hipWorld.y + frontWorld.y) / 2
  const bodyY = wantedMean - OVERLAP - socketMean
  const hindDraw = bodyY + hipWorld.y + OVERLAP
  const frontDraw = bodyY + frontWorld.y + OVERLAP

  const headPos: Vec3 = longNeck
    ? [dims.halfLength * 0.8 + skullHalf * 0.7, dims.halfHeight * 0.9 + 1.62, 0]
    : [dims.halfLength * 0.86 + skullHalf * 0.72, dims.halfHeight * 0.95 + 0.44, 0]
  const neckEnd: Vec3 = [headPos[0] - skullHalf * 0.68, headPos[1] - 0.04, 0]
  const neckStart: Vec3 = [shoulder.x - dims.halfLength * 0.28, shoulder.centerY, 0]
  const neckControl: Vec3 = longNeck
    ? [shoulder.x + 0.1, headPos[1] * 0.66, 0]
    : [shoulder.x + 0.42, headPos[1] * 0.6, 0]

  const skinOptions: DinoSkinOptions = {
    base: palette.base,
    belly: palette.belly,
    pattern: palette.pattern,
    skin: config.skin,
  }

  const bodyGeometry = useDisposable(
    () => createBodyGeometry(dims),
    `body-${dims.halfLength}-${dims.halfHeight}-${dims.halfWidth}`,
  )
  // One geometry per limb length, shared by the pair that uses it.
  const hindLegGeometry = useDisposable(() => createLegGeometry(hindDraw), `hind-leg-${hindDraw.toFixed(3)}`)
  const frontLegGeometry = useDisposable(() => createLegGeometry(frontDraw), `front-leg-${frontDraw.toFixed(3)}`)

  /*
   * Limbs wear the same hide as the torso.
   *
   * They used to be painted a flat base colour, so a spotted or striped
   * dinosaur had a patterned body bolted onto plain legs — the seam was obvious
   * and it was most of what made the build look unfinished. The offsets place
   * each part back into the body's pattern space so the markings run on across
   * the join. The two sides of a pair share an offset: only the stripe wobble
   * depends on z, and it is far too small to see.
   */
  const hindLegMaterial = useSkinMaterial(skinOptions, [hipWorld.x, 0, 0])
  const frontLegMaterial = useSkinMaterial(skinOptions, [frontWorld.x, 0, 0])
  const bodyMaterial = useSkinMaterial(skinOptions, [0, 0, 0])

  const neckGeometry = useDisposable(() => createTubeGeometry({
    from: neckStart,
    control: neckControl,
    to: neckEnd,
    startRadius: longNeck ? dims.halfHeight * 0.66 : dims.halfHeight * 0.8,
    endRadius: (longNeck ? 0.2 : 0.3) * headScale,
    falloff: 0.7,
    segments: longNeck ? 36 : 26,
  }), `neck-${config.head}-${dims.halfLength}-${dims.halfHeight}-${headScale}`)
  const neckMaterial = useSkinMaterial(skinOptions, [0, 0, 0])

  // The tail carries muscle out of the hips before thinning to its tip.
  const tailStartRadius = Math.min(tailBase.radiusY * 0.9, dims.halfHeight * 0.64)
  /** The tail's half-thickness at t along its length, for mounting spikes. */
  const tailRadiusAt = (t: number) =>
    tailStartRadius + (TAIL_TIP_RADIUS - tailStartRadius) * Math.pow(t, TAIL_FALLOFF)
  const tailGeometry = useDisposable(() => createTubeGeometry({
    from: [0, 0, 0],
    control: [-tailLength * 0.5, tailLength * 0.13, 0],
    to: [-tailLength, tailLength * 0.05, 0],
    startRadius: tailStartRadius,
    endRadius: TAIL_TIP_RADIUS,
    falloff: TAIL_FALLOFF,
    /*
     * Deeper than it is wide, the way a real tail is built. Seen from directly
     * behind — which is most of a race — a round tube reads as a length of pipe;
     * a standing oval reads as an animal.
     */
    flatten: 0.78,
    segments: 44,
    radial: 34,
  }), `tail-${tailLength}-${tailStartRadius}`)
  const tailMaterial = useSkinMaterial(skinOptions, [tailBase.x, tailBase.centerY, 0])

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

  useFrame(({ clock }, rawDelta) => {
    const time = clock.elapsedTime
    const delta = Math.min(rawDelta, 0.05)
    const targetRun = Math.min(1.35, Math.max(0, gait?.current ?? 0))
    const phase = gaitPhase.current
    phase.run = THREE.MathUtils.damp(phase.run, targetRun, 7, delta)
    const run = phase.run

    /*
     * Gait phases advance by the frame's own step rather than being recomputed
     * as elapsed time times the current frequency.
     *
     * The old `time * (5 + run * 7)` made the phase jump every time the speed
     * changed, and the jump grew with elapsed time: half a minute into a race a
     * terrain change or a star boost moved the phase by radians in a single
     * frame, so the legs whipped round instead of swinging. Accumulating keeps
     * the stride continuous no matter how the speed moves.
     */
    phase.stride += delta * (5 + run * 7)
    phase.tail += delta * (1.8 + run * 4)
    phase.neck += delta * (1.6 + run * 3)

    // Legs swing about the hips on a diagonal gait; the pair on one diagonal
    // reaches forward while the other drives back.
    const stride = phase.stride
    const swing = run * 0.48
    const bounce = run * 0.065
    if (hindLeft.current) hindLeft.current.rotation.z = Math.sin(stride) * swing
    if (hindRight.current) hindRight.current.rotation.z = Math.sin(stride + Math.PI) * swing
    if (frontLeft.current) frontLeft.current.rotation.z = Math.sin(stride + Math.PI) * swing
    if (frontRight.current) frontRight.current.rotation.z = Math.sin(stride) * swing

    if (root.current) {
      root.current.position.y = 0.055 + Math.sin(time * 1.7) * 0.008
        + (1 - Math.cos(stride * 2)) * 0.5 * bounce
      root.current.rotation.z = Math.sin(time * 1.4) * 0.005 - run * 0.025
    }
    if (tail.current) tail.current.rotation.y = Math.sin(phase.tail) * (0.055 + run * 0.085)
    if (neck.current) {
      neck.current.rotation.z = Math.sin(phase.neck + 0.6) * (0.018 + run * 0.018)
      neck.current.rotation.y = Math.sin(time * 0.9) * 0.03 * Math.max(0, 1 - run)
    }
  })

  const legZ = hip.radiusZ * 0.68

  return (
    <group ref={root} position={[0, 0.04, 0]}>
      {[-1, 1].map((side) => (
        <GroundLeg
          key={`hind-${side}`}
          x={hipWorld.x}
          z={side * legZ}
          height={hindDraw}
          palette={palette}
          foot={config.feet}
          geometry={hindLegGeometry}
          material={hindLegMaterial}
          swing={side < 0 ? hindLeft : hindRight}
        />
      ))}
      {!biped && [-1, 1].map((side) => (
        <GroundLeg
          key={`front-${side}`}
          x={frontWorld.x}
          z={side * frontSlice.radiusZ * 0.62}
          height={frontDraw}
          palette={palette}
          foot={config.feet}
          geometry={frontLegGeometry}
          material={frontLegMaterial}
          swing={side < 0 ? frontLeft : frontRight}
        />
      ))}

      <group position={[0, bodyY, 0]} rotation={[0, 0, tilt]}>
        <mesh geometry={bodyGeometry} material={bodyMaterial} />
        <BackFeature config={config} palette={palette} dims={dims} />

        {biped && [-1, 1].map((side) => (
          <Arm
            key={side}
            side={side}
            dims={dims}
            long={config.frontLimbs === 'Long Arms'}
            palette={palette}
          />
        ))}

        <group ref={neck}>
          <mesh geometry={neckGeometry} material={neckMaterial} />
          <group position={headPos} rotation={[0, 0, -0.1]}>
            <Head type={config.head} palette={palette} scale={headScale} skinOptions={skinOptions} offset={headPos} />
            {config.feature === 'Horns' && config.head !== 'Triceratops' && (() => {
              // Anchor on the skull's own surface at its horn station. Fixed
              // coordinates buried these, or crossed the Parasaurolophus crest.
              const slice = profileSliceAt(shape.skull, shape.dims, shape.hornU)
              const height = 0.5
              return [-1, 1].map((side) => (
                <mesh
                  key={side}
                  position={[
                    slice.x * headScale,
                    (slice.centerY + slice.radiusY * 0.82 + height * 0.34) * headScale,
                    side * slice.radiusZ * 0.52 * headScale,
                  ]}
                  rotation={[side * -0.24, 0, -0.16]}
                  scale={headScale}
                >
                  <coneGeometry args={[0.09, height, 22]} />
                  <Bone color={palette.bone} />
                </mesh>
              ))
            })()}
          </group>
        </group>

        <group ref={tail} position={[tailBase.x, tailBase.centerY, 0]}>
          <mesh geometry={tailGeometry} material={tailMaterial} />
          {config.tail === 'Spiked Tail' && [0.28, 0.48, 0.67, 0.84].map((t) => {
            const point = bezier(
              [0, 0, 0],
              [-tailLength * 0.5, tailLength * 0.13, 0],
              [-tailLength, tailLength * 0.05, 0],
              t,
            )
            const radius = tailRadiusAt(t)
            // Sized off the tail they sit on rather than in absolute units, so
            // a stubby tail gets small spikes instead of the giant ones a fixed
            // size gave it once tails got shorter.
            const size = Math.max(0.1, radius * 1.75)
            return (
              <mesh
                key={t}
                // Spikes stand up off the spine. They previously carried an X
                // rotation that laid them flat out to the sides.
                position={[point[0], point[1] + radius * 0.75 + size * 0.32, 0]}
                rotation={[0, 0, 0.32]}
              >
                <coneGeometry args={[size * 0.28, size, 20]} />
                <Skin color={palette.pattern} />
              </mesh>
            )
          })}
        </group>
      </group>
    </group>
  )
}
