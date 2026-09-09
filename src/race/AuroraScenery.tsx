import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Course } from './course'

const random = (n: number) => THREE.MathUtils.euclideanModulo(Math.sin(n * 127.1 + 311.7) * 43758.5453, 1)
const MINT = '#75ffe0'
const GOLD = '#ffdba0'

const waterVertex = `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`
const waterfallFragment = `
  uniform float time;
  varying vec2 vUv;
  void main() {
    float strands = pow(.5 + .5 * sin(vUv.x * 110.0 + sin(vUv.x * 31.0) * 3.0), 6.0);
    float rush = .5 + .5 * sin(vUv.y * 44.0 + time * 9.0 + vUv.x * 18.0);
    float edge = smoothstep(0.0, .13, vUv.x) * (1.0 - smoothstep(.86, 1.0, vUv.x));
    vec3 color = mix(vec3(.06,.40,.56), vec3(.64,1.0,.94), .35 + strands * .5 + rush * .15);
    gl_FragColor = vec4(color, edge * (.65 + strands * .25));
  }
`
const lakeFragment = `
  uniform float time;
  varying vec2 vUv;
  void main() {
    float wave = sin(vUv.x * 92.0 + time * .65 + sin(vUv.y * 37.0)) * sin(vUv.y * 95.0 - time * .9);
    float shine = pow(max(0.0, wave), 9.0);
    vec3 color = mix(vec3(.025,.17,.25), vec3(.08,.43,.48), vUv.y);
    gl_FragColor = vec4(color + shine * vec3(.10,.30,.28), 1.0);
  }
`

function LivingWater({ falls = false }: { falls?: boolean }) {
  const material = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: waterVertex,
    fragmentShader: falls ? waterfallFragment : lakeFragment,
    uniforms: { time: { value: 0 } },
    transparent: falls, side: THREE.DoubleSide, depthWrite: !falls,
  }), [falls])
  useFrame(({ clock }) => { material.uniforms.time.value = clock.elapsedTime })
  useEffect(() => () => material.dispose(), [material])
  return <primitive object={material} attach="material" />
}

/** A sky curtain with vertex colours; no textures or postprocessing required. */
function AuroraSky() {
  const ribbon = useRef<THREE.Mesh>(null)
  const material = useMemo(() => new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 } }, transparent: true, side: THREE.DoubleSide,
    depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `varying vec2 vUv; uniform float time;
      void main() { vUv = uv; vec3 p = position; p.y += sin(p.x * .18 + time * .3) * .6;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`,
    fragmentShader: `varying vec2 vUv; uniform float time;
      void main() {
        float rays = .5 + .5 * sin(vUv.x * 220.0 + sin(vUv.x * 34.0 + time * .2) * 3.0);
        float fade = sin(vUv.y * 3.14159) * smoothstep(0.0,.15,vUv.x) * (1.0 - smoothstep(.85,1.0,vUv.x));
        vec3 c = mix(vec3(.1,.95,.65),vec3(.48,.28,.95),vUv.x);
        gl_FragColor = vec4(c, fade * (.18 + .19 * rays));
      }`,
  }), [])
  const geometry = useMemo(() => {
    const vertices: number[] = [], uvs: number[] = [], indices: number[] = []
    for (let i = 0; i <= 96; i++) {
      const t = i / 96, x = (t - .5) * 66
      const low = 9 + Math.sin(t * 11) * 1.6, z = -26 + Math.sin(t * 8) * 3
      vertices.push(x, low, z, x, low + 4 + Math.sin(t * 18), z)
      uvs.push(t, 0, t, 1)
      if (i) { const a = (i - 1) * 2; indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2) }
    }
    const result = new THREE.BufferGeometry()
    result.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
    result.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
    result.setIndex(indices)
    return result
  }, [])
  useEffect(() => () => { geometry.dispose(); material.dispose() }, [geometry, material])
  useFrame(({ clock }) => {
    if (ribbon.current) {
      ribbon.current.position.y = Math.sin(clock.elapsedTime * .2) * .45
      material.uniforms.time.value = clock.elapsedTime
    }
  })
  return <group>
    <mesh ref={ribbon} geometry={geometry} material={material} />
    <mesh position={[-25, 12, -23]}><sphereGeometry args={[1.6, 32, 24]} /><meshStandardMaterial color="#e8eddb" emissive="#b8dbdd" emissiveIntensity={.5} roughness={1} /></mesh>
  </group>
}

function Crystal({ position, size = 1, color = MINT }: { position: [number, number, number]; size?: number; color?: string }) {
  return <group position={position} scale={size}>
    {[0, 1, 2].map((i) => <mesh key={i} castShadow
      position={[(i - 1) * .23, i === 1 ? .75 : .4, 0]}
      rotation={[i * .08, .4 + i, (i - 1) * -.25]} scale={[i === 1 ? .32 : .21, i === 1 ? 1.35 : .8, .27]}>
      <octahedronGeometry args={[1, 0]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={.35} roughness={.25} metalness={.28} />
    </mesh>)}
    <mesh scale={[.55, .12, .4]} position={[0, .08, 0]}><dodecahedronGeometry args={[1]} /><meshStandardMaterial color="#2c415b" /></mesh>
  </group>
}

function Moonshroom({ x, z, size, pink }: { x: number; z: number; size: number; pink: boolean }) {
  const color = pink ? '#db9aff' : '#77dfd1'
  return <group position={[x, 0, z]} scale={size}>
    <mesh position={[0, .64, 0]} castShadow><cylinderGeometry args={[.12, .22, 1.28, 9]} /><meshStandardMaterial color="#7b8097" roughness={.8} /></mesh>
    <mesh position={[0, 1.32, 0]} scale={[1, .46, 1]} castShadow>
      <sphereGeometry args={[.92, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
      <meshStandardMaterial color={pink ? '#775499' : '#328b94'} roughness={.6} />
    </mesh>
    <mesh position={[0, 1.31, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[.9, 24]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={.55} side={THREE.DoubleSide} /></mesh>
    <mesh position={[0, 1.34, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[.88, .035, 5, 24]} /><meshBasicMaterial color={color} /></mesh>
    {[0, 1, 2, 3, 4].map((i) => <mesh key={i} position={[Math.cos(i * 2.4) * .5, 1.64, Math.sin(i * 2.4) * .5]} scale={[.1, .035, .1]}>
      <sphereGeometry args={[1, 8, 5]} /><meshBasicMaterial color={color} />
    </mesh>)}
  </group>
}

function Fireflies() {
  const points = useRef<THREE.Points>(null)
  const positions = useMemo(() => Float32Array.from(Array.from({ length: 160 }, (_, i) => [
    (random(i + 88) - .5) * 49, .5 + random(i + 415) * 5, (random(i + 724) - .5) * 34,
  ]).flat()), [])
  useFrame(({ clock }) => {
    if (!points.current) return
    points.current.rotation.y = Math.sin(clock.elapsedTime * .07) * .04
    points.current.position.y = Math.sin(clock.elapsedTime * .5) * .25
  })
  return <points ref={points}>
    <bufferGeometry><bufferAttribute attach="attributes-position" args={[positions, 3]} /></bufferGeometry>
    <pointsMaterial color="#bcffe7" size={.075} transparent opacity={.8} depthWrite={false} sizeAttenuation />
  </points>
}

function Orrery() {
  const orbit = useRef<THREE.Group>(null)
  useFrame(({ clock }) => { if (orbit.current) orbit.current.rotation.y = clock.elapsedTime * .12 })
  return <group position={[0, 7.9, -7]}>
    <mesh rotation={[0, .2, .2]}><torusGeometry args={[2.5, .13, 8, 72]} /><meshStandardMaterial color="#c9a56c" metalness={.68} roughness={.28} /></mesh>
    <mesh rotation={[0, .2, .2]}><torusGeometry args={[2.3, .025, 5, 72]} /><meshBasicMaterial color={GOLD} /></mesh>
    <group ref={orbit}>
      <mesh rotation={[Math.PI / 2.6, 0, .3]}><torusGeometry args={[1.8, .065, 8, 64]} /><meshStandardMaterial color={MINT} emissive={MINT} emissiveIntensity={.5} metalness={.5} /></mesh>
      <mesh position={[1.8, 0, 0]}><icosahedronGeometry args={[.3, 1]} /><meshBasicMaterial color={GOLD} /></mesh>
      <mesh rotation={[.3, .3, Math.PI / 4]}><octahedronGeometry args={[.85]} /><meshStandardMaterial color="#bdf9f0" emissive={MINT} emissiveIntensity={.8} metalness={.35} roughness={.2} /></mesh>
    </group>
    <mesh position={[0, -2.25, 0]}><cylinderGeometry args={[.38, .8, 1.5, 8]} /><meshStandardMaterial color="#435872" metalness={.2} /></mesh>
  </group>
}

function FallsMonument() {
  const mist = useRef<THREE.Group>(null)
  useFrame(({ clock }) => { if (mist.current) mist.current.scale.setScalar(1 + Math.sin(clock.elapsedTime * .8) * .06) })
  return <group>
    {/* A terraced basalt escarpment, with waterfalls spilling between columns. */}
    {Array.from({ length: 11 }, (_, i) => {
      const x = (i - 5) * 1.12, height = 4.2 + random(i + 144) * 1.7
      return <group key={i}>
        <mesh position={[x, height / 2, -7.3 + Math.abs(i - 5) * .3]} castShadow receiveShadow>
          <cylinderGeometry args={[1.0, 1.3, height, 6]} /><meshStandardMaterial color={i % 2 ? '#35465f' : '#40516b'} roughness={.9} />
        </mesh>
        <mesh position={[x, height + .06, -7.3 + Math.abs(i - 5) * .3]}><cylinderGeometry args={[1.03, 1.03, .16, 6]} /><meshStandardMaterial color="#508582" /></mesh>
      </group>
    })}
    <mesh position={[0, 5.55, -6.3]} scale={[4.5, .2, 2]}><cylinderGeometry args={[1, 1, 1, 32]} /><meshStandardMaterial color="#386b77" roughness={.25} /></mesh>
    {[-3.5, 0, 3.5].map((x, i) => <group key={x} position={[x, 0, i === 1 ? -4.15 : -4.6]}>
      <mesh position={[0, 2.8, 0]}><planeGeometry args={[i === 1 ? 2.7 : 1.4, 5.6]} /><LivingWater falls /></mesh>
      <mesh position={[0, .14, .15]} rotation={[-Math.PI / 2, 0, 0]} scale={[1.6, .65, 1]}><circleGeometry args={[1.1, 32]} /><meshBasicMaterial color="#a6f3e4" transparent opacity={.5} depthWrite={false} /></mesh>
    </group>)}
    <group ref={mist} position={[0, .3, -3.65]}>
      {Array.from({ length: 12 }, (_, i) => <mesh key={i} position={[(i - 5.5) * .65, random(i) * .35, random(i + 76) * .6]} scale={[1, .33, .55]}>
        <sphereGeometry args={[.58 + random(i + 21) * .35, 12, 8]} /><meshBasicMaterial color="#c9ffef" transparent opacity={.10} depthWrite={false} />
      </mesh>)}
    </group>
    {[1.6, 2.6, 3.7, 4.9].map((r) => <mesh key={r} position={[0, .08, -2.4]} rotation={[-Math.PI / 2, 0, 0]} scale={[1.4, .65, 1]}>
      <ringGeometry args={[r, r + .035, 64]} /><meshBasicMaterial color={MINT} transparent opacity={.2} depthWrite={false} />
    </mesh>)}
    <Orrery />
  </group>
}

/** All route furniture is authored in lap space, so it follows the real road. */
function Skyway({ course }: { course: Course }) {
  const rails = useMemo(() => course.legs.flatMap((leg) => {
    const routes = leg.kind === 'split' ? [0, 1] : [0]
    return routes.flatMap((route) => [-1.64, 1.64].flatMap((lane) => {
      const other = leg.kind === 'split' ? leg.curves[route === 0 ? 1 : 0].getSpacedPoints(160) : []
      const chunks: THREE.Vector3[][] = [[]]
      for (let i = 0; i <= 96; i++) {
        const t = leg.tFrom + (leg.tTo - leg.tFrom) * i / 96
        const choices = course.splits.map(() => route)
        const point = course.frameAt(t === leg.tTo ? t - 1e-7 : t, lane, choices).position.add(new THREE.Vector3(0, .12, 0))
        // The inside rail ends where the two ribbons meet; it must not cut across the other lane.
        if (other.some((p) => Math.hypot(p.x - point.x, p.z - point.z) < 1.57)) {
          if (chunks[chunks.length - 1].length) chunks.push([])
        } else chunks[chunks.length - 1].push(point)
      }
      return chunks.filter((points) => points.length > 1).map((points) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), Math.max(8, points.length), .035, 5, false))
    }))
  }), [course])
  useEffect(() => () => rails.forEach((rail) => rail.dispose()), [rails])
  const piers = useMemo(() => Array.from({ length: 72 }, (_, i) => course.frameAt(i / 72, 0)).filter((frame) => frame.position.y > .8), [course])
  const lanterns = useMemo(() => Array.from({ length: 62 }, (_, i) => {
    const t = i / 62
    if (course.splitAt(t)) return null
    return course.frameAt(t, i % 2 ? 1.9 : -1.9)
  }).filter((frame) => frame !== null), [course])
  return <group>
    {rails.map((geometry, i) => <mesh key={i} geometry={geometry}><meshBasicMaterial color={i % 2 ? '#8fe6d4' : '#ccbaff'} /></mesh>)}
    {piers.map(({ position: p, heading }, i) => <group key={i} position={[p.x, 0, p.z]} rotation={[0, heading, 0]}>
      {[-1.65, 1.65].map((z) => <mesh key={z} position={[0, p.y / 2, z]} castShadow><cylinderGeometry args={[.15, .3, p.y, 6]} /><meshStandardMaterial color="#536681" /></mesh>)}
      <mesh position={[0, p.y - .16, 0]}><boxGeometry args={[.23, .3, 3.65]} /><meshStandardMaterial color="#536681" /></mesh>
    </group>)}
    {lanterns.map(({ position: p }, i) => <group key={i} position={p}>
      <mesh position={[0, .34, 0]}><cylinderGeometry args={[.055, .1, .68, 6]} /><meshStandardMaterial color="#4c6378" /></mesh>
      <mesh position={[0, .76, 0]}><octahedronGeometry args={[.16]} /><meshBasicMaterial color={i % 3 ? MINT : GOLD} /></mesh>
    </group>)}
    {(course.def.currents ?? []).flatMap((zone, index) => Array.from({ length: 10 }, (_, i) => {
      const t = zone.from + (zone.to - zone.from) * (i + .5) / 10
      const frame = course.frameAt(t, 0)
      return <group key={`${index}-${i}`} position={frame.position} rotation={[0, frame.heading, 0]}>
        {/* Chevrons face the same +X direction as a dinosaur. */}
        {[-1, 1].map((side) => <mesh key={side} position={[0, .088, side * .38]} rotation={[-Math.PI / 2, 0, side * Math.PI / 4]}>
          <planeGeometry args={[.16, 1.12]} /><meshBasicMaterial color={MINT} transparent opacity={.8} />
        </mesh>)}
      </group>
    }))}
    {(course.def.currents ?? []).flatMap((zone) => [zone.from, zone.to]).map((t, index) => {
      const frame = course.frameAt(t, 0)
      return <group key={t} position={frame.position} rotation={[0, frame.heading + Math.PI / 2, 0]}>
        <mesh position={[0, .3, 0]}><torusGeometry args={[2.04, .10, 8, 40, Math.PI]} /><meshStandardMaterial color="#547b8a" metalness={.5} roughness={.3} /></mesh>
        <mesh position={[0, .3, 0]}><torusGeometry args={[1.90, .032, 5, 40, Math.PI]} /><meshBasicMaterial color={index % 2 ? GOLD : MINT} /></mesh>
      </group>
    })}
    {course.splits.flatMap((split, index) => [0, 1].map((side) => {
      const frame = course.frameAt((split.from + split.to) / 2, 0, course.splits.map(() => side))
      return <TrailGate key={`${index}-${side}`} position={frame.position} heading={frame.heading} label={split.label.split(' or ')[side].toUpperCase()} color={side ? GOLD : MINT} />
    }))}
  </group>
}

function TrailGate({ position, heading, label, color }: { position: THREE.Vector3; heading: number; label: string; color: string }) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 768; canvas.height = 128
    const context = canvas.getContext('2d')!
    context.fillStyle = '#162b43'; context.fillRect(0, 0, 768, 128)
    context.strokeStyle = color; context.lineWidth = 5; context.strokeRect(6, 6, 756, 116)
    context.fillStyle = color; context.font = 'bold 45px sans-serif'; context.textAlign = 'center'; context.textBaseline = 'middle'
    context.fillText(label, 384, 68)
    const map = new THREE.CanvasTexture(canvas)
    map.colorSpace = THREE.SRGBColorSpace
    return map
  }, [label, color])
  useEffect(() => () => texture.dispose(), [texture])
  return <group position={position} rotation={[0, heading - Math.PI / 2, 0]}>
    {[-1.9, 1.9].map((x) => <mesh key={x} position={[x, 1.4, 0]} castShadow><cylinderGeometry args={[.09, .16, 2.8, 8]} /><meshStandardMaterial color="#556c80" /></mesh>)}
    <mesh position={[0, 2.8, 0]}><boxGeometry args={[4, .64, .15]} /><meshStandardMaterial color="#263f59" /></mesh>
    <mesh position={[0, 2.8, .081]}><planeGeometry args={[3.8, .58]} /><meshBasicMaterial map={texture} toneMapped={false} /></mesh>
    <mesh position={[0, 2.8, -.081]} rotation={[0, Math.PI, 0]}><planeGeometry args={[3.8, .58]} /><meshBasicMaterial map={texture} toneMapped={false} /></mesh>
  </group>
}

function Pterosaurs() {
  const flock = useRef<THREE.Group>(null)
  useFrame(({ clock }) => { if (flock.current) flock.current.rotation.y = clock.elapsedTime * .08 })
  return <group ref={flock} position={[0, 10, -5]}>
    {[0, 1, 2].map((i) => <group key={i} position={[7 + i * 1.7, Math.sin(i) * 1.3, i * 2.6]} rotation={[.1, 0, -.15]} scale={.55}>
      <mesh scale={[1, .3, .25]}><sphereGeometry args={[.65, 10, 8]} /><meshStandardMaterial color="#a3c0d0" /></mesh>
      {[-1, 1].map((side) => <mesh key={side} position={[-.14, .06, side * .83]} rotation={[side * .15, side * .6, Math.PI / 2]} scale={[.24, 1.6, .64]}>
        <coneGeometry args={[1, 1, 3]} /><meshStandardMaterial color="#7c9baf" side={THREE.DoubleSide} />
      </mesh>)}
      <mesh position={[.65, 0, 0]} rotation={[0, 0, -Math.PI / 2]}><coneGeometry args={[.14, .55, 5]} /><meshStandardMaterial color={GOLD} /></mesh>
    </group>)}
  </group>
}

export function AuroraScenery({ course }: { course: Course }) {
  const flora = useMemo(() => Array.from({ length: 145 }, (_, i) => {
    const x = (random(i + 14) - .5) * 55, z = (random(i + 207) - .5) * 42
    if (x * x / 29 ** 2 + z * z / 23 ** 2 > .94 || course.distanceToRoad(x, z) < 2.6) return null
    if (x * x / 12.8 ** 2 + (z - 1) ** 2 / 8.5 ** 2 < 1 || Math.abs(x) < 7 && z < -3 && z > -11) return null
    let terrain = course.terrainAt(x, z), distance = 6
    for (const split of course.splits) for (const side of [0, 1]) {
      for (const p of split.samples[side]) {
        const d = Math.hypot(p.x - x, p.z - z)
        if (d < distance) { distance = d; terrain = split.terrains[side] }
      }
    }
    return { x, z, size: .65 + random(i + 871) * 1.1, i, terrain }
  }).filter((p) => p !== null), [course])
  return <group>
    <AuroraSky />
    {/* Layered island edges give the diorama a deliberate, sculpted silhouette. */}
    <mesh position={[0, -.56, 0]} scale={[29.5, 1, 23.5]}><cylinderGeometry args={[1, .96, .8, 80]} /><meshStandardMaterial color="#182b42" roughness={.9} /></mesh>
    <mesh position={[0, -.13, 0]} scale={[29, 1, 23]} receiveShadow><cylinderGeometry args={[1, 1.015, .2, 80]} /><meshStandardMaterial color="#284951" roughness={1} /></mesh>
    <mesh position={[0, -.01, 1]} rotation={[-Math.PI / 2, 0, 0]} scale={[13.1, 8.7, 1]}><circleGeometry args={[1, 80]} /><meshStandardMaterial color="#498588" roughness={.65} /></mesh>
    <mesh position={[0, .015, 1]} rotation={[-Math.PI / 2, 0, 0]} scale={[12.4, 8, 1]}><circleGeometry args={[1, 80]} /><LivingWater /></mesh>
    <FallsMonument />
    {flora.map((p) => p.terrain === 'Forest' || p.terrain === 'Marsh'
      ? <Moonshroom key={p.i} x={p.x} z={p.z} size={p.size} pink={p.terrain === 'Forest'} />
      : <Crystal key={p.i} position={[p.x, 0, p.z]} size={p.size} color={p.terrain === 'Mountains' ? '#aeacf9' : '#7de0c6'} />)}
    {/* Low shoreline crystals frame the water without hiding the racing line. */}
    {Array.from({ length: 20 }, (_, i) => {
      const a = i / 20 * Math.PI * 2, x = Math.cos(a) * 12.8, z = 1 + Math.sin(a) * 8.5
      if (course.distanceToRoad(x, z) < 2.5 || z < -3) return null
      return <Crystal key={i} position={[x, 0, z]} size={.5} color={MINT} />
    })}
    <Skyway course={course} />
    <Fireflies />
    <Pterosaurs />
  </group>
}
