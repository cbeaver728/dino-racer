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
// Muscular hips taper into the tail; a deep ribcage narrows at the shoulders.
const RIB_HEIGHT = [0.35, 0.7, 0.91, 1.0, 1.0, 0.96, 0.89, 0.75, 0.44, 0.1]
const RIB_WIDTH = [0.32, 0.65, 0.89, 0.98, 1.0, 0.95, 0.85, 0.7, 0.4, 0.09]
const SPINE_RISE = [0.1, 0.09, 0.06, 0.02, -0.03, -0.04, 0.01, 0.1, 0.2, 0.28]

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
  // These are small meshes on a handful of dinosaurs, and the silhouette is the
  // important at race scale, so the rings are dense enough not to show corners.
  radial = 40,
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

/** A thin, curved neck shield with an irregular scalloped rim. */
export function createFrillGeometry() {
  const geometry = new THREE.SphereGeometry(1, 56, 36)
  const points = geometry.getAttribute('position')
  for (let i = 0; i < points.count; i++) {
    const x = points.getX(i), y = points.getY(i), z = points.getZ(i)
    const radius = Math.hypot(y, z)
    const scallop = 1 + 0.035 * Math.cos(Math.atan2(y, z) * 14) * radius ** 4
    points.setXYZ(i, x * 0.075 - y * y * 0.12, y * 0.68 * scallop, z * 0.76 * scallop)
  }
  geometry.computeVertexNormals()
  return geometry
}

/** Rounded edges around a tapered, asymmetric dorsal plate. */
export function createPlateGeometry() {
  const shape = new THREE.Shape()
    .moveTo(-0.3, 0)
    .bezierCurveTo(-0.39, 0.23, -0.22, 0.63, -0.1, 0.86)
    .bezierCurveTo(0.02, 0.73, 0.34, 0.39, 0.31, 0.12)
    .quadraticCurveTo(0.14, -0.05, -0.3, 0)
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.06, bevelEnabled: true, bevelThickness: 0.035,
    bevelSize: 0.035, bevelSegments: 3, steps: 1, curveSegments: 16,
  })
  geometry.translate(0, 0, -0.03)
  return geometry
}

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
  /** Close an exposed attachment, such as the hip of an animated leg. */
  capStart?: boolean
}

/**
 * Smooth tapered tube swept along the bezier, for necks and tails. Stacking
 * overlapping spheres breaks into visible beads once the taper goes thin.
 */
export function createTubeGeometry({
  from, control, to, startRadius, endRadius, falloff = 1, flatten = 1, segments = 30, radial = 30, capStart = false,
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

  /*
   * Wound so the faces look outwards.
   *
   * They used to be wound the other way, which left every tube on the dinosaur
   * inside out — neck, tail and legs. Back-face culling then hid the near wall
   * and drew the inside of the far one, and `computeVertexNormals` derived its
   * normals from the same winding, so the surface was lit from within too. The
   * result read as a pale, translucent, hollow tail.
   */
  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < radial; j++) {
      const next = (j + 1) % radial
      const ring = i * radial
      const ahead = (i + 1) * radial
      indices.push(ring + j, ring + next, ahead + j)
      indices.push(ring + next, ahead + next, ahead + j)
    }
  }

  const tip = at(1)
  // The hip ring can extend beyond the torso during
  // a stride, exposing the open root from the rear even when the sides are
  // correctly wound. Share its rim vertices so the join shades smoothly.
  let rootIndex = -1
  if (capStart) {
    positions.push(a.x, a.y, a.z)
    rootIndex = positions.length / 3 - 1
  }
  positions.push(tip.x, tip.y, tip.z)
  const tipIndex = positions.length / 3 - 1
  for (let j = 0; j < radial; j++) {
    const next = (j + 1) % radial
    if (capStart) indices.push(rootIndex, next, j)
    indices.push(segments * radial + j, segments * radial + next, tipIndex)
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

/** Where the limb stops and the foot takes over. */
export const ankleHeight = (height: number) => height * 0.14

/** A continuous solid limb with a broad hip and a narrower ankle. */
export function createLegGeometry(height: number) {
  const chunk = Math.min(height, 1.2)
  // Short legs retain their muscle mass, so their knee needs a gentler curve:
  // a bend tighter than the tube's radius turns its inner faces inside out.
  const bend = Math.min(0.48, height * 0.5)
  return createTubeGeometry({
    from: [0, height, 0],
    control: [height * bend, height * 0.5, 0],
    to: [-height * 0.08, ankleHeight(height), 0],
    startRadius: 0.25 + chunk * 0.11,
    endRadius: 0.1 + chunk * 0.03,
    falloff: 0.78,
    flatten: 0.88,
    segments: 26,
    radial: 28,
    capStart: true,
  })
}
