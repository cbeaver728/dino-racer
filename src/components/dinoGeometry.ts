import * as THREE from 'three'

export type Vec3 = [number, number, number]

export interface BodyDims {
  /** Half the nose-to-tail length of the torso. */
  halfLength: number
  /** Half the depth of the ribcage at its deepest. */
  halfHeight: number
  /** Half the width across the flanks. */
  halfWidth: number
}

/**
 * Torso profile from tail end (u = -1) to shoulders (u = +1), as fractions of
 * the body's half-extents. The ribcage is deepest just behind centre, the belly
 * sags between the limbs, and both ends taper so the neck and tail can meet the
 * torso without a step. A plain ellipsoid gave every dinosaur the same egg.
 */
const RIB_HEIGHT = [0.16, 0.46, 0.74, 0.92, 1.0, 1.0, 0.95, 0.84, 0.66, 0.44]
const RIB_WIDTH = [0.14, 0.42, 0.7, 0.9, 1.0, 0.99, 0.92, 0.78, 0.58, 0.36]
const SPINE_RISE = [0.2, 0.12, 0.04, -0.02, -0.05, -0.05, -0.01, 0.06, 0.14, 0.22]

/** Catmull-Rom through evenly spaced control values, t in 0..1. */
function sampleCurve(values: number[], t: number) {
  const last = values.length - 1
  const scaled = THREE.MathUtils.clamp(t, 0, 1) * last
  const index = Math.min(last - 1, Math.floor(scaled))
  const f = scaled - index
  const p0 = values[Math.max(0, index - 1)]
  const p1 = values[index]
  const p2 = values[index + 1]
  const p3 = values[Math.min(last, index + 2)]
  return 0.5 * (
    2 * p1
    + (-p0 + p2) * f
    + (2 * p0 - 5 * p1 + 4 * p2 - p3) * f * f
    + (-p0 + 3 * p1 - 3 * p2 + p3) * f * f * f
  )
}

export interface BodySlice {
  x: number
  centerY: number
  radiusY: number
  radiusZ: number
}

/**
 * Cross-section of any swept part at u in -1 .. +1. Attachments read this so
 * they land on the real surface: teeth follow the jaw as it narrows, horns sit
 * on the skull, limbs root on the flank.
 */
export function profileSliceAt(profile: SweptProfile, dims: BodyDims, u: number): BodySlice {
  const t = (THREE.MathUtils.clamp(u, -1, 1) + 1) / 2
  return {
    x: u * dims.halfLength,
    centerY: sampleCurve(profile.rise, t) * dims.halfHeight,
    radiusY: sampleCurve(profile.height, t) * dims.halfHeight,
    radiusZ: sampleCurve(profile.width, t) * dims.halfWidth,
  }
}

/** Torso cross-section at u in -1 (tail) .. +1 (shoulders). */
export const bodySliceAt = (dims: BodyDims, u: number) => profileSliceAt(BODY_PROFILE, dims, u)

export interface SweptProfile {
  /** Vertical radius per station, as a fraction of halfHeight. */
  height: number[]
  /** Horizontal radius per station, as a fraction of halfWidth. */
  width: number[]
  /** Centre-line offset per station, as a fraction of halfHeight. */
  rise: number[]
}

export const BODY_PROFILE: SweptProfile = {
  height: RIB_HEIGHT,
  width: RIB_WIDTH,
  rise: SPINE_RISE,
}

/**
 * Sweeps an elliptical cross-section along X, varying its radii and centre by
 * the profile. Used for the torso and for every skull, which is what gives each
 * head a tapering, structured shape rather than a scaled ball.
 */
export function createSweptGeometry(
  profile: SweptProfile,
  dims: BodyDims,
  segments = 46,
  radial = 30,
) {
  const positions: number[] = []
  const indices: number[] = []

  const sliceAt = (u: number) => profileSliceAt(profile, dims, u)

  for (let i = 0; i <= segments; i++) {
    const slice = sliceAt((i / segments) * 2 - 1)
    for (let j = 0; j < radial; j++) {
      const angle = (j / radial) * Math.PI * 2
      positions.push(
        slice.x,
        slice.centerY + Math.sin(angle) * slice.radiusY,
        Math.cos(angle) * slice.radiusZ,
      )
    }
  }

  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < radial; j++) {
      const next = (j + 1) % radial
      const ring = i * radial
      const ahead = (i + 1) * radial
      indices.push(ring + j, ahead + j, ring + next)
      indices.push(ring + next, ahead + j, ahead + next)
    }
  }

  const back = sliceAt(-1)
  const front = sliceAt(1)
  positions.push(back.x, back.centerY, 0)
  const backIndex = positions.length / 3 - 1
  positions.push(front.x, front.centerY, 0)
  const frontIndex = positions.length / 3 - 1

  for (let j = 0; j < radial; j++) {
    const next = (j + 1) % radial
    indices.push(backIndex, j, next)
    indices.push(segments * radial + next, segments * radial + j, frontIndex)
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

export const createBodyGeometry = (dims: BodyDims) => createSweptGeometry(BODY_PROFILE, dims)

/** Point along a quadratic bezier. */
export const bezier = (a: Vec3, control: Vec3, b: Vec3, t: number): Vec3 => {
  const m = 1 - t
  return [
    m * m * a[0] + 2 * m * t * control[0] + t * t * b[0],
    m * m * a[1] + 2 * m * t * control[1] + t * t * b[1],
    m * m * a[2] + 2 * m * t * control[2] + t * t * b[2],
  ]
}

export interface TubeOptions {
  from: Vec3
  control: Vec3
  to: Vec3
  startRadius: number
  endRadius: number
  falloff?: number
  /** Flattens the tube sideways; below 1 gives a slab-sided tail. */
  flatten?: number
  segments?: number
  radial?: number
}

/**
 * Smooth tapered tube swept along the bezier, for necks and tails. Stacking
 * overlapping spheres breaks into visible beads once the taper goes thin.
 */
export function createTubeGeometry({
  from, control, to, startRadius, endRadius, falloff = 1, flatten = 1, segments = 30, radial = 18,
}: TubeOptions) {
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
        .addScaledVector(binormal, Math.sin(angle) * radius * flatten)
      positions.push(vertex.x, vertex.y, vertex.z)
    }
  }

  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < radial; j++) {
      const next = (j + 1) % radial
      const ring = i * radial
      const ahead = (i + 1) * radial
      indices.push(ring + j, ahead + j, ring + next)
      indices.push(ring + next, ahead + j, ahead + next)
    }
  }

  const tip = at(1)
  positions.push(tip.x, tip.y, tip.z)
  const tipIndex = positions.length / 3 - 1
  for (let j = 0; j < radial; j++) {
    indices.push(segments * radial + j, tipIndex, segments * radial + ((j + 1) % radial))
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}
