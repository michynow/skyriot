import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { FRAMES, type FrameId, type NationId, type ShipId } from '@skyriot/shared';
import { world } from '../state/world';
import { Bricks, SLOTS, type Slot } from './bricks';
import type { FrameModelData } from './models';
import { getMaterials } from './palette';

// ---- shared, module-level GPU resources --------------------------------------------------
const sphere = new THREE.SphereGeometry(1, 24, 16);
const time = { value: 0 };

function auraMat(col: [number, number, number], hex: boolean, strength: number) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    uniforms: { uCol: { value: new THREE.Vector3(...col) }, uTime: time, uK: { value: strength } },
    vertexShader: `varying vec3 vN; varying vec3 vV; varying vec3 vP;
      void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vP = position; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uCol; uniform float uTime; uniform float uK; varying vec3 vN; varying vec3 vV; varying vec3 vP;
      void main(){
        float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.0);
        float m = 1.0;
        ${hex ? `vec3 p = normalize(vP) * 6.0;
        float d = min(min(abs(fract(p.x) - 0.5), abs(fract(dot(p, vec3(-0.5, 0.866, 0.0))) - 0.5)), min(abs(fract(dot(p, vec3(-0.5, -0.866, 0.0)) + p.z * 0.5) - 0.5), abs(fract(p.z * 0.9) - 0.5)));
        m = 0.25 + 1.5 * smoothstep(0.07, 0.0, d);` : `m = 0.8 + 0.2 * sin(uTime * 3.0 + vP.y * 6.0);`}
        gl_FragColor = vec4(uCol * f * m * uK, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}
const AURA = {
  rally: auraMat([0.3, 2.2, 0.7], false, 0.9),
  overcharge: auraMat([0.4, 0.9, 3.0], false, 0.9),
  fortify: auraMat([0.9, 1.7, 2.6], true, 0.55),
  iron: auraMat([1.6, 1.8, 2.2], true, 0.6),
  aegis: auraMat([0.4, 1.4, 3.2], true, 0.6),
};
const odMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 0.7, 0.15), transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false });
const flameGeo = new THREE.ConeGeometry(1, 1, 10, 1, true).translate(0, 0.5, 0).rotateX(Math.PI / 2);
const ghostMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 1.6, 2.4), transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false });
const ringGeo = new THREE.TorusGeometry(1, 0.05, 6, 40);
const ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 1.6, 0.3), toneMapped: false, fog: false });
const orbGeo = new THREE.SphereGeometry(1, 12, 8);

const platingCache = new Map<FrameId, Partial<Record<Slot, THREE.BufferGeometry>>>();
/** Armour plates that snap onto the hull sides and top (sized per frame). */
function platingGeos(frame: FrameId) {
  let g = platingCache.get(frame);
  if (!g) {
    const d = FRAMES[frame];
    const w = (d.radius / MODEL_SCALE_LOCAL) * 0.62, L = (d.halfLength / MODEL_SCALE_LOCAL) * 0.9;
    const b = new Bricks();
    for (const s of [-1, 1]) {
      b.box('dark', [0.22, w * 0.5, L * 1.1], [s * (w + 0.1), 0, L * 0.1], { studs: false });
      b.box('secondary', [0.1, w * 0.3, L * 0.7], [s * (w + 0.26), 0.05, L * 0.1]);
      b.box('accent', [0.05, 0.08, L * 0.9], [s * (w + 0.32), 0.12, L * 0.1]);
    }
    b.box('dark', [w * 1.1, 0.16, L * 0.8], [0, w * 0.42 + 0.1, L * 0.2], { studs: true });
    g = b.build();
    platingCache.set(frame, g);
  }
  return g;
}
const MODEL_SCALE_LOCAL = 2; // matches models.MODEL_SCALE (kept local to avoid import cycles at module init)

const easeOutBack = (x: number) => 1 + 2.7 * Math.pow(x - 1, 3) + 1.7 * Math.pow(x - 1, 2);

interface Props { shipId: ShipId; frame: FrameId; nation: NationId; upgrade: number; data: FrameModelData }

/** Persistent skill/buff visuals driven by ShipState each frame. Shared materials, pooled (always-mounted) meshes. */
export function BuffVisuals({ shipId, frame, nation, upgrade, data }: Props) {
  const mats = useMemo(() => getMaterials(nation, upgrade), [nation, upgrade]);
  const def = FRAMES[frame];
  const rad = def.radius / MODEL_SCALE_LOCAL, len = def.halfLength / MODEL_SCALE_LOCAL;
  const plating = useMemo(() => platingGeos(frame), [frame]);

  const auras = useRef<Record<string, THREE.Mesh | null>>({});
  const od = useRef<(THREE.Mesh | null)[]>([]);
  const plate = useRef<THREE.Group>(null);
  const ghosts = useRef<(THREE.Group | null)[]>([]);
  const calib = useRef<THREE.Group>(null);
  const doors = useRef<(THREE.Group | null)[]>([]);
  const rings = useRef<(THREE.Mesh | null)[]>([]);
  const st = useRef({ plate: 0, od: 0, bay: 0, hist: Array.from({ length: 16 }, () => new THREE.Matrix4()), hn: 0, ht: 0, ghost: 0, t: 0 });
  const inv = useMemo(() => new THREE.Matrix4(), []);

  useFrame((_, dt) => {
    const s = st.current;
    s.t += dt;
    time.value = s.t;
    const ship = world.ships.get(shipId);
    if (!ship) return;
    let rally = false, charge = false, fort = false, overdrive = false, phantom = false, bulk = false, calibr = false, aegis = false;
    for (const b of ship.buffs) {
      switch (b.skill) {
        case 'rally-field': rally = true; break;
        case 'overcharge': charge = true; break;
        case 'fortify': fort = true; break;
        case 'overdrive': overdrive = true; break;
        case 'phantom-weave': phantom = true; break;
        case 'bulk-plating': bulk = true; break;
        case 'barrage-calibration': calibr = true; break;
      }
    }
    const iron = ship.ironTicks > 0;
    phantom = phantom || ship.ghostTicks > 0;
    aegis = ship.toggles?.shield === 'aegis-bubble';
    const set = (k: string, on: boolean, sc: number) => {
      const m = auras.current[k];
      if (!m) return;
      m.visible = on;
      if (on) m.scale.set(rad * sc, rad * sc * 0.72, len * sc * 1.15);
    };
    set('rally', rally, 1.5);
    set('overcharge', charge, 1.62);
    set('fortify', fort, 1.35);
    set('iron', iron, 1.22);
    set('aegis', aegis, 2.4);

    // Overdrive: extra red-orange flame sheath on every engine
    s.od += ((overdrive ? 1 : 0) - s.od) * (1 - Math.exp(-6 * dt));
    for (let i = 0; i < data.engines.length; i++) {
      const m = od.current[i];
      if (!m) continue;
      m.visible = s.od > 0.05;
      const e = data.engines[i]!;
      const f = 1 + 0.2 * Math.sin(s.t * 55 + i);
      m.scale.set(e.r * 1.5 * s.od, e.r * 1.5 * s.od, e.r * 9 * s.od * f);
    }

    // Bulk plating: snap on with overshoot, off by scaling away
    s.plate += ((bulk ? 1 : 0) - s.plate) * (1 - Math.exp(-12 * dt)) + (bulk ? Math.min(dt * 3, 1 - s.plate) * 0.6 : 0);
    s.plate = Math.min(1, Math.max(0, s.plate));
    if (plate.current) {
      plate.current.visible = s.plate > 0.02;
      const k = easeOutBack(s.plate);
      plate.current.scale.set(1 + (1 - k) * 0.6, 1 + (1 - k) * 0.4, 1);
      plate.current.position.y = (1 - s.plate) * 0.5;
    }

    // Anvil bay doors: open for Ground Strike
    const ground = ship.toggles?.bombing === 'ground-strike-mode';
    s.bay += ((ground ? 1 : 0) - s.bay) * (1 - Math.exp(-5 * dt));
    for (let i = 0; i < 2; i++) {
      const g = doors.current[i];
      if (!g) continue;
      const side = i === 0 ? 1 : -1;
      g.rotation.z = side * 1.25 * s.bay;
    }

    // Barrage calibration: orbiting rings around the muzzle
    if (calib.current) {
      calib.current.visible = calibr;
      if (calibr) {
        for (let i = 0; i < 2; i++) {
          const r = rings.current[i];
          if (r) { r.rotation.x = s.t * (2.2 + i) + i; r.rotation.y = s.t * (1.4 - i * 0.6); r.position.z = Math.sin(s.t * 3 + i * 3) * 0.5; }
        }
      }
    }

    // Phantom afterimages: ghost copies at past transforms (relative to the live model root)
    const root = plate.current?.parent;
    s.ghost += ((phantom ? 1 : 0) - s.ghost) * (1 - Math.exp(-8 * dt));
    if (root) {
      if (phantom) {
        s.ht += dt;
        if (s.ht >= 0.03) {
          s.ht = 0;
          s.hist[s.hn % 16]!.copy(root.matrixWorld);
          s.hn++;
        }
        inv.copy(root.matrixWorld).invert();
      }
      for (let k = 0; k < 3; k++) {
        const g = ghosts.current[k];
        if (!g) continue;
        const idx = s.hn - 3 * (k + 1);
        g.visible = phantom && idx >= 0;
        if (g.visible) g.matrix.multiplyMatrices(inv, s.hist[((idx % 16) + 16) % 16]!);
      }
    }
  });

  const keys: [string, THREE.ShaderMaterial][] = [['rally', AURA.rally], ['overcharge', AURA.overcharge], ['fortify', AURA.fortify], ['iron', AURA.iron], ['aegis', AURA.aegis]];
  return (
    <>
      {keys.map(([k, m]) => (
        <mesh key={k} ref={(el) => void (auras.current[k] = el)} geometry={sphere} material={m} visible={false} renderOrder={9} />
      ))}
      {data.engines.map((e, i) => (
        <group key={i} position={e.pos}>
          <mesh ref={(el) => void (od.current[i] = el)} geometry={flameGeo} material={odMat} visible={false} renderOrder={7} />
        </group>
      ))}
      <group ref={plate} visible={false}>
        {SLOTS.map((slot) => {
          const g = plating[slot];
          return g ? <mesh key={slot} geometry={g} material={mats[slot]} castShadow /> : null;
        })}
      </group>
      {[0, 1, 2].map((k) => (
        <group key={k} ref={(el) => { ghosts.current[k] = el; if (el) el.matrixAutoUpdate = false; }} visible={false}>
          {SLOTS.map((slot) => {
            const g = data.body[slot];
            return g ? <mesh key={slot} geometry={g} material={ghostMat} renderOrder={8} /> : null;
          })}
        </group>
      ))}
      {frame === 'bulwark' && (
        <group ref={calib} position={[0, 1.6, -4.1]} visible={false}>
          <mesh geometry={orbGeo} material={ringMat} scale={0.35} />
          <mesh ref={(el) => void (rings.current[0] = el)} geometry={ringGeo} material={ringMat} scale={0.9} />
          <mesh ref={(el) => void (rings.current[1] = el)} geometry={ringGeo} material={ringMat} scale={1.3} />
        </group>
      )}
      {frame === 'anvil' &&
        [1, -1].map((side, i) => (
          <group key={side} position={[side * 0.8, -1.03, 0.9]} ref={(el) => void (doors.current[i] = el)} scale={[-side, 1, 1]}>
            <mesh material={mats.secondary} castShadow position={[0.4, 0, 0]}>
              <boxGeometry args={[0.8, 0.06, 3.3]} />
            </mesh>
          </group>
        ))}
    </>
  );
}
