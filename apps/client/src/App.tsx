import { Canvas } from '@react-three/fiber';
import { FRAMES } from '@skyriot/shared';

// M0 placeholder. Real composition: docs/ARCHITECTURE.md §4.
export function App() {
  return (
    <>
      <Canvas camera={{ position: [0, 3, 8] }}>
        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 10, 5]} />
        <mesh>
          <boxGeometry args={[2, 0.6, 4]} />
          <meshStandardMaterial color="#e0b040" />
        </mesh>
      </Canvas>
      <div style={{ position: 'absolute', top: 12, left: 12, color: '#fff', font: '14px system-ui' }}>
        SKYRIOT — {Object.values(FRAMES).map((f) => f.name).join(' / ')}
      </div>
    </>
  );
}
