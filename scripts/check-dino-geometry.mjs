import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three'

// Load the real TypeScript geometry without a second compiler or test runner.
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
try {
  const { createLegGeometry } = await server.ssrLoadModule('/src/components/dinoGeometry.ts')
  const segments = 26, radial = 28
  const material = new MeshBasicMaterial() // Front-side culling, as in the game.
  const heights = [0.3, 0.55, 0.7, 0.95, 1.2, 1.42, 1.8]

  for (const height of heights) {
    const geometry = createLegGeometry(height)
    const position = geometry.getAttribute('position')
    const index = geometry.index
    const vertex = (i) => new Vector3().fromBufferAttribute(position, i)
    for (const attribute of ['position', 'normal']) {
      assert(Array.from(geometry.getAttribute(attribute).array).every(Number.isFinite), `${height}: invalid ${attribute}`)
    }

    // Every indexed edge belongs to exactly two faces: no open hip, ankle, or
    // longitudinal seam, even when the torso no longer hides the attachment.
    const edges = new Map()
    for (let i = 0; i < index.count; i += 3) {
      const ids = [index.getX(i), index.getX(i + 1), index.getX(i + 2)]
      for (let j = 0; j < 3; j++) {
        const a = ids[j], b = ids[(j + 1) % 3]
        const key = `${Math.min(a, b)}:${Math.max(a, b)}`
        edges.set(key, (edges.get(key) ?? 0) + 1)
      }
    }
    assert([...edges.values()].every((uses) => uses === 2), `${height}: open or non-manifold leg`)

    const centers = Array.from({ length: segments + 1 }, (_, ring) => {
      const center = new Vector3()
      for (let j = 0; j < radial; j++) center.add(vertex(ring * radial + j))
      return center.divideScalar(radial)
    })

    // A tight knee must not fold its inside wall over and reverse the faces.
    for (let i = 0; i < segments * radial * 6; i += 3) {
      const ids = [index.getX(i), index.getX(i + 1), index.getX(i + 2)]
      const [a, b, c] = ids.map(vertex)
      const normal = b.clone().sub(a).cross(c.clone().sub(a))
      const outward = new Vector3()
      for (const id of ids) outward.add(vertex(id).sub(centers[Math.floor(id / radial)]))
      assert(normal.lengthSq() > 1e-16, `${height}: collapsed triangle`)
      assert(normal.dot(outward) > 0, `${height}: inward-facing leg wall`)
    }

    const mesh = new Mesh(geometry, material)
    // Approach each end from outside with culling enabled. The first hit must
    // be its cap, rather than an interior surface further down the hollow tube.
    for (const [end, inside] of [[0, 1], [segments, segments - 1]]) {
      const center = centers[end]
      const direction = centers[inside].clone().sub(center).normalize()
      const ray = new Raycaster(center.clone().addScaledVector(direction, -2), direction)
      const [hit] = ray.intersectObject(mesh)
      assert(hit && hit.point.distanceTo(center) < 1e-5, `${height}: invisible end cap`)
    }
    geometry.dispose()
  }
  material.dispose()
  console.log(`PASS: ${heights.length} leg lengths have closed surfaces, outward-facing walls, and visible end caps.`)
} finally {
  await server.close()
}
