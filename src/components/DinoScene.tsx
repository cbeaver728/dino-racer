import { Canvas } from '@react-three/fiber'
import { ContactShadows, Environment, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { DinosaurConfig } from '../game/dinosaurTypes'
import { Dinosaur } from './Dinosaur'

export function DinoScene({ config }: { config: DinosaurConfig }) {
  return (
    <div className="scene">
      <div className="hint">☝️ Drag to spin!</div>
      {/* `shadows="soft"` uses PCFSoftShadowMap. drei's <SoftShadows> patches
          THREE.ShaderChunk globally, so the save modal's second scene patched it
          a second time and every shader on the page failed to compile. */}
      <Canvas
        shadows="soft"
        camera={{ position: [6.4, 3.7, 7.2], fov: 38 }}
        dpr={[1, 1.6]}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
      >
        <color attach="background" args={['#cdeeff']} />
        <fog attach="fog" args={['#cdeeff', 16, 34]} />

        {/* Low ambient plus a sky/ground bounce keeps the shapes readable.
            A single bright ambient light flattens everything into a silhouette. */}
        <ambientLight intensity={0.32} />
        <hemisphereLight args={['#ddf4ff', '#7fae53', 0.85]} />
        <directionalLight
          castShadow
          position={[5, 8.5, 4.5]}
          intensity={2.4}
          color="#fff3dc"
          shadow-mapSize={[2048, 2048]}
          shadow-bias={-0.0005}
          shadow-camera-left={-8}
          shadow-camera-right={8}
          shadow-camera-top={8}
          shadow-camera-bottom={-8}
        />
        {/* Cool rim light from behind separates the dinosaur from the sky. */}
        <directionalLight position={[-6, 4.5, -5]} intensity={1.1} color="#9fd4ff" />
        <directionalLight position={[0, 2, 8]} intensity={0.45} color="#ffe9d0" />

        <Dinosaur config={config} />

        <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
          <circleGeometry args={[13, 64]} />
          <meshStandardMaterial color="#93d96a" roughness={0.95} />
        </mesh>
        <ContactShadows position={[0, 0.012, 0]} opacity={0.42} scale={10} blur={2.6} far={5} />
        <Environment preset="park" environmentIntensity={0.45} />

        <OrbitControls
          enablePan={false}
          minDistance={7.5}
          maxDistance={10}
          minPolarAngle={Math.PI / 3.4}
          maxPolarAngle={Math.PI / 2.12}
          target={[0, 1.35, 0]}
        />
      </Canvas>
    </div>
  )
}
