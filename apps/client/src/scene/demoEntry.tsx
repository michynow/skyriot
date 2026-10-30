import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { DemoScene } from './DemoScene';
import type { Quality } from './PostFx';

/**
 * Network-free render preview. Open /?demo=render
 * Params: q=low|med|high, view=showcase&focus=0..7&dist=14&yaw=0.6&pitch=0.25
 */
export function RenderDemo() {
  const p = new URLSearchParams(location.search);
  const num = (k: string, d: number) => (p.has(k) ? Number(p.get(k)) : d);
  const quality = (p.get('q') as Quality | null) ?? 'med';
  const opts = {
    showcase: p.get('view') === 'showcase',
    focus: num('focus', 0),
    dist: num('dist', 14),
    yaw: num('yaw', 0.6),
    pitch: num('pitch', 0.25),
  };
  return (
    <Canvas
      shadows="soft"
      dpr={[1, 2]}
      camera={{ fov: 68, near: 0.3, far: 7000, position: [0, 400, 0] }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }}
    >
      <DemoScene quality={quality} opts={opts} />
    </Canvas>
  );
}
