import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { FrameId, NationId, ShipId } from '@skyriot/shared';
import { world } from '../state/world';
import { SLOTS } from './bricks';
import { fpv } from './fpv';
import { MODEL_SCALE, getModel } from './models';
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
const diamondGeo = new THREE.OctahedronGeometry(1, 0);
const diamondMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 2.4, 2.0), transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false });
const flameGeo = new THREE.ConeGeometry(1, 1, 10, 1, true).translate(0, 0.5, 0).rotateX(Math.PI / 2);

export function FrameModel({ frame, nation, tier, upgrade, sieged, boosting, shipId }: FrameModelProps) {
  const data = useMemo(() => getModel(frame, tier, upgrade), [frame, tier, upgrade]);
  const mats = useMemo(() => getMaterials(nation, upgrade), [nation, upgrade]);
  const flame = useMemo(() => getFlameMaterials(nation), [nation]);

  const flames = useRef<(THREE.Group | null)[]>([]);
  const spinner = useRef<THREE.Group>(null);
  const legs = useRef<(THREE.Group | null)[]>([]);
  const fins = useRef<(THREE.Group | null)[]>([]);
  const diamonds = useRef<(THREE.Mesh | null)[]>([]);
  const padFlames = useRef<(THREE.Group | null)[]>([]);
  const hull = useRef<THREE.Group>(null);
  const hover = useRef<THREE.Group>(null);
  const st = useRef({ boost: 0, siege: sieged ? 1 : 0, ground: 0, leg: 0, fin: 0, kick: 0, was: false, idle: 1, t: Math.random() * 100 });

  useFrame((_, dt) => {
    const s = st.current;
    s.t += dt;
    const b = boosting ?? (shipId ? world.boosting.has(shipId) : false);
    const sg = sieged ?? (shipId ? !!world.ships.get(shipId)?.sieged : false);
    s.boost += ((b ? 1 : 0) - s.boost) * (1 - Math.exp(-8 * dt));
    s.siege += ((sg ? 1 : 0) - s.siege) * (1 - Math.exp(-2.5 * dt));
    const gr0 = !!(shipId && (world.ships.get(shipId) as { grounded?: boolean } | undefined)?.grounded);
    s.leg += ((sg && gr0 ? 1 : 0) - s.leg) * (1 - Math.exp(-2.5 * dt));
    s.fin += ((sg && !gr0 ? 1 : 0) - s.fin) * (1 - Math.exp(-3 * dt));
    if (data.fins) {
      for (let i = 0; i < data.fins.pivots.length; i++) {
        const g = fins.current[i];
        if (!g) continue;
        const side = Math.sign(data.fins.pivots[i]![0]);
        g.rotation.z = side * (1 - s.fin) * -1.45; // folded flat against the hull
        g.scale.x = side;
      }
    }
    if (data.pads) {
      for (let i = 0; i < data.pads.length; i++) {
        const g = padFlames.current[i];
        if (!g) continue;
        const len = (0.5 + s.fin * 2.4) * (1 + 0.15 * Math.sin(s.t * 50 + i * 1.7)) * (1 - s.ground * 0.7);
        g.scale.set(0.6 + s.fin * 0.3, 0.6 + s.fin * 0.3, len);
      }
    }
    if (b && !s.was) s.kick = 1;
    s.was = b;
    s.kick = Math.max(0, s.kick - dt / 0.45);
    for (let i = 0; i < data.engines.length; i++) {
      const g = flames.current[i];
      if (!g) continue;
      const e = data.engines[i]!;
      const flick = 1 + 0.14 * Math.sin(s.t * 47 + i * 2.1) + 0.08 * Math.sin(s.t * 91 + i);
      const len = (0.55 + s.boost * 3.4) * e.r * 4 * flick * (sg ? 0.35 : 1) * (1 + s.kick * 0.7) * s.idle;
      const dm = diamonds.current[i];
      if (dm) {
        dm.visible = s.boost > 0.35;
        dm.position.z = len * (0.38 + 0.04 * Math.sin(s.t * 60 + i));
        dm.scale.set(e.r * 0.55, e.r * 0.55, e.r * (0.9 + 0.3 * Math.sin(s.t * 80 + i * 3)));
      }
      g.scale.set(e.r * (1 + s.boost * 0.3), e.r * (1 + s.boost * 0.3), len);
    }
    const me = shipId ? world.ships.get(shipId) : undefined;
    const docked = !!me?.docked;
    const gr = docked || !!(me as { grounded?: boolean } | undefined)?.grounded;
    const idle = docked ? 0.25 : gr ? 0.45 + Math.min(1, Math.hypot(me!.vel[0], me!.vel[2]) / 25) * 0.35 : 1;
    s.idle += (idle - s.idle) * (1 - Math.exp(-6 * dt));
    s.ground += ((gr ? 1 : 0) - s.ground) * (1 - Math.exp(-5 * dt));
    if (hover.current) hover.current.position.y = -0.55 * s.ground;
    const hv = !(shipId && fpv.id === shipId && fpv.amount > 0.6);
    if (hull.current) hull.current.visible = hv;
    for (const g of legs.current) if (g) g.visible = hv;
    for (const g of flames.current) if (g) g.visible = hv;
    for (const g of fins.current) if (g) g.visible = hv;
    for (const g of padFlames.current) if (g) g.visible = hv;
    if (spinner.current && data.spinner) spinner.current.rotation.z += dt * data.spinner.speed * (1 + s.boost);
    if (data.legs) {
      for (let i = 0; i < data.legs.pivots.length; i++) {
        const g = legs.current[i];
        if (!g) continue;
        const side = Math.sign(data.legs.pivots[i]![0]);
        const e = s.leg * s.leg * (3 - 2 * s.leg);
        g.rotation.z = side * (-1.4 + e * 1.95);
        g.scale.y = 0.55 + 0.45 * e;
      }
    }
  });

  return (
    <group scale={MODEL_SCALE}>
      <group ref={hull}>
        {SLOTS.map((slot) => {
          const g = data.body[slot];
          return g ? <mesh key={slot} geometry={g} material={mats[slot]} castShadow receiveShadow /> : null;
        })}
        {data.hover && (
          <group ref={hover}>
            {SLOTS.map((slot) => {
              const g = data.hover![slot];
              return g ? <mesh key={slot} geometry={g} material={mats[slot]} castShadow receiveShadow /> : null;
            })}
          </group>
        )}
      </group>
      {data.gun &&
        SLOTS.map((slot) => {
          const g = data.gun![slot];
          return g ? <mesh key={slot} geometry={g} material={mats[slot]} castShadow /> : null;
        })}
      {data.spinner && (
        <group ref={spinner} position={data.spinner.pivot}>
          {SLOTS.map((slot) => {
            const g = data.spinner!.geos[slot];
            return g ? <mesh key={slot} geometry={g} material={mats[slot]} castShadow /> : null;
          })}
        </group>
      )}
      {data.fins &&
        data.fins.pivots.map((p, i) => (
          <group key={`f${i}`} position={p} ref={(el) => void (fins.current[i] = el)}>
            {SLOTS.map((slot) => {
              const g = data.fins!.geos[slot];
              return g ? <mesh key={slot} geometry={g} material={mats[slot]} castShadow /> : null;
            })}
          </group>
        ))}
      {data.pads &&
        data.pads.map((p, i) => (
          <group key={`p${i}`} position={[p.pos[0], p.pos[1] - 0.1, p.pos[2]]} rotation={[Math.PI / 2, 0, 0]} ref={(el) => void (padFlames.current[i] = el)}>
            <mesh geometry={flameGeo} material={flame.outer} renderOrder={5} />
            <mesh geometry={flameGeo} material={flame.inner} scale={[0.55, 0.55, 0.6]} renderOrder={6} />
          </group>
        ))}
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
          <mesh ref={(el) => void (diamonds.current[i] = el)} geometry={diamondGeo} material={diamondMat} renderOrder={7} visible={false} />
        </group>
      ))}
    </group>
  );
}
