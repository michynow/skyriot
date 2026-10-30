import { Suspense, useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { generateHeightfield, type MapDef } from '@skyriot/shared';
import { world } from '../state/world';
import { LaunchDecks } from './LaunchDecks';
import { Scatter } from './Scatter';
import { SkyDome, SUN_DIR } from './SkyDome';
import { Terrain } from './Terrain';

const LIGHT = {
  'desert-dusk': { sun: '#ffa868', sunI: 3.1, sky: '#a89ac8', ground: '#b0653a', hemiI: 0.85 },
  storm: { sun: '#9bb0d0', sunI: 1.2, sky: '#54607a', ground: '#2a2e38', hemiI: 0.9 },
  'space-nebula': { sun: '#ffe2c0', sunI: 3.0, sky: '#3a2a5a', ground: '#0a0a14', hemiI: 0.35 },
} as const;

const SHADOW_R = 260;

function Lights({ map }: { map: MapDef }) {
  const sun = useRef<THREE.DirectionalLight>(null);
  const target = useMemo(() => new THREE.Object3D(), []);
  const L = LIGHT[map.env.sky];
  const dir = SUN_DIR[map.env.sky];
  useFrame(() => {
    const l = sun.current;
    const s = world.ownId ? world.ships.get(world.ownId) : undefined;
    if (!l) return;
    // snap to the shadow texel grid so shadows don't shimmer while the ship moves
    const texel = (SHADOW_R * 2) / 2048;
    const cx = s ? Math.round(s.pos[0] / texel) * texel : 0;
    const cy = s ? s.pos[1] : 200;
    const cz = s ? Math.round(s.pos[2] / texel) * texel : 0;
    target.position.set(cx, cy, cz);
    target.updateMatrixWorld();
    l.position.set(cx + dir.x * 700, cy + dir.y * 700, cz + dir.z * 700);
  });
  return (
    <>
      <hemisphereLight args={[L.sky, L.ground, L.hemiI]} />
      <directionalLight
        ref={sun}
        color={L.sun}
        intensity={L.sunI}
        castShadow
        target={target}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-SHADOW_R}
        shadow-camera-right={SHADOW_R}
        shadow-camera-top={SHADOW_R}
        shadow-camera-bottom={-SHADOW_R}
        shadow-camera-near={50}
        shadow-camera-far={1700}
        shadow-bias={-0.0004}
        shadow-normalBias={0.5}
      />
      <primitive object={target} />
    </>
  );
}

/**
 * Terrain + sky + fog + lights + props for a MapDef. Data-driven by `map.env.sky`
 * ('desert-dusk' | 'storm' | 'space-nebula'). Sets world.map / world.heightfield if unset.
 */
export function MapScene({ map }: { map: MapDef }) {
  const hf = useMemo(() => generateHeightfield(map), [map]);
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    if (world.map !== map) world.map = map;
    if (!world.heightfield || world.heightfield.heights.length !== hf.heights.length) world.heightfield = hf;
  }, [map, hf]);
  useEffect(() => {
    scene.fog = new THREE.Fog(map.env.fogColor, map.env.fogNear * 1.6, map.env.fogFar * 1.25);
    return () => void (scene.fog = null);
  }, [scene, map]);
  const atmos = map.env.kind === 'atmosphere';
  return (
    <>
      <SkyDome env={map.env} />
      <Lights map={map} />
      <LaunchDecks map={map} />
      {atmos && (
        <Suspense fallback={null}>
          <Terrain map={map} hf={hf} />
          <Scatter map={map} hf={hf} />
        </Suspense>
      )}
    </>
  );
}
