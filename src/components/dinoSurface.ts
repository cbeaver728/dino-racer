import * as THREE from 'three'
import { MarchingCubes } from 'three/addons/objects/MarchingCubes.js'
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js'
import { BODY_PROFILE, bezier, profileSliceAt, type BodyDims, type SweptProfile, type TubeOptions, type Vec3 } from './dinoGeometry'

export const JOINTS = ['body', 'neck', 'hindLeft', 'hindRight', 'frontLeft', 'frontRight'] as const
export type JointName = typeof JOINTS[number]
/** Short limbs take shorter steps; boosts increase cadence, not joint strain. */
export const strideSwing = (height: number, run: number) =>
  0.48 * THREE.MathUtils.clamp(run, 0, 1) * THREE.MathUtils.clamp(height / 0.95, 0.55, 1)
export interface SurfaceLeg { joint: JointName; x: number; z: number; height: number }
export interface SurfaceOptions {
  dims: BodyDims
  bodyY: number
  tilt: number
  legs: SurfaceLeg[]
  neck: TubeOptions
  head: { profile: SweptProfile; dims: BodyDims; position: Vec3; scale: number }
}

interface Field {
  distance(x: number, y: number, z: number): number
  bounds: THREE.Box3
  joint: number
  blend: number
  blendStart?: number
  blendEnd?: number
}

/** Profile distance sampled once along X; no allocations in the volume loop. */
function profileField(profile: SweptProfile, dims: BodyDims, transform: THREE.Matrix4, joint: number, blend: number): Field {
  const stations = Array.from({ length: 129 }, (_, i) => profileSliceAt(profile, dims, i / 64 - 1))
  const inverse = transform.clone().invert().elements
  const scale = new THREE.Vector3().setFromMatrixScale(transform).x
  const bounds = new THREE.Box3(
    new THREE.Vector3(-dims.halfLength, -dims.halfHeight * 1.5, -dims.halfWidth * 1.2),
    new THREE.Vector3(dims.halfLength, dims.halfHeight * 1.5, dims.halfWidth * 1.2),
  ).applyMatrix4(transform)
  const guard = bounds.clone().expandByScalar(blend + 0.1)
  return {
    joint, blend, bounds,
    distance(x, y, z) {
      if (x < guard.min.x || x > guard.max.x || y < guard.min.y || y > guard.max.y || z < guard.min.z || z > guard.max.z) return 1000
      const px = inverse[0] * x + inverse[4] * y + inverse[8] * z + inverse[12]
      const py = inverse[1] * x + inverse[5] * y + inverse[9] * z + inverse[13]
      const pz = inverse[2] * x + inverse[6] * y + inverse[10] * z + inverse[14]
      const t = THREE.MathUtils.clamp((px / dims.halfLength + 1) * 64, 0, 128)
      const at = Math.min(127, Math.floor(t)), f = t - at
      const a = stations[at], b = stations[at + 1]
      const ry = a.radiusY + (b.radiusY - a.radiusY) * f
      const rz = a.radiusZ + (b.radiusZ - a.radiusZ) * f
      const cy = a.centerY + (b.centerY - a.centerY) * f
      const radial = (Math.hypot((py - cy) / ry, pz / rz) - 1) * Math.min(ry, rz)
      return Math.max(radial, Math.abs(px) - dims.halfLength) * scale
    },
  }
}

/** Distance to a tapered, rounded curve, including solid ends. */
function tubeField(tube: TubeOptions, transform: THREE.Matrix4, joint: number, blend: number): Field {
  const steps = 20
  const points = Array.from({ length: steps + 1 }, (_, i) => {
    const p = new THREE.Vector3(...bezier(tube.from, tube.control, tube.to, i / steps)).applyMatrix4(transform)
    const radius = tube.startRadius + (tube.endRadius - tube.startRadius) * (i / steps) ** (tube.falloff ?? 1)
    return { x: p.x, y: p.y, z: p.z, radius }
  })
  const flatten = tube.flatten ?? 1
  const segments = points.slice(0, -1).map((a, i) => {
    const b = points[i + 1]
    const dx = b.x - a.x, dy = b.y - a.y, dz = (b.z - a.z) / flatten
    return { ...a, dx, dy, dz, dr: b.radius - a.radius, length2: dx * dx + dy * dy + dz * dz }
  })
  const bounds = new THREE.Box3().setFromPoints(points.map(p => new THREE.Vector3(p.x, p.y, p.z)))
    .expandByScalar(Math.max(tube.startRadius, tube.endRadius))
  const guard = bounds.clone().expandByScalar(blend + 0.1)
  return {
    joint, blend, bounds,
    distance(x, y, z) {
      if (x < guard.min.x || x > guard.max.x || y < guard.min.y || y > guard.max.y || z < guard.min.z || z > guard.max.z) return 1000
      let distance = 1000
      for (const s of segments) {
        const px = x - s.x, py = y - s.y, pz = (z - s.z) / flatten
        const t = THREE.MathUtils.clamp((px * s.dx + py * s.dy + pz * s.dz) / s.length2, 0, 1)
        distance = Math.min(distance, Math.hypot(px - s.dx * t, py - s.dy * t, pz - s.dz * t) - s.radius - s.dr * t)
      }
      return distance
    },
  }
}

function makeFields(options: SurfaceOptions) {
  const { dims, bodyY, tilt, neck, head, legs } = options
  const bodyTransform = new THREE.Matrix4().makeRotationZ(tilt).setPosition(0, bodyY, 0)
  const fields = [profileField(BODY_PROFILE, dims, bodyTransform, 0, 0)]
  fields.push(tubeField(neck, bodyTransform, 1, dims.halfHeight * 0.4))
  const headTransform = bodyTransform.clone()
    .multiply(new THREE.Matrix4().makeTranslation(...head.position))
    .multiply(new THREE.Matrix4().makeRotationZ(-0.1))
    .scale(new THREE.Vector3(head.scale, head.scale, head.scale))
  fields.push(profileField(head.profile, head.dims, headTransform, 1, 0.085 * head.scale))
  for (const leg of legs) {
    const h = leg.height, chunk = Math.min(h, 1.2)
    fields.push({ ...tubeField({
      from: [0, h, 0], control: [h * Math.min(0.48, h * 0.5), h * 0.5, 0], to: [-h * 0.08, h * 0.14, 0],
      startRadius: 0.25 + chunk * 0.11, endRadius: 0.1 + chunk * 0.03, falloff: 0.78, flatten: 0.88,
    }, new THREE.Matrix4().makeTranslation(leg.x, 0, leg.z), JOINTS.indexOf(leg.joint), 0.24),
      // Blend the hip into the torso, without growing a membrane between the
      // shins of narrow builds when the two legs pass each other.
      blendStart: h * 0.5, blendEnd: h * 0.88,
    })
  }
  return fields
}

/** Smooth union of tissues, optionally retaining the same blend as bone weights. */
function sample(fields: Field[], x: number, y: number, z: number, weights?: number[]) {
  let distance = fields[0].distance(x, y, z)
  if (weights) { weights.fill(0); weights[0] = 1 }
  for (let i = 1; i < fields.length; i++) {
    const field = fields[i], other = field.distance(x, y, z)
    const blend = field.blend * (field.blendStart === undefined ? 1 : THREE.MathUtils.smoothstep(y, field.blendStart, field.blendEnd!))
    const h = blend > 1e-6 ? THREE.MathUtils.clamp(0.5 + 0.5 * (other - distance) / blend, 0, 1) : (distance < other ? 1 : 0)
    const weightH = THREE.MathUtils.clamp(0.5 + 0.5 * (other - distance) / Math.max(0.36, blend), 0, 1)
    distance = other * (1 - h) + distance * h - blend * h * (1 - h)
    if (weights) {
      // Movement spreads farther through tissue than the geometric fillet.
      // Narrow creases must not become abrupt changes in bone ownership.
      const influence = weightH * weightH * (3 - 2 * weightH)
      for (let j = 0; j < weights.length; j++) weights[j] *= influence
      weights[field.joint] += 1 - influence
    }
  }
  return distance
}

/**
 * One welded skin for torso, hips, legs, neck and skull. Built only when the
 * anatomy changes. The GPU bends the shared vertices during the frame loop;
 * no remeshing or per-frame vertex allocations are required.
 */
export function createContinuousSkin(options: SurfaceOptions, material: THREE.Material, resolution = 64) {
  const fields = makeFields(options)
  const bounds = fields.reduce((box, field) => box.union(field.bounds), new THREE.Box3()).expandByScalar(0.32)
  const size = bounds.getSize(new THREE.Vector3()), center = bounds.getCenter(new THREE.Vector3())
  const marcher = new MarchingCubes(resolution, material, false, false, 60000)
  marcher.isolation = 0
  let at = 0
  for (let z = 0; z < resolution; z++) {
    const pz = bounds.min.z + z / resolution * size.z
    for (let y = 0; y < resolution; y++) {
      const py = bounds.min.y + y / resolution * size.y
      for (let x = 0; x < resolution; x++) {
        marcher.field[at++] = -sample(fields, bounds.min.x + x / resolution * size.x, py, pz)
      }
    }
  }
  marcher.update()
  const count = marcher.geometry.drawRange.count
  if (!count || count > marcher.geometry.getAttribute('position').count) {
    marcher.geometry.dispose()
    throw new Error('Continuous dinosaur skin exceeded its geometry budget')
  }
  const raw = new THREE.BufferGeometry()
  raw.setAttribute('position', new THREE.Float32BufferAttribute(marcher.geometry.getAttribute('position').array.slice(0, count * 3), 3))
  raw.scale(size.x / 2, size.y / 2, size.z / 2).translate(center.x, center.y, center.z)
  // Weld by position before adding weights: every joint shares real vertices,
  // rather than coincident edges that can separate when the skeleton bends.
  const geometry = mergeVertices(raw, 1e-5)
  raw.dispose()
  marcher.geometry.dispose()
  // A grid corner exactly on the surface can produce zero-width triangles.
  // Welding collapses their edges; discard those faces before normal averaging.
  const welded = geometry.index!
  const triangles: number[] = []
  for (let i = 0; i < welded.count; i += 3) {
    const a = welded.getX(i), b = welded.getX(i + 1), c = welded.getX(i + 2)
    if (a !== b && b !== c && c !== a) triangles.push(a, b, c)
  }
  geometry.setIndex(triangles)
  geometry.computeVertexNormals()
  const position = geometry.getAttribute('position')
  const indices = new Uint16Array(position.count * 4)
  const skinWeights = new Float32Array(position.count * 4)
  const weights = Array<number>(JOINTS.length).fill(0)
  for (let i = 0; i < position.count; i++) {
    sample(fields, position.getX(i), position.getY(i), position.getZ(i), weights)
    // Anchor the upper thigh to the pelvis while the lower leg follows its
    // foot. A broad easing region lets the skin stretch through a stride and
    // prevents opposing legs from pulling the crotch into a sharp crease.
    for (const leg of options.legs) {
      const joint = JOINTS.indexOf(leg.joint)
      const anchored = weights[joint] * THREE.MathUtils.smoothstep(position.getY(i), leg.height * 0.45, leg.height * 1.05)
      weights[joint] -= anchored
      weights[0] += anchored
    }
    const dominant = weights.indexOf(Math.max(...weights))
    const foot = options.legs.find(leg => JOINTS.indexOf(leg.joint) === dominant)
    if (foot) {
      const free = THREE.MathUtils.smoothstep(position.getY(i), foot.height * 0.3, foot.height * 0.5)
      for (let joint = 0; joint < weights.length; joint++) weights[joint] *= free
      weights[dominant] += 1 - free
    }
    const ranked = weights.map((weight, joint) => ({ weight, joint })).sort((a, b) => b.weight - a.weight).slice(0, 4)
    const total = ranked.reduce((sum, item) => sum + item.weight, 0)
    for (let j = 0; j < 4; j++) {
      indices[i * 4 + j] = ranked[j].joint
      skinWeights[i * 4 + j] = ranked[j].weight / total
    }
  }
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(indices, 4))
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4))
  geometry.computeBoundingSphere()

  const bones = Object.fromEntries(JOINTS.map(name => [name, new THREE.Bone()])) as Record<JointName, THREE.Bone>
  bones.neck.position.set(...options.neck.from)
    .applyMatrix4(new THREE.Matrix4().makeRotationZ(options.tilt).setPosition(0, options.bodyY, 0))
  bones.neck.rotation.z = options.tilt
  for (const leg of options.legs) bones[leg.joint].position.set(leg.x, leg.height, leg.z)
  for (const name of JOINTS.slice(1)) bones.body.add(bones[name])
  const skeleton = new THREE.Skeleton(JOINTS.map(name => bones[name]))
  const mesh = new THREE.SkinnedMesh(geometry, material)
  mesh.add(bones.body)
  mesh.bind(skeleton)
  // The animated limbs can exceed the bind-pose bounds, especially on boosts.
  mesh.frustumCulled = false
  return {
    mesh, bones, neckRest: bones.neck.quaternion.clone(),
    dispose() { geometry.dispose(); skeleton.dispose() },
  }
}
