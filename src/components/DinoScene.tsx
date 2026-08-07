import { Canvas } from '@react-three/fiber'
import { ContactShadows, Environment, OrbitControls } from '@react-three/drei'
import type { DinosaurConfig } from '../game/dinosaurTypes'
import { Dinosaur } from './Dinosaur'

export function DinoScene({ config }: { config: DinosaurConfig }) {
  return (
    <div className="scene">
      <div className="hint">☝️ Drag to spin!</div>
      <Canvas shadows camera={{ position: [6.4, 3.7, 7.2], fov: 38 }} dpr={[1, 1.6]}>
        <ambientLight intensity={1.35} />
        <directionalLight castShadow position={[4, 8, 5]} intensity={2.2} shadow-mapSize={[1024, 1024]} />
        <Dinosaur config={config} />
        <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
          <planeGeometry args={[40, 40]} />
          <meshStandardMaterial color="#8bcf62" roughness={1} />
        </mesh>
        <ContactShadows position={[0, 0.01, 0]} opacity={0.32} scale={9} blur={2.3} far={5} />
        <Environment preset="park" />
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
