import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { FrameId, NationId, ShipId } from '@skyriot/shared';
import { world } from '../state/world';
import { SLOTS } from './bricks';
import { getModel } from './models';
import { getFlameMaterials, getMaterials } from './palette';

export interface FrameModelProps {
  frame: FrameId;
  nation: NationId;
  tier: number;
  upgrade: number;
  sieged?: boolean;
  boosting?: boolean;
  /** If given, boosting/sieged default to the live values in `world` (read per frame, no re-render). */
  shipId?: ShipId;
}

// Shared flame geometry: base at origin, tip along +Z (behind the ship).
const flameGeo = new THREE.ConeGeometry(1, 1, 10, 1, true).translate(0, 0.5, 0).rotateX(Math.PI / 2);

export function FrameModel({ frame, nation, tier, upgrade, sieged, boosting, shipId }: FrameModelProps) {
  const data = useMemo(() => getModel(frame, tier, upgrade), [frame, tier, upgrade]);
  const mats = useMemo(() => getMaterials(nation, upgrade), [nation, upgrade]);
  const flame = useMemo(() => getFlameMaterials(nation), [nation]);

  const flames = useRef<(THREE.Group | null)[]>([]);
  const spinner = useRef<THREE.Group>(null);
  const legs = useRef<(THREE.Group | null)[]>([]);
  const st = useRef({ boost: 0, siege: sieged ? 1 : 0, t: Math.random() * 100 });

  useFrame((_, dt) => {
    const s = st.current;
    s.t += dt;
    const b = boosting ?? (shipId ? world.boosting.has(shipId) : false);
    const sg = sieged ?? (shipId ? !!world.ships.get(shipId)?.sieged : false);
    s.boost += ((b ? 1 : 0) - s.boost) * (1 - Math.exp(-8 * dt));
    s.siege += ((sg ? 1 : 0) - s.siege) * (1 - Math.exp(-2.5 * dt));
    for (let i = 0; i < data.engines.length; i++) {
      const g = flames.current[i];
      if (!g) continue;
      const e = data.engines[i]!;
      const flick = 1 + 0.14 * Math.sin(s.t * 47 + i * 2.1) + 0.08 * Math.sin(s.t * 91 + i);
      const len = (0.55 + s.boost * 2.6) * e.r * 4 * flick * (sg ? 0.35 : 1);
      g.scale.set(e.r * (1 + s.boost * 0.3), e.r * (1 + s.boost * 0.3), len);
    }
    if (spinner.current && data.spinner) spinner.current.rotation.z += dt * data.spinner.speed * (1 + s.boost);
    if (data.legs) {
      for (let i = 0; i < data.legs.pivots.length; i++) {
        const g = legs.current[i];
        if (!g) continue;
        const side = Math.sign(data.legs.pivots[i]![0]);
        const e = s.siege * s.siege * (3 - 2 * s.siege);
        g.rotation.z = side * (-1.4 + e * 1.95);
        g.scale.y = 0.55 + 0.45 * e;
      }
    }
  });

  return (
    <group>
      {SLOTS.map((slot) => {
        const g = data.body[slot];
        return g ? <mesh key={slot} geometry={g} material={mats[slot]} castShadow receiveShadow /> : null;
      })}
      {data.spinner && (
        <group ref={spinner} position={data.spinner.pivot}>
          {SLOTS.map((slot) => {
            const g = data.spinner!.geos[slot];
            return g ? <mesh key={slot} geometry={g} material={mats[slot]} castShadow /> : null;
          })}
        </group>
      )}
      {data.legs &&
        data.legs.pivots.map((p, i) => (
          <group key={i} position={p} ref={(el) => void (legs.current[i] = el)}>
            {SLOTS.map((slot) => {
              const g = data.legs!.geos[slot];
              return g ? <mesh key={slot} geometry={g} material={mats[slot]} castShadow /> : null;
            })}
          </group>
        ))}
      {data.engines.map((e, i) => (
        <group key={i} position={e.pos} ref={(el) => void (flames.current[i] = el)}>
          <mesh geometry={flameGeo} material={flame.outer} renderOrder={5} />
          <mesh geometry={flameGeo} material={flame.inner} scale={[0.55, 0.55, 0.6]} renderOrder={6} />
        </group>
      ))}
    </group>
  );
}
