import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { isBiped, type DinosaurConfig, type FootType, type HeadType } from '../game/dinosaurTypes'
import { buildPalette, type DinoPalette } from '../game/palette'
import { createDinoSkinMaterial, type DinoSkinOptions } from '../game/dinoSkin'
import {
  bodySliceAt,
  createBodyGeometry,
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

// Wide spread on purpose: at 0.75/1.05/1.4 the three choices were nearly
// indistinguishable, so picking legs felt like it did nothing.
const LEG_HEIGHT = { Short: 0.5, Normal: 1.05, Long: 1.85 } as const
const FRONT_HEIGHT = {
  'Short Front Legs': 0.5,
  'Normal Front Legs': 1.05,
  'Long Front Legs': 1.85,
} as const

const Skin = ({ color }: { color: string }) => (
  <meshStandardMaterial color={color} roughness={0.48} metalness={0} envMapIntensity={0.55} />
)

const Bone = ({ color }: { color: string }) => (
  <meshStandardMaterial color={color} roughness={0.28} metalness={0} envMapIntensity={0.8} />
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
  }, [material, options.base, options.belly, options.pattern, options.skin])
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
  const { x, y, depth, size } = shape.eye
  return (
    <group position={[x, y, side * depth]}>
      <mesh position={[-0.02, size * 0.62, side * 0.03]} rotation={[0, 0, 0.22]} scale={[1.35, 0.42, 1.05]}>
        <sphereGeometry args={[size, 20, 14]} />
        <Skin color={palette.shade} />
      </mesh>
      <mesh scale={[1, 1.05, 0.72]}>
        <sphereGeometry args={[size, 26, 18]} />
        <meshStandardMaterial color={palette.sclera} roughness={0.22} />
      </mesh>
      <mesh position={[size * 0.42, 0.01, side * 0.1]}>
        <sphereGeometry args={[size * 0.46, 20, 14]} />
        <meshStandardMaterial color={palette.pupil} roughness={0.1} />
      </mesh>
      <mesh position={[size * 0.62, size * 0.36, side * 0.14]}>
        <sphereGeometry args={[size * 0.19, 12, 10]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
    </group>
  )
}

function Head({ type, palette, scale }: { type: HeadType; palette: DinoPalette; scale: number }) {
  const shape = headShape(type)
  const skull = useDisposable(
    () => createSweptGeometry(shape.skull, shape.dims, 36, 26),
    `skull-${type}`,
  )
  const jaw = useDisposable(
    () => createSweptGeometry(shape.jaw, shape.jawDims, 32, 22),
    `jaw-${type}`,
  )

  const teeth = shape.toothRow
  return (
    <group scale={scale}>
      <mesh geometry={skull}>
        <Skin color={palette.base} />
      </mesh>
      <mesh geometry={jaw} position={[0.02, shape.jawDrop, 0]}>
        <Skin color={palette.belly} />
      </mesh>

      {teeth && [-1, 1].map((side) => (
        Array.from({ length: teeth.count }, (_, index) => {
          // Hang from the skull's lower edge along the mouth line, following it
          // as the snout narrows. A fixed spread left the front teeth outside
          // the snout on the T-Rex.
          const x = teeth.from + index * teeth.size * 1.7
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
              <coneGeometry args={[teeth.size * 0.4, teeth.size * 1.5, 10]} />
              <Bone color={palette.bone} />
            </mesh>
          )
        })
      ))}

      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[shape.nostril.x, shape.nostril.y, side * shape.nostril.spread]}
          scale={[0.6, 1, 1]}
        >
          <sphereGeometry args={[0.05, 14, 10]} />
          <meshStandardMaterial color={palette.pupil} roughness={0.5} />
        </mesh>
      ))}

      {type === 'Triceratops' && (
        <>
          <mesh position={[-shape.dims.halfLength * 0.62, 0.16, 0]} scale={[0.16, 1.15, 1.3]}>
            <sphereGeometry args={[0.6, 30, 22]} />
            <Skin color={palette.shade} />
          </mesh>
          <mesh position={[-shape.dims.halfLength * 0.54, 0.16, 0]} scale={[0.12, 1.0, 1.14]}>
            <sphereGeometry args={[0.6, 28, 20]} />
            <Skin color={palette.pattern} />
          </mesh>
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
        <>
          <mesh position={[-0.5, 0.42, 0]} rotation={[0, 0, -0.95]} scale={[0.34, 1, 0.4]}>
            <coneGeometry args={[0.4, 1.3, 28]} />
            <Skin color={palette.pattern} />
          </mesh>
          <mesh position={[-0.66, 0.66, 0]} rotation={[0, 0, -0.95]} scale={[0.2, 0.6, 0.24]}>
            <coneGeometry args={[0.4, 1.3, 24]} />
            <Skin color={palette.patternSoft} />
          </mesh>
        </>
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
                color={palette.patternSoft}
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
        <cylinderGeometry args={[0.14, 0.11, upper, 20]} />
        <Skin color={palette.base} />
      </mesh>
      <mesh position={[0, -upper, 0]}>
        <sphereGeometry args={[0.115, 18, 14]} />
        <Skin color={palette.shade} />
      </mesh>
      <group position={[0, -upper, 0]} rotation={[0, 0, 0.75]}>
        <mesh position={[0, -fore * 0.5, 0]}>
          <cylinderGeometry args={[0.1, 0.075, fore, 18]} />
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
            position={[slice.x, slice.centerY + slice.radiusY + height * 0.3, 0]}
            scale={plates ? [1, 1, 0.26] : [1, 1, 1]}
          >
            <coneGeometry args={[plates ? 0.42 : 0.17, height, plates ? 3 : 22]} />
            <Skin color={plates && index % 2 === 1 ? palette.patternSoft : palette.pattern} />
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

  const palette = useMemo(
    () => buildPalette(config.color, config.patternColor),
    [config.color, config.patternColor],
  )
  const bodySize = BODY_SIZE[config.body]
  const dims: BodyDims = useMemo(() => ({
    halfLength: bodySize[0] * 0.82,
    halfHeight: bodySize[1] * 0.72,
    halfWidth: bodySize[1] * 0.62,
  }), [bodySize])

  const hindHeight = LEG_HEIGHT[config.hindLegs]
  const biped = isBiped(config)
  const frontHeight = biped ? hindHeight : FRONT_HEIGHT[config.frontLimbs as keyof typeof FRONT_HEIGHT]
  const tailLength = config.tail === 'Stubby Tail' ? 1.5 : config.tail === 'Giant Tail' ? 3.4 : 2.5

  const shape = headShape(config.head)
  const longNeck = config.head === 'Brachiosaurus'
  // A fixed head on a scaling torso looked pin-headed on the Big build. Kids'
  // toys also read better slightly large-headed, hence the 1.25.
  const headScale = 1.25 * bodySize[1]
  const skullHalf = shape.dims.halfLength * headScale
  // Hind legs carry a biped under its centre of mass, further forward than the
  // hips of a four-legged build.
  const hipU = biped ? -0.3 : -0.55
  const shoulder = bodySliceAt(dims, 0.82)
  const hip = bodySliceAt(dims, hipU)
  const tailBase = bodySliceAt(dims, -0.84)
  const frontSlice = bodySliceAt(dims, 0.55)

  /**
   * Sit the torso on its legs rather than at a height derived from the hind
   * legs alone. Solving the tilt from where the two sockets actually are keeps
   * the body attached however far apart the leg lengths get; deriving it from
   * hindHeight only left the body floating once the range widened.
   */
  // Near the underside, not mid-torso: the socket height is what gets planted on
  // the leg tops, so a socket inside the body sinks the whole animal onto them.
  const hipSocket = { x: hip.x, y: hip.centerY - hip.radiusY * 0.95 }
  const frontSocket = { x: frontSlice.x, y: frontSlice.centerY - frontSlice.radiusY * 0.95 }
  const spanX = frontSocket.x - hipSocket.x
  const spanY = frontSocket.y - hipSocket.y
  const reach = Math.hypot(spanX, spanY)
  // Solve spanX*sin+spanY*cos = rise for the angle that lands both sockets.
  const tilt = biped
    ? -0.1
    : Math.asin(THREE.MathUtils.clamp((frontHeight - hindHeight) / reach, -1, 1))
      - Math.atan2(spanY, spanX)

  const spin = (point: { x: number; y: number }) => ({
    x: point.x * Math.cos(tilt) - point.y * Math.sin(tilt),
    y: point.x * Math.sin(tilt) + point.y * Math.cos(tilt),
  })
  const hipWorld = spin(hipSocket)
  const frontWorld = spin(frontSocket)
  const bodyY = hindHeight - 0.1 - hipWorld.y

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
    pattern: config.patternColor,
    skin: config.skin,
  }

  const bodyGeometry = useDisposable(
    () => createBodyGeometry(dims),
    `body-${dims.halfLength}-${dims.halfHeight}-${dims.halfWidth}`,
  )
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

  const tailStartRadius = tailBase.radiusY * 1.02
  const tailGeometry = useDisposable(() => createTubeGeometry({
    from: [0, 0, 0],
    control: [-tailLength * 0.5, tailLength * 0.13, 0],
    to: [-tailLength, tailLength * 0.05, 0],
    startRadius: tailStartRadius,
    endRadius: 0.045,
    falloff: 0.82,
    flatten: 0.82,
    segments: 36,
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

  const legZ = hip.radiusZ * 0.95

  return (
    <group ref={root} position={[0, 0.04, 0]}>
      {[-1, 1].map((side) => (
        <GroundLeg
          key={`hind-${side}`}
          x={hipWorld.x}
          z={side * legZ}
          height={hindHeight}
          palette={palette}
          foot={config.feet}
        />
      ))}
      {!biped && [-1, 1].map((side) => (
        <GroundLeg
          key={`front-${side}`}
          x={frontWorld.x}
          z={side * frontSlice.radiusZ * 0.95}
          height={frontHeight}
          palette={palette}
          foot={config.feet}
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
            <Head type={config.head} palette={palette} scale={headScale} />
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
            const radius = tailStartRadius + (0.045 - tailStartRadius) * Math.pow(t, 0.82)
            const size = 0.44 - t * 0.16
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
