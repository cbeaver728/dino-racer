import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { MeshBasicMaterial, Quaternion, Euler, Vector3 } from 'three'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
try {
  const { createContinuousSkin, strideSwing, JOINTS } = await server.ssrLoadModule('/src/components/dinoSurface.ts')
  const { headShape } = await server.ssrLoadModule('/src/components/headProfiles.ts')
  const material = new MeshBasicMaterial()
  const cases = [
    ['Raptor', 1, 0.55, null], ['Raptor', 1, 0.95, null], ['Raptor', 1, 1.42, null],
    ['Triceratops', 0.8, 0.55, 1.42], ['Triceratops', 1.2, 1.42, 0.55],
    ['Brachiosaurus', 0.8, 0.55, 0.55], ['Brachiosaurus', 1.2, 1.42, 1.42],
    ['T-Rex', 1.2, 0.95, null], ['Parasaurolophus', 1, 0.95, 0.95],
  ]
  let maxTriangles = 0, totalMs = 0
  for (const [headName, size, hind, front] of cases) {
    const label = `${headName}/${size}/${hind}/${front ?? 'arms'}`
    const dims = { halfLength: 1.41 * size, halfHeight: 0.72 * size, halfWidth: 0.59 * size }
    const tilt = front ? Math.max(-0.38, Math.min(0.38, (front - hind) / (1.6 * size))) : -0.1
    const bodyY = (front ? (hind + front) / 2 : hind) + 0.59 * size
    const legs = [
      { joint: 'hindLeft', x: (front ? -0.8 : -0.35) * size, z: -0.37 * size, height: hind },
      { joint: 'hindRight', x: (front ? -0.8 : -0.35) * size, z: 0.37 * size, height: hind },
      ...(front ? [
        { joint: 'frontLeft', x: 0.87 * size, z: -0.3 * size, height: front },
        { joint: 'frontRight', x: 0.87 * size, z: 0.3 * size, height: front },
      ] : []),
    ]
    const shape = headShape(headName), long = headName === 'Brachiosaurus'
    const scale = (long ? 0.9 : headName === 'T-Rex' ? 1.22 : 1.08) * size
    const position = [dims.halfLength * 0.86 + shape.dims.halfLength * scale * 0.72, dims.halfHeight * 0.95 + (long ? 1.62 : 0.44), 0]
    const start = performance.now()
    const skin = createContinuousSkin({
      dims, tilt, bodyY, legs,
      neck: {
        from: [dims.halfLength * 0.54, 0.12 * size, 0],
        control: [dims.halfLength * 0.82 + (long ? 0.1 : 0.42), position[1] * 0.63, 0],
        to: [position[0] - shape.dims.halfLength * scale * 0.68, position[1] - 0.04, 0],
        startRadius: dims.halfHeight * (long ? 0.66 : 0.8), endRadius: (long ? 0.2 : 0.3) * scale, falloff: 0.7,
      },
      head: { profile: shape.skull, dims: shape.dims, position, scale },
    }, material)
    totalMs += performance.now() - start
    const geometry = skin.mesh.geometry, index = geometry.index
    const positions = geometry.getAttribute('position'), weights = geometry.getAttribute('skinWeight')
    maxTriangles = Math.max(maxTriangles, index.count / 3)
    const edges = new Map(), adjacency = Array.from({ length: positions.count }, () => [])
    for (let i = 0; i < index.count; i += 3) {
      const ids = [index.getX(i), index.getX(i + 1), index.getX(i + 2)]
      assert(new Set(ids).size === 3, `${label}: collapsed triangle`)
      for (let j = 0; j < 3; j++) {
        const a = ids[j], b = ids[(j + 1) % 3], key = `${Math.min(a, b)}:${Math.max(a, b)}`
        edges.set(key, (edges.get(key) ?? 0) + 1)
        adjacency[a].push(b); adjacency[b].push(a)
      }
    }
    assert([...edges.values()].every(count => count === 2), `${label}: open surface or non-manifold joint`)
    const visited = new Set([0]), queue = [0]
    for (let i = 0; i < queue.length; i++) for (const next of adjacency[queue[i]]) {
      if (!visited.has(next)) { visited.add(next); queue.push(next) }
    }
    assert.equal(visited.size, positions.count, `${label}: disconnected tissue`)
    for (let i = 0; i < positions.count; i++) {
      const sum = weights.getX(i) + weights.getY(i) + weights.getZ(i) + weights.getW(i)
      assert(Math.abs(sum - 1) < 1e-6, `${label}: unnormalized weights`)
    }
    // Test full opposing strides and neck bends with real skeleton transforms.
    const rest = Array.from({ length: positions.count }, (_, i) => new Vector3().fromBufferAttribute(positions, i))
    const posed = rest.map(p => p.clone())
    const boneIds = geometry.getAttribute('skinIndex')
    for (const phase of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
      for (const [j, name] of ['hindLeft', 'hindRight', 'frontLeft', 'frontRight'].entries()) {
        skin.bones[name].rotation.z = Math.sin(phase + (j === 1 || j === 2 ? Math.PI : 0)) * strideSwing(legs.find(leg => leg.joint === name)?.height ?? hind, 1.35)
      }
      skin.bones.neck.quaternion.copy(skin.neckRest).multiply(new Quaternion().setFromEuler(new Euler(0, 0.03 * Math.cos(phase), 0.042 * Math.sin(phase))))
      skin.mesh.updateMatrixWorld(true)
      skin.mesh.skeleton.update()
      for (let i = 0; i < rest.length; i++) {
        skin.mesh.applyBoneTransform(i, posed[i].copy(rest[i]))
        assert(posed[i].toArray().every(Number.isFinite), `${label}: invalid animated vertex`)
      }
      for (const key of edges.keys()) {
        const [a, b] = key.split(':').map(Number)
        assert(posed[a].distanceTo(posed[b]) < Math.max(0.08, rest[a].distanceTo(rest[b]) * 3), `${label}: overstretched joint at phase ${phase}`)
      }
      for (const leg of legs) {
        const joint = JOINTS.indexOf(leg.joint), ids = geometry.getAttribute('skinIndex')
        const endpoint = new Vector3(leg.x - leg.height * 0.08, leg.height * 0.14, leg.z)
        const ankleVertices = rest.flatMap((p, i) => p.distanceTo(endpoint) < 0.18 && p.y < endpoint.y + 0.025 ? [i] : [])
        assert(ankleVertices.length > 0, `${label}: missing ankle`)
        for (const i of ankleVertices) {
          let influence = 0
          for (let j = 0; j < 4; j++) if (ids.getComponent(i, j) === joint) influence += weights.getComponent(i, j)
          assert(influence > 0.99, `${label}: ankle slips away from foot`)
        }
      }
    }
    skin.dispose()
    console.log(`PASS ${label}: one closed mesh, continuous stride deformation`)
  }
  material.dispose()
  console.log(`PASS: ${cases.length} anatomies, 4 gait poses each; maximum ${maxTriangles} triangles; mean generation ${Math.round(totalMs / cases.length)} ms.`)
} finally { await server.close() }
