import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import {
  FRAMES,
  WEAPONS,
  sampleHeight,
  type WeaponLook,
  type NationId,
  type ProjectileKind,
  type ShipId,
  type ShipState,
  type SimEvent,
} from '@skyriot/shared';
import { PALETTES, trailRgb } from '../frames/palette';
import { MODEL_SCALE, getModel } from '../frames/models';
import { lookOf } from '../frames/look';
import { camSnap } from '../scene/ChaseCamera';
import { rollAngle, rollDirs } from '../frames/roll';
import { takeLocalShot } from '../net/ownShots';
import { world } from '../state/world';
import { skillActivation, updateBeams } from './skillFx';
import { ShellSet } from './shells';
import { ParticlePool, SpriteBatch } from './sprites';

// ---- tuning -------------------------------------------------------------------------------
const MAX_PROJ = 512;
const PS = 16; // projectile float stride
const MAX_DEBRIS = 320;
const MAX_BUBBLES = 24;
const MAX_ROLLS = 16;
const TRAIL_SPACING = 0.6;
const TRAIL_CULL_DIST = 1400;
/** Guided missiles: body scale and exhaust streak length (m) so they read at combat range. */
const MISSILE_BODY_SCALE = 2.2;
const MISSILE_STREAK_M = 22;

type RGB = [number, number, number];
const TRACER: Record<NationId, RGB> = { concord: [0.35, 1.5, 2.4], vex: [2.6, 0.35, 0.22] };
const ACCENT: Record<NationId, RGB> = { concord: [0.2, 1.1, 1.8], vex: [1.8, 0.6, 0.14] };

const KIND_ID: Record<ProjectileKind, number> = {
  tracer: 0,
  missile: 1,
  rocket: 2,
  shell: 3,
};
const DEFAULT_LOOK: WeaponLook = {
  trail: 'thin',
  warhead: 'dart',
  blast: 'flash',
  color: [3, 1.9, 0.7],
};
/** Rockets fired level (Anvil air modes) read as spiralling fat rockets, bombs dropped down keep the weapon look. */
const AIR_ROCKET: Partial<WeaponLook> = { trail: 'spiral', warhead: 'fat', blast: 'fireball' };
const WARHEADS: WeaponLook['warhead'][] = ['dart', 'fat', 'bomb', 'pod', 'shell'];
/** Trail styles: smoke size / life / spiral radius multipliers, puff spacing, flame core strength, smoke grey, alpha. */
const TRAIL = {
  thin: {
    size: 0.45,
    life: 0.8,
    rad: 0.25,
    step: 0.012,
    flame: 1,
    grey: 0.85,
    alpha: 0.3,
    streak: 1.8,
  },
  billow: {
    size: 2.2,
    life: 1.5,
    rad: 0.3,
    step: 0.02,
    flame: 0.7,
    grey: 0.45,
    alpha: 0.5,
    streak: 0.8,
  },
  spiral: { size: 1, life: 1, rad: 1.7, step: 0.012, flame: 1, grey: 0.8, alpha: 0.3, streak: 1 },
  arc: { size: 0.35, life: 1.6, rad: 0, step: 0.05, flame: 0, grey: 0.7, alpha: 0.12, streak: 0 },
  ion: { size: 1, life: 1, rad: 1, step: 0.02, flame: 0, grey: 1, alpha: 0, streak: 1 },
} as const;
const rnd = Math.random;
const rr = (a: number, b: number) => a + (b - a) * rnd();

interface Trail {
  x: number;
  y: number;
  z: number;
  has: boolean;
}

// ---- projectile pool (struct of arrays) -------------------------------------------------
class Projectiles {
  n = 0;
  id = new Int32Array(MAX_PROJ);
  kind = new Uint8Array(MAX_PROJ);
  /** pos(3) vel(3) col(3) | range-left or lifetime, emitAcc, splash, turnRate, age, wobble seed, ember acc */
  f = new Float32Array(MAX_PROJ * PS);
  /** 0 sting missile, 1 seeker pod (plasma orb), 2 heavy (bomb / mortar) */
  style = new Uint8Array(MAX_PROJ);
  look: WeaponLook[] = new Array(MAX_PROJ).fill(DEFAULT_LOOK);
  target: (ShipId | null)[] = new Array(MAX_PROJ).fill(null);
  evaded = new Uint8Array(MAX_PROJ);
  /** last seen snapshot position (3) + time it changed, per projectile */
  snap = new Float32Array(MAX_PROJ * 4);
  hasSnap = new Uint8Array(MAX_PROJ);

  add(e: Extract<SimEvent, { type: 'projectileSpawned' }>, col: RGB) {
    if (this.n >= MAX_PROJ) return;
    const i = this.n++,
      o = i * PS,
      f = this.f;
    const w = WEAPONS[e.weapon];
    this.id[i] = e.id;
    this.kind[i] = KIND_ID[e.kind];
    f[o] = e.origin[0];
    f[o + 1] = e.origin[1];
    f[o + 2] = e.origin[2];
    f[o + 3] = e.dir[0] * e.speed;
    f[o + 4] = e.dir[1] * e.speed;
    f[o + 5] = e.dir[2] * e.speed;
    f[o + 6] = col[0];
    f[o + 7] = col[1];
    f[o + 8] = col[2];
    f[o + 9] = w?.rangeM ?? 1000;
    f[o + 10] = 0;
    f[o + 11] = w?.splashRadius ?? 0;
    f[o + 12] = w?.homingTurnRate ?? 0;
    this.target[i] = e.target;
    this.evaded[i] = 0;
    this.hasSnap[i] = 0;
    f[o + 13] = 0;
    f[o + 14] = rnd() * 6.28;
    f[o + 15] = 0;
    const air = e.kind === 'rocket' && e.dir[1] >= -0.6;
    this.look[i] = w?.look ? (air ? { ...w.look, ...AIR_ROCKET } : w.look) : DEFAULT_LOOK;
    this.style[i] =
      e.kind === 'rocket' && e.dir[1] < -0.6
        ? 3
        : e.kind === 'rocket' || e.kind === 'shell'
          ? 2
          : 0;
  }
  find(id: number) {
    for (let i = 0; i < this.n; i++) if (this.id[i] === id) return i;
    return -1;
  }
  remove(i: number) {
    const l = --this.n;
    if (i !== l) {
      this.id[i] = this.id[l]!;
      this.kind[i] = this.kind[l]!;
      this.evaded[i] = this.evaded[l]!;
      this.hasSnap[i] = this.hasSnap[l]!;
      for (let m = 0; m < 4; m++) this.snap[i * 4 + m] = this.snap[l * 4 + m]!;
      this.style[i] = this.style[l]!;
      this.look[i] = this.look[l]!;
      this.target[i] = this.target[l]!;
      for (let k = 0; k < PS; k++) this.f[i * PS + k] = this.f[l * PS + k]!;
    }
    this.target[l] = null;
  }
}

// ---- component ---------------------------------------------------------------------------
export function ProjectilesFx() {
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);

  const fx = useMemo(makeFx, []);
  (window as unknown as { __fx: unknown }).__fx = fx;

  useEffect(() => {
    const objs = [
      fx.additive.mesh,
      fx.smoke.mesh,
      fx.streaks.mesh,
      fx.rings.mesh,
      fx.ringsFlat.mesh,
      fx.boomLight,
      ...fx.bodies,
      fx.debris,
      fx.sph.mesh,
      fx.hex.mesh,
    ];
    objs.forEach((o) => scene.add(o));
    return () => objs.forEach((o) => scene.remove(o));
  }, [scene, fx]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    fx.time += dt;
    fx.camPos.copy(camera.position);
    handleEvents(fx, dt);
    updateProjectiles(fx, dt);
    updateDebris(fx, dt);
    updateBeams(fx, dt);
    fx.sph.update(dt);
    fx.hex.update(dt);
    updateShipFx(fx, dt, camera.position);
    fx.glow.update(dt, fx.additive);
    fx.puffs.update(dt, fx.smoke);
    fx.ringP.update(dt, fx.rings);
    fx.ringFlatP.update(dt, fx.ringsFlat);
    fx.boomLight.intensity *= Math.exp(-9 * dt);
    if (fx.boomLight.intensity < 0.05) fx.boomLight.intensity = 0;
    fx.additive.flush();
    fx.smoke.flush();
    fx.streaks.flush();
    fx.rings.flush();
    fx.ringsFlat.flush();
  });
  return null;
}

export type Fx = ReturnType<typeof makeFx>;

function makeFx() {
  const additive = new SpriteBatch(26000, true); // glow, sparks, fire, trails
  const smoke = new SpriteBatch(9000, false);
  const rings = new SpriteBatch(400, true, 'ring');
  const ringsFlat = new SpriteBatch(200, true, 'ringFlat');
  const ringP = new ParticlePool(400);
  const ringFlatP = new ParticlePool(200);
  const boomLight = new THREE.PointLight('#ffa050', 0, 160, 2);
  const streaks = new SpriteBatch(1100, true); // tracer streaks
  const glow = new ParticlePool(24000);
  const puffs = new ParticlePool(9000);

  // warhead models (nose along -Z), one instanced mesh each
  const cyl = (r: number, len: number, z = 0, x = 0, y = 0) =>
    new THREE.CylinderGeometry(r, r * 1.15, len, 8).rotateX(Math.PI / 2).translate(x, y, z);
  const cone = (r: number, len: number, z: number, x = 0, y = 0) =>
    new THREE.ConeGeometry(r, len, 8).rotateX(-Math.PI / 2).translate(x, y, z - len / 2);
  const fins = (span: number, chord: number, z: number) => [
    new THREE.BoxGeometry(span, 0.015, chord).translate(0, 0, z),
    new THREE.BoxGeometry(0.015, span, chord).translate(0, 0, z),
  ];
  const geos: Record<WeaponLook['warhead'], [THREE.BufferGeometry[], string]> = {
    dart: [[cyl(0.05, 1.4), cone(0.05, 0.6, -0.7), ...fins(0.34, 0.25, 0.55)], '#e8e8ee'],
    fat: [[cyl(0.17, 1, 0), cone(0.17, 0.45, -0.5), ...fins(0.5, 0.3, 0.4)], '#8a8f6a'],
    bomb: [
      [new THREE.SphereGeometry(0.24, 10, 8).scale(1, 1, 2.3), ...fins(0.62, 0.35, 0.5)],
      '#3c4048',
    ],
    pod: [
      [-0.09, 0.09, 0].flatMap((x, n) => [
        cyl(0.07, 1, 0, x, n === 2 ? 0.14 : 0),
        cone(0.07, 0.3, -0.5, x, n === 2 ? 0.14 : 0),
      ]),
      '#7fb0c0',
    ],
    shell: [[cyl(0.15, 0.7), cone(0.15, 0.3, -0.35), cyl(0.17, 0.08, 0.25)], '#c9a24a'],
  };
  const bodies = WARHEADS.map((wh) => {
    const m = new THREE.InstancedMesh(
      merge(geos[wh][0]),
      new THREE.MeshStandardMaterial({
        color: geos[wh][1],
        roughness: 0.4,
        metalness: 0.5,
        emissive: '#331a08',
        emissiveIntensity: 1,
      }),
      96,
    );
    m.count = 0;
    m.frustumCulled = false;
    m.castShadow = false;
    return m;
  });

  // debris bricks
  const debris = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 0.6, 1),
    new THREE.MeshStandardMaterial({
      roughness: 0.6,
      metalness: 0.1,
      emissive: '#5a3a24',
      emissiveIntensity: 0.9,
    }),
    MAX_DEBRIS,
  );
  debris.count = 0;
  debris.frustumCulled = false;
  debris.castShadow = true;
  debris.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_DEBRIS * 3), 3);

  const o = new THREE.Object3D();
  const sph = new ShellSet(MAX_BUBBLES, false, o);
  const hex = new ShellSet(16, true, o);
  return {
    additive,
    smoke,
    streaks,
    glow,
    puffs,
    rings,
    ringsFlat,
    ringP,
    ringFlatP,
    boomLight,
    bodies,
    debris,
    sph,
    hex,
    proj: new Projectiles(),
    // debris state
    dN: 0,
    dp: new Float32Array(MAX_DEBRIS * 3),
    dv: new Float32Array(MAX_DEBRIS * 3),
    dr: new Float32Array(MAX_DEBRIS * 3),
    ds: new Float32Array(MAX_DEBRIS * 3),
    dl: new Float32Array(MAX_DEBRIS * 3), // life, maxLife, smoke timer
    dsc: new Float32Array(MAX_DEBRIS * 3),
    rolls: Array.from({ length: MAX_ROLLS }, () => ({ id: '', t: 0, dir: 1 })),
    rN: 0,
    trails: new Map<ShipId, Trail[]>(),
    o,
    q: new THREE.Quaternion(),
    v: new THREE.Vector3(),
    v2: new THREE.Vector3(),
    fwd: new THREE.Vector3(0, 0, -1),
    c: new THREE.Color(),
    time: 0,
    camPos: new THREE.Vector3(),
    beams: Array.from({ length: 48 }, () => ({ src: '', dst: '', t: 0, T: 1, r: 0, g: 0, b: 0 })),
    bn: 0,
    cu: new THREE.Vector3(),
    cw: new THREE.Vector3(),
    boomT: new Map<ShipId, number>(),
  };
}

function merge(parts: THREE.BufferGeometry[]) {
  const ps = parts.map((p) => p.toNonIndexed());
  const g = new THREE.BufferGeometry();
  for (const k of ['position', 'normal']) {
    const arrs = ps.map((p) => p.getAttribute(k).array as Float32Array);
    const m = new Float32Array(arrs.reduce((n, a) => n + a.length, 0));
    let off = 0;
    for (const a of arrs) {
      m.set(a, off);
      off += a.length;
    }
    g.setAttribute(k, new THREE.BufferAttribute(m, 3));
  }
  return g;
}

// ---- events -----------------------------------------------------------------------------
function handleEvents(fx: Fx, _dt: number) {
  const q = world.fxQueue;
  if (!q.length) return;
  const events = q.splice(0, q.length);
  for (const e of events) {
    // missileEvaded is added to the contract by the sim agent; handled structurally until then
    const loose = e as unknown as {
      type: string;
      projectile?: number;
      id?: number;
      pos?: [number, number, number];
    };
    if (loose.type === 'missileEvaded') {
      const i = fx.proj.find(loose.projectile ?? loose.id ?? -1);
      if (i >= 0) {
        fx.proj.evaded[i] = 1;
        fx.proj.target[i] = null; // stops homing: it overshoots
        const p: [number, number, number] = loose.pos ?? [
          fx.proj.f[i * PS]!,
          fx.proj.f[i * PS + 1]!,
          fx.proj.f[i * PS + 2]!,
        ];
        sparks(fx, p, 40, false);
        fx.glow.emit(p[0], p[1], p[2], 0, 0, 0, 0.3, 8, 1, 1.4, 2.2, 3, 0.9);
        fx.ringP.emit(p[0], p[1], p[2], 0, 0, 0, 0.5, 2, 18, 1.2, 2.0, 3.0, 0.9);
      }
      continue;
    }
    switch (e.type) {
      case 'projectileSpawned': {
        const localId = takeLocalShot(e.id);
        if (localId !== undefined) {
          // Already drawn when fired locally: move it onto the server's id and path, same distance out.
          const i = fx.proj.find(localId);
          if (i >= 0) {
            const o = i * PS,
              f = fx.proj.f;
            const d = Math.hypot(
              f[o]! - e.origin[0],
              f[o + 1]! - e.origin[1],
              f[o + 2]! - e.origin[2],
            );
            fx.proj.id[i] = e.id;
            for (let k = 0; k < 3; k++) {
              f[o + k] = e.origin[k]! + e.dir[k]! * d;
              f[o + 3 + k] = e.dir[k]! * e.speed;
            }
          }
          break;
        }
        const nation = world.ships.get(e.owner)?.nation ?? 'concord';
        fx.proj.add(e, TRACER[nation]);
        if (e.kind !== 'tracer')
          for (let n = 0; n < 10; n++)
            fx.puffs.emit(
              e.origin[0] - e.dir[0] * rr(1, 5),
              e.origin[1] - e.dir[1] * rr(1, 5),
              e.origin[2] - e.dir[2] * rr(1, 5),
              rr(-6, 6) - e.dir[0] * 8,
              rr(-6, 6) - e.dir[1] * 8,
              rr(-6, 6) - e.dir[2] * 8,
              rr(0.8, 1.5),
              2,
              9,
              0.95,
              0.92,
              0.88,
              0.5,
              1.2,
              -0.2,
              0.4,
              0.38,
              0.37,
            );
        // muzzle flash
        const [c0, c1, c2] = TRACER[nation];
        fx.glow.emit(
          e.origin[0],
          e.origin[1],
          e.origin[2],
          0,
          0,
          0,
          0.07,
          e.kind === 'tracer' ? 1.4 : 3,
          0.4,
          c0 * 1.5,
          c1 * 1.5,
          c2 * 1.5,
          1,
        );
        break;
      }
      case 'projectileExpired': {
        const i = fx.proj.find(e.id);
        if (i >= 0) {
          const k = fx.proj.kind[i]!;
          const splash = fx.proj.f[i * PS + 11]!,
            st = fx.proj.style[i]!,
            lk = fx.proj.look[i]!;
          fx.proj.remove(i);
          if (k === 1 || k === 2 || k === 3)
            blast(
              fx,
              e.pos,
              Math.max(0.5, splash / 8) * (st === 3 ? 2.6 : k > 1 ? 1.7 : 1),
              lk,
              k > 1,
            );
        }
        break;
      }
      case 'hit': {
        const i = fx.proj.find(e.projectile);
        let splash = 0,
          k = 0,
          st = 0,
          lk = DEFAULT_LOOK;
        if (i >= 0) {
          lk = fx.proj.look[i]!;
          splash = fx.proj.f[i * PS + 11]!;
          k = fx.proj.kind[i]!;
          st = fx.proj.style[i]!;
          fx.proj.remove(i);
        }
        const victim = world.ships.get(e.victim);
        if (k === 0 && victim) tracerImpact(fx, e, victim);
        else sparks(fx, e.pos, e.deflected ? 12 : 8, e.deflected);
        const own = world.ownId ? world.ships.get(world.ownId) : undefined;
        if (own && e.attacker === own.id) {
          // Own hits: a flash that stays a few pixels wide at any range, so you see you're connecting.
          const d = Math.hypot(e.pos[0] - own.pos[0], e.pos[1] - own.pos[1], e.pos[2] - own.pos[2]);
          const sz = Math.max(3, d * 0.02);
          fx.glow.emit(e.pos[0], e.pos[1], e.pos[2], 0, 0, 0, 0.12, sz, sz * 0.3, 3, 2.2, 1, 1);
        }
        if (k === 1 || k === 2 || k === 3)
          blast(
            fx,
            e.pos,
            Math.max(0.5, splash / 8) * (st === 3 ? 2.6 : k > 1 ? 1.7 : 1),
            lk,
            k > 1,
          );
        if (victim && (e.deflected || victim.shield > 0)) {
          const col = e.deflected ? ([1.6, 1.8, 2.4] as RGB) : ACCENT[victim.nation];
          bubble(fx, e.victim, col, e.deflected ? 0.6 : k === 0 ? Math.min(1, e.damage / 60) : 1);
        }
        break;
      }
      case 'shipDestroyed': {
        const v = world.ships.get(e.victim);
        if (!boomOnce(fx, e.victim)) break;
        const k = v ? 1.2 + FRAMES[v.frame].radius * 0.3 : 2.5;
        // Your kill: heavy boom (bigger ring, flash, shake) so the payoff reads.
        explosion(
          fx,
          e.pos,
          e.killer === world.ownId ? k * 1.4 : k,
          true,
          v?.nation,
          e.killer === world.ownId,
        );
        break;
      }
      case 'shipRespawned': {
        const n = world.ships.get(e.id)?.nation ?? 'concord';
        const [r, g, b] = ACCENT[n];
        for (let i = 0; i < 24; i++) {
          const a = (i / 24) * Math.PI * 2;
          fx.glow.emit(
            e.pos[0],
            e.pos[1],
            e.pos[2],
            Math.cos(a) * 30,
            rr(-3, 3),
            Math.sin(a) * 30,
            0.6,
            1.5,
            0.3,
            r * 1.5,
            g * 1.5,
            b * 1.5,
            1,
            3,
          );
        }
        fx.glow.emit(e.pos[0], e.pos[1], e.pos[2], 0, 0, 0, 0.35, 4, 18, r, g, b, 0.8);
        break;
      }
      case 'barrelRoll': {
        if (fx.rN < MAX_ROLLS) {
          const r = fx.rolls[fx.rN++]!;
          r.id = e.id;
          r.t = 0.8;
          r.dir = e.dir;
          rollDirs.set(e.id, e.dir);
        }
        break;
      }
      case 'terrainImpact': {
        const s = world.ships.get(e.id);
        dust(fx, e.pos, Math.min(2, 0.8 + e.damage / 300));
        if (e.bounced) {
          sparks(fx, e.pos, 26, false);
          if (s) bubble(fx, e.id, ACCENT[s.nation], 1.4);
        } else if (boomOnce(fx, e.id)) {
          explosion(fx, e.pos, s ? 1.2 + FRAMES[s.frame].radius * 0.3 : 2.5, true, s?.nation);
        }
        break;
      }
      case 'launched': {
        const s = world.ships.get(e.id);
        if (!s) break;
        const [r, g, b] = ACCENT[s.nation];
        for (let i = 0; i < 40; i++) {
          const a = rnd() * 6.28,
            sp = rr(4, 26);
          fx.glow.emit(
            s.pos[0],
            s.pos[1] - 1,
            s.pos[2],
            Math.cos(a) * sp,
            rr(-30, -8),
            Math.sin(a) * sp,
            rr(0.3, 0.8),
            2.2,
            0.4,
            r * 2,
            g * 2,
            b * 2,
            0.9,
            1.5,
          );
        }
        for (let i = 0; i < 14; i++)
          fx.puffs.emit(
            s.pos[0],
            s.pos[1] - 2,
            s.pos[2],
            rr(-12, 12),
            rr(-4, 2),
            rr(-12, 12),
            rr(1, 2),
            3,
            10,
            0.7,
            0.62,
            0.55,
            0.4,
            1.4,
          );
        break;
      }
      case 'resupplied': {
        const s = world.ships.get(e.id);
        if (!s) break;
        for (let i = 0; i < 20; i++) {
          const a = rnd() * 6.28,
            rad = FRAMES[s.frame].radius * rr(0.6, 1.4);
          fx.glow.emit(
            s.pos[0] + Math.cos(a) * rad,
            s.pos[1] + rr(-1, 1),
            s.pos[2] + Math.sin(a) * rad,
            0,
            rr(3, 7),
            0,
            rr(0.6, 1.1),
            0.5,
            0.1,
            0.5,
            2.2,
            0.9,
            0.9,
            0.5,
            -1,
          );
        }
        break;
      }
      case 'teleport':
        if (e.id === world.ownId) camSnap.pending = true;
        break;
      case 'skillUsed':
        skillActivation(fx, e);
        break;
      case 'docked':
        break;
    }
  }
}

/** True the first time a ship's death explosion is requested within 0.8s (terrainImpact + shipDestroyed both fire). */
function boomOnce(fx: Fx, id: ShipId) {
  const last = fx.boomT.get(id);
  if (last !== undefined && fx.time - last < 0.8) return false;
  fx.boomT.set(id, fx.time);
  return true;
}

function sparks(fx: Fx, p: [number, number, number], n: number, blue: boolean) {
  for (let i = 0; i < n; i++) {
    const s = rr(15, 60);
    const x = rnd() - 0.5,
      y = rnd() - 0.2,
      z = rnd() - 0.5;
    const l = 1 / Math.hypot(x, y, z);
    fx.glow.emit(
      p[0],
      p[1],
      p[2],
      x * l * s,
      y * l * s,
      z * l * s,
      rr(0.15, 0.45),
      0.45,
      0.08,
      blue ? 1.2 : 2.6,
      blue ? 1.8 : 1.5,
      blue ? 2.6 : 0.5,
      1,
      2,
      18,
    );
  }
  fx.glow.emit(p[0], p[1], p[2], 0, 0, 0, 0.1, 2.6, 0.5, 3, 2.6, 2, 1);
}

/**
 * A landed Primary round, scaled by damage. Hull: orange sparks, a flash on the skin and chips of debris.
 * Shield (inferred from the last snapshot): no sparks, a cool flash and ring on the bubble. The point is
 * pulled from the Ship's centre out to its hull, towards the attacker.
 */
function tracerImpact(fx: Fx, e: Extract<SimEvent, { type: 'hit' }>, victim: ShipState) {
  const rad = FRAMES[victim.frame].radius;
  const a = world.ships.get(e.attacker);
  const p: [number, number, number] = [e.pos[0], e.pos[1], e.pos[2]];
  if (a) {
    const dx = a.pos[0] - p[0],
      dy = a.pos[1] - p[1],
      dz = a.pos[2] - p[2];
    const l = (rad * 0.8) / (Math.hypot(dx, dy, dz) || 1);
    p[0] += dx * l;
    p[1] += dy * l;
    p[2] += dz * l;
  }
  const power = Math.min(3, Math.max(0.5, e.damage / 40));
  if (e.deflected || victim.shield > 1) {
    fx.glow.emit(p[0], p[1], p[2], 0, 0, 0, 0.14, rad * 0.5 * power, rad * 0.2, 0.8, 1.8, 3, 1);
    fx.ringP.emit(p[0], p[1], p[2], 0, 0, 0, 0.3, 1, rad * 0.9 * power, 0.5, 1.4, 2.4, 0.8);
    sparks(fx, p, e.deflected ? 8 : 2, true);
    return;
  }
  sparks(fx, p, Math.round(4 + power * 5), false);
  fx.glow.emit(p[0], p[1], p[2], 0, 0, 0, 0.1, rad * 0.6 * power, rad * 0.15, 3, 1.9, 0.9, 1);
  const pal = PALETTES[victim.nation];
  for (let i = 0; i < Math.round(power); i++) {
    fx.c.set(i % 2 ? pal.primary : pal.dark);
    spawnDebris(fx, p, [fx.c.r, fx.c.g, fx.c.b], rr(12, 30), rr(0.12, 0.3) * power);
  }
}

function dust(fx: Fx, p: [number, number, number], k: number) {
  for (let i = 0; i < 16; i++) {
    const a = rnd() * 6.28,
      s = rr(4, 22) * k;
    fx.puffs.emit(
      p[0],
      p[1] + 1,
      p[2],
      Math.cos(a) * s,
      rr(4, 14) * k,
      Math.sin(a) * s,
      rr(1.2, 2.4),
      3 * k,
      14 * k,
      0.55,
      0.38,
      0.26,
      0.5,
      1.5,
      -1,
    );
  }
  for (let i = 0; i < 6; i++) spawnDebris(fx, p, [0.4, 0.26, 0.16], rr(8, 30), 0.5 + rnd() * 0.7);
}

/** Warhead-specific blast: tight flash (darts), big fireball (bombs), shrapnel ring (pods), dirt plume (shells on terrain). */
function blast(fx: Fx, p: [number, number, number], k: number, lk: WeaponLook, heavy: boolean) {
  const [x, y, z] = p;
  const [r, g, b] = lk.color;
  if (lk.blast === 'flash') {
    fx.glow.emit(x, y, z, 0, 0, 0, 0.1, 16 * k, 30 * k, 3, 2.8, 2.4, 1);
    fx.ringP.emit(
      x,
      y,
      z,
      0,
      0,
      0,
      0.25,
      1.5 * k,
      16 * k,
      r,
      g,
      b,
      0.9,
      0,
      0,
      r * 0.3,
      g * 0.3,
      b * 0.3,
    );
    sparks(fx, p, 28, false);
  } else if (lk.blast === 'fireball') {
    explosion(fx, p, k * 1.25, false, undefined, true);
    for (let i = 0; i < 6; i++)
      fx.glow.emit(
        x + rr(-1, 1) * k,
        y + rr(0, 1.2) * k,
        z + rr(-1, 1) * k,
        rr(-2, 2),
        rr(3, 9),
        rr(-2, 2),
        rr(0.5, 1),
        2.5 * k,
        5 * k,
        2.4,
        0.9,
        0.2,
        0.5,
        0,
        -2,
        0.8,
        0.15,
        0.03,
      );
  } else if (lk.blast === 'shrapnel') {
    explosion(fx, p, k * 0.8, false);
    fx.ringP.emit(
      x,
      y,
      z,
      0,
      0,
      0,
      0.5,
      2 * k,
      26 * k,
      r,
      g,
      b,
      0.9,
      0,
      0,
      r * 0.3,
      g * 0.3,
      b * 0.3,
    );
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2 + rnd() * 0.1,
        s = rr(40, 70) * Math.sqrt(k);
      fx.glow.emit(
        x,
        y,
        z,
        Math.cos(a) * s,
        rr(-6, 6),
        Math.sin(a) * s,
        rr(0.35, 0.6),
        1.3,
        0.3,
        r * 1.2,
        g * 1.2,
        b * 1.2,
        1,
        1.5,
        0,
      );
    }
  } else {
    explosion(fx, p, k, false, undefined, heavy);
    const hf = world.heightfield;
    if (hf && y - sampleHeight(hf, x, z) < 10) {
      dust(fx, p, k * 2);
      for (let i = 0; i < 14; i++)
        fx.puffs.emit(
          x + rr(-3, 3),
          y,
          z + rr(-3, 3),
          rr(-4, 4),
          rr(25, 55) * Math.sqrt(k),
          rr(-4, 4),
          rr(1.8, 3),
          5 * k,
          14 * k,
          0.5,
          0.36,
          0.25,
          0.55,
          1.5,
          -1.5,
        );
    }
  }
}

function explosion(
  fx: Fx,
  p: [number, number, number],
  k: number,
  big: boolean,
  nation?: NationId,
  heavy = false,
) {
  const [x, y, z] = p;
  shockwave(fx, p, k, heavy);
  fx.glow.emit(x, y, z, 0, 0, 0, 0.14, 10 * k, 22 * k, 3, 2.3, 1.4, 1);
  const n = big ? 26 : 12;
  for (let i = 0; i < n; i++) {
    const dx = rnd() - 0.5,
      dy = rnd() - 0.4,
      dz = rnd() - 0.5;
    const l = (1 / Math.hypot(dx, dy, dz)) * rr(3, 15) * k;
    fx.glow.emit(
      x,
      y,
      z,
      dx * l,
      dy * l,
      dz * l,
      rr(0.35, big ? 1.1 : 0.7),
      3.2 * k,
      8 * k,
      2.4,
      rr(0.7, 1.2),
      0.2,
      0.9,
      2.2,
    );
  }
  for (let i = 0; i < n / 2; i++) {
    const dx = rnd() - 0.5,
      dy = rnd() - 0.5,
      dz = rnd() - 0.5;
    const l = (1 / Math.hypot(dx, dy, dz)) * rr(1, 6) * k;
    fx.glow.emit(x, y, z, dx * l, dy * l, dz * l, rr(0.2, 0.5), 2.2 * k, 5 * k, 3, 2.6, 1.6, 1, 2);
  }
  for (let i = 0; i < (big ? 18 : 8); i++) {
    const dx = rnd() - 0.5,
      dy = rnd() - 0.2,
      dz = rnd() - 0.5;
    const l = (1 / Math.hypot(dx, dy, dz)) * rr(2, 9) * k;
    fx.puffs.emit(
      x,
      y,
      z,
      dx * l,
      dy * l,
      dz * l,
      rr(1.4, big ? 3.2 : 2),
      4 * k,
      15 * k,
      0.16,
      0.14,
      0.13,
      0.6,
      1.2,
      -1.5,
    );
  }
  sparks(fx, p, big ? 36 : 14, false);
  if (big) {
    const pal = PALETTES[nation ?? 'concord'];
    const cols = [pal.primary, pal.secondary, pal.dark, pal.accent];
    for (let i = 0; i < 26; i++) {
      fx.c.set(cols[i % cols.length]!);
      spawnDebris(
        fx,
        p,
        [fx.c.r, fx.c.g, fx.c.b],
        rr(10, 55) * Math.min(1.5, k),
        rr(0.5, 1.6) * Math.min(1.8, k),
      );
    }
  }
}

/** Billboard shock ring, flat ground ring near terrain, point-light flash, lingering smoke, and shake for heavy booms. */
function shockwave(fx: Fx, p: [number, number, number], k: number, heavy: boolean) {
  const [x, y, z] = p;
  fx.ringP.emit(
    x,
    y,
    z,
    0,
    0,
    0,
    heavy ? 0.7 : 0.45,
    2 * k,
    (heavy ? 44 : 28) * k,
    2.4,
    1.7,
    1.0,
    0.9,
    0,
    0,
    0.5,
    0.25,
    0.12,
  );
  const hf = world.heightfield;
  if (hf) {
    const gy = sampleHeight(hf, x, z);
    if (y - gy < 45 * k) {
      fx.ringFlatP.emit(
        x,
        gy + 0.8,
        z,
        0,
        0,
        0,
        heavy ? 0.9 : 0.6,
        3 * k,
        (heavy ? 60 : 36) * k,
        2.0,
        1.5,
        1.0,
        0.8,
        0,
        0,
        0.4,
        0.22,
        0.12,
      );
      for (let i = 0; i < (heavy ? 14 : 8); i++) {
        const a = rnd() * 6.28,
          sp = rr(8, 26) * k;
        fx.puffs.emit(
          x,
          gy + 1,
          z,
          Math.cos(a) * sp,
          rr(1, 4),
          Math.sin(a) * sp,
          rr(1.6, 2.8),
          3 * k,
          12 * k,
          0.6,
          0.45,
          0.32,
          0.45,
          1.2,
          -0.3,
        );
      }
    }
  }
  for (let i = 0; i < (heavy ? 14 : 6); i++) {
    const dx = rnd() - 0.5,
      dy = rnd() - 0.2,
      dz = rnd() - 0.5;
    const l = (1 / Math.hypot(dx, dy, dz)) * rr(1, 5) * k;
    fx.puffs.emit(
      x,
      y,
      z,
      dx * l,
      dy * l,
      dz * l,
      rr(2.5, heavy ? 5 : 4),
      5 * k,
      20 * k,
      0.5,
      0.45,
      0.42,
      0.4,
      0.9,
      -0.5,
      0.26,
      0.25,
      0.25,
    );
  }
  fx.boomLight.position.set(x, y, z);
  fx.boomLight.intensity = Math.max(fx.boomLight.intensity, 1400 * Math.min(k, 3));
  if (heavy) {
    const d = Math.hypot(x - fx.camPos.x, y - fx.camPos.y, z - fx.camPos.z);
    const w = world as unknown as { shake?: number };
    if (d < 400) w.shake = Math.max(w.shake ?? 0, 0.6 * (1 - d / 400));
  }
}

function spawnDebris(fx: Fx, p: [number, number, number], col: RGB, speed: number, size: number) {
  if (fx.dN >= MAX_DEBRIS) return;
  const i = fx.dN++,
    o = i * 3;
  const dx = rnd() - 0.5,
    dy = rnd() - 0.1,
    dz = rnd() - 0.5;
  const l = (1 / Math.hypot(dx, dy, dz)) * speed;
  fx.dp[o] = p[0];
  fx.dp[o + 1] = p[1];
  fx.dp[o + 2] = p[2];
  fx.dv[o] = dx * l;
  fx.dv[o + 1] = dy * l;
  fx.dv[o + 2] = dz * l;
  fx.dr[o] = rnd() * 6;
  fx.dr[o + 1] = rnd() * 6;
  fx.dr[o + 2] = rnd() * 6;
  fx.ds[o] = rr(-9, 9);
  fx.ds[o + 1] = rr(-9, 9);
  fx.ds[o + 2] = rr(-9, 9);
  fx.dl[o] = rr(2.5, 5);
  fx.dl[o + 1] = fx.dl[o]!;
  fx.dl[o + 2] = 0;
  fx.dsc[o] = size * rr(0.8, 1.6);
  fx.dsc[o + 1] = size * rr(0.5, 1);
  fx.dsc[o + 2] = size * rr(0.8, 1.6);
  const ca = fx.debris.instanceColor!;
  ca.setXYZ(i, col[0], col[1], col[2]);
}

function bubble(fx: Fx, victim: ShipId, col: RGB, power: number) {
  fx.sph.follow(victim, col, power, 0.45 * power + 0.1);
}

// ---- per-frame sims ---------------------------------------------------------------------
function updateProjectiles(fx: Fx, dt: number) {
  const P = fx.proj,
    f = P.f,
    hf = world.heightfield;
  const bodyN = [0, 0, 0, 0, 0];
  for (let i = 0; i < P.n;) {
    const o = i * PS,
      k = P.kind[i]!,
      style = P.style[i]!;
    f[o + 13]! += dt;
    const age = f[o + 13]!;
    let dead = false;
    const sm = k === 1 ? world.missiles.get(P.id[i]!) : undefined;
    if (k === 1 && age > 0.15 && !sm) {
      // missile homing: steer velocity direction toward the target, capped turn rate
      const tid = P.target[i];
      // Locked onto a Base structure: home on its body (a bit above the base point).
      const st = tid && !world.ships.has(tid) ? world.structures.get(tid) : undefined;
      const tgt = tid
        ? (world.ships.get(tid) ??
          (st ? { alive: st.alive, pos: [st.pos[0], st.pos[1] + 15, st.pos[2]] } : undefined))
        : undefined;
      if (tgt && tgt.alive) {
        const sp = Math.hypot(f[o + 3]!, f[o + 4]!, f[o + 5]!) || 1;
        const tx = tgt.pos[0] - f[o]!,
          ty = tgt.pos[1] - f[o + 1]!,
          tz = tgt.pos[2] - f[o + 2]!;
        const tl = Math.hypot(tx, ty, tz) || 1;
        const turn = Math.min(1, (f[o + 12]! || 2) * dt * 1.4);
        let nx = f[o + 3]! / sp + (tx / tl - f[o + 3]! / sp) * turn;
        let ny = f[o + 4]! / sp + (ty / tl - f[o + 4]! / sp) * turn;
        let nz = f[o + 5]! / sp + (tz / tl - f[o + 5]! / sp) * turn;
        const nl = Math.hypot(nx, ny, nz) || 1;
        nx /= nl;
        ny /= nl;
        nz /= nl;
        f[o + 3] = nx * sp;
        f[o + 4] = ny * sp;
        f[o + 5] = nz * sp;
      }
    }
    if (k === 3) {
      f[o + 4]! -= 9.8 * dt * 0.6;
      f[o + 9]! -= Math.hypot(f[o + 3]!, f[o + 4]!, f[o + 5]!) * dt;
    } else {
      f[o + 9]! -= Math.hypot(f[o + 3]!, f[o + 4]!, f[o + 5]!) * dt;
    }
    f[o]! += f[o + 3]! * dt;
    f[o + 1]! += f[o + 4]! * dt;
    f[o + 2]! += f[o + 5]! * dt;
    if (sm) {
      // authoritative guided path: render ~100 ms behind the latest snapshot, extrapolating with its velocity
      const si = i * 4;
      if (
        !P.hasSnap[i] ||
        P.snap[si] !== sm.pos[0] ||
        P.snap[si + 1] !== sm.pos[1] ||
        P.snap[si + 2] !== sm.pos[2]
      ) {
        P.snap[si] = sm.pos[0];
        P.snap[si + 1] = sm.pos[1];
        P.snap[si + 2] = sm.pos[2];
        P.snap[si + 3] = fx.time;
        P.hasSnap[i] = 1;
      }
      const dtS = fx.time - P.snap[si + 3]! - 0.1;
      const k2 = 1 - Math.exp(-14 * dt); // smooth blend from the local path into the snapshot path
      f[o] = f[o]! + (sm.pos[0] + sm.vel[0] * dtS - f[o]!) * k2;
      f[o + 1] = f[o + 1]! + (sm.pos[1] + sm.vel[1] * dtS - f[o + 1]!) * k2;
      f[o + 2] = f[o + 2]! + (sm.pos[2] + sm.vel[2] * dtS - f[o + 2]!) * k2;
      f[o + 3] = sm.vel[0];
      f[o + 4] = sm.vel[1];
      f[o + 5] = sm.vel[2];
    }
    if (f[o + 9]! <= 0) dead = true;
    else if (hf && f[o + 1]! < sampleHeight(hf, f[o]!, f[o + 2]!)) {
      dead = true;
      const pos: [number, number, number] = [f[o]!, f[o + 1]!, f[o + 2]!];
      if (k === 0) sparks(fx, pos, 4, false);
      else if (k === 1 && !P.target[i]) {
        // Dumb-fired missile into the ground: a miss. Dirt and a small bang, no fireball.
        dust(fx, pos, 1.4);
        explosion(fx, pos, Math.max(0.4, f[o + 11]! / 16), false);
      } else {
        blast(
          fx,
          pos,
          Math.max(0.6, f[o + 11]! / 8) * (style === 3 ? 2.6 : style === 2 ? 1.7 : 1),
          P.look[i]!,
          style >= 2,
        );
        dust(fx, pos, style === 3 ? 2 : 0.8);
      }
    }
    if (dead) {
      P.remove(i);
      continue;
    }

    let x = f[o]!,
      y = f[o + 1]!,
      z = f[o + 2]!;
    const vx = f[o + 3]!,
      vy = f[o + 4]!,
      vz = f[o + 5]!;
    const sp = Math.hypot(vx, vy, vz) || 1;
    const dx = vx / sp,
      dy = vy / sp,
      dz = vz / sp;
    const r = f[o + 6]!,
      g = f[o + 7]!,
      b = f[o + 8]!;
    if (k === 0) {
      const len = Math.min(26, Math.max(7, sp * 0.03));
      const s = len / sp;
      const fade = Math.min(1, f[o + 9]! / 150); // rounds that run out of range fade, they don't pop
      fx.streaks.push(x, y, z, 0.5, r * 0.8, g * 0.8, b * 0.8, 0.75 * fade, vx * s, vy * s, vz * s);
      fx.streaks.push(
        x,
        y,
        z,
        0.14,
        1.8,
        1.8,
        1.8,
        0.9 * fade,
        vx * s * 0.7,
        vy * s * 0.7,
        vz * s * 0.7,
      );
      i++;
      continue;
    }
    // missile / rocket / shell: perpendicular basis for spiral + wobble
    let ux = dz,
      uy = 0,
      uz = -dx;
    let ul = Math.hypot(ux, uz);
    if (ul < 0.05) {
      ux = 0;
      uy = dz;
      uz = -dy;
      ul = Math.hypot(uy, uz) || 1;
    }
    ux /= ul;
    uy /= ul;
    uz /= ul;
    const wx = dy * uz - dz * uy,
      wy = dz * ux - dx * uz,
      wz = dx * uy - dy * ux;
    const dropping = (k === 1 || k === 2) && age < 0.15;
    if (dropping) y -= age * 14;
    const big = style === 3 ? 2.4 : k === 2 ? 1.7 : k === 3 ? 1.35 : MISSILE_BODY_SCALE;
    const mine = k === 1 && !!P.target[i] && P.target[i] === world.ownId;
    const lk = P.look[i]!,
      tr = TRAIL[lk.trail],
      [lr, lg, lb] = lk.color;
    // Locked (homing) missiles snake toward their target; dumb-fired ones fly a dead-straight trail.
    const homing = k === 1 && !!P.target[i] && !P.evaded[i] && lk.trail !== 'ion';
    const wob = homing ? Math.sin(age * 34 + f[o + 14]!) : 0;
    const wob2 = homing ? Math.cos(age * 23 + f[o + 14]!) * 0.6 : 0;
    const wvx = ux * wob + wx * wob2,
      wvy = uy * wob + wy * wob2,
      wvz = uz * wob + wz * wob2;

    if (style === 3) {
      // heavy ground-strike bomb: falling whistle trail (long thin streak + shed ring puffs), no flame
      const sc = 14 / sp;
      fx.streaks.push(x, y, z, 0.22, 2.6, 2.6, 2.8, 0.7, vx * sc, vy * sc, vz * sc);
      fx.streaks.push(
        x,
        y,
        z,
        0.7,
        1.6,
        1.1,
        0.6,
        0.35,
        vx * sc * 2.5,
        vy * sc * 2.5,
        vz * sc * 2.5,
      );
      f[o + 10]! += dt;
      while (f[o + 10]! > 0.016) {
        f[o + 10]! -= 0.016;
        fx.puffs.emit(
          x - dx * (2 + f[o + 10]! * sp),
          y - dy * (2 + f[o + 10]! * sp),
          z - dz * (2 + f[o + 10]! * sp),
          rr(-2, 2),
          rr(-1, 1),
          rr(-2, 2),
          rr(1.2, 2),
          0.9,
          4,
          0.85,
          0.85,
          0.9,
          0.25,
          0.6,
          0,
          0.45,
          0.45,
          0.48,
        );
      }
    } else if (!dropping) {
      if (age - dt < 0.15 && (k === 1 || k === 2)) {
        // ignition: flash + smoke puff
        fx.glow.emit(x, y, z, 0, 0, 0, 0.18, 7 * big, 1, 3, 2.2, 1.2, 1);
        for (let n = 0; n < 8; n++)
          fx.puffs.emit(
            x,
            y,
            z,
            rr(-4, 4),
            rr(-3, 3),
            rr(-4, 4),
            rr(1.4, 2.2),
            1.5,
            6,
            0.95,
            0.9,
            0.85,
            0.6,
            1,
            -0.2,
            0.4,
            0.38,
            0.37,
          );
      }
      if (lk.trail === 'ion') {
        // ion ribbon: glowing orb with a double-helix energy trail in the weapon colour
        const fl = 0.85 + 0.3 * rnd();
        fx.additive.push(x, y, z, 1 * fl, lr * 0.5 + 0.1, lg * 0.5 + 0.1, lb * 0.5 + 0.1, 1);
        fx.additive.push(x, y, z, 3.5 * fl, lr * 0.6, lg * 0.6, lb * 0.6, 0.75);
        f[o + 10]! += dt;
        let n = 0;
        while (f[o + 10]! > 0.0035) {
          f[o + 10]! -= 0.0035;
          const back = f[o + 10]! * sp,
            ph = age * 26 - n++ * 0.4;
          const c1 = Math.cos(ph) * 0.55,
            s1 = Math.sin(ph) * 0.55;
          for (const sgn of [1, -1]) {
            fx.glow.emit(
              x - dx * back + (ux * c1 + wx * s1) * sgn,
              y - dy * back + (uy * c1 + wy * s1) * sgn,
              z - dz * back + (uz * c1 + wz * s1) * sgn,
              0,
              0,
              0,
              0.5,
              1.2,
              0.1,
              lr,
              lg,
              lb,
              0.45,
              0,
              0,
              lr * 0.2,
              lg * 0.2,
              lb * 0.2,
            );
          }
        }
      } else {
        // exhaust: flame core + sheath in the weapon colour, smoke shaped by the trail style
        const t = (mine ? 1.3 : 1) * big;
        const cr = lr * 0.5 + 0.1,
          cg = lg * 0.5 + 0.1,
          cb = lb * 0.5 + 0.1;
        if (tr.flame) {
          fx.additive.push(
            x - dx * 0.8,
            y - dy * 0.8,
            z - dz * 0.8,
            1.3 * t * tr.flame * (0.7 + 0.6 * rnd()),
            cr,
            cg,
            cb,
            1,
          );
          fx.additive.push(
            x - dx * 1.2,
            y - dy * 1.2,
            z - dz * 1.2,
            3.4 * t * tr.flame * (0.8 + 0.4 * rnd()),
            lr * 0.85,
            lg * 0.5,
            lb * 0.4,
            0.55,
          );
          const sc = (big * 6 * tr.streak) / sp;
          fx.streaks.push(
            x,
            y,
            z,
            0.5 * big,
            cr * 0.7,
            cg * 0.5,
            cb * 0.3,
            0.9,
            vx * sc,
            vy * sc,
            vz * sc,
          );
        }
        f[o + 10]! += dt;
        const step = mine ? tr.step * 0.7 : tr.step;
        let n = 0;
        while (f[o + 10]! > step) {
          f[o + 10]! -= step;
          const back = 0.9 + f[o + 10]! * sp;
          const ph = age * 22 - n++ * 0.55,
            rad = tr.rad * big;
          const c1 = Math.cos(ph) * rad,
            s1 = Math.sin(ph) * rad;
          const px = x - dx * back + ux * c1 + wx * s1 + wvx * 0.6,
            py = y - dy * back + uy * c1 + wy * s1 + wvy * 0.6,
            pz = z - dz * back + uz * c1 + wz * s1 + wvz * 0.6;
          const gy = tr.grey / 0.85;
          fx.puffs.emit(
            px,
            py,
            pz,
            rr(-1.2, 1.2) + wvx * 6,
            rr(-1.2, 1.2) + wvy * 6,
            rr(-1.2, 1.2) + wvz * 6,
            rr(1.8, 3.0) * tr.life,
            1.0 * big * tr.size,
            4.6 * big * tr.size * (mine ? 1.3 : 1),
            0.4 * gy + lr * 0.22,
            0.4 * gy + lg * 0.22,
            0.4 * gy + lb * 0.22,
            mine ? 0.5 : tr.alpha,
            0.4,
            -0.3,
            0.38 * gy,
            0.36 * gy,
            0.35 * gy,
          );
          if (tr.flame)
            fx.glow.emit(
              px,
              py,
              pz,
              0,
              0,
              0,
              0.25 + 0.35 * tr.life,
              1.3 * big * tr.flame,
              0.3,
              cr,
              cg * 0.8,
              cb * 0.6,
              0.75,
              0,
              0,
              lr * 0.5,
              lg * 0.5,
              lb * 0.5,
            );
          else fx.glow.emit(px, py, pz, 0, 0, 0, 0.5, 0.5, 0.2, lr * 0.5, lg * 0.5, lb * 0.5, 0.4);
        }
        if (tr.flame) {
          // bright sparkle embers shed from the trail
          f[o + 15]! += dt;
          while (f[o + 15]! > 0.03) {
            f[o + 15]! -= 0.03;
            fx.glow.emit(
              x - dx * 1.5,
              y - dy * 1.5,
              z - dz * 1.5,
              rr(-5, 5),
              rr(-3, 6),
              rr(-5, 5),
              rr(0.6, 1.3),
              0.4,
              0.1,
              cr,
              cg * 0.75,
              cb * 0.5,
              1,
              0.6,
              9,
            );
          }
        }
      }
    }
    if (k === 1 && !dropping) {
      // Readable at range: hot white-gold head flare, nation-tinted glow halo and a long exhaust streak.
      const cr = f[o + 6]!,
        cg = f[o + 7]!,
        cb = f[o + 8]!;
      const flick = 0.85 + 0.15 * Math.sin(fx.time * 40 + i * 1.7);
      fx.additive.push(x, y, z, 2.6 * flick, lr * 0.5 + 0.1, lg * 0.5 + 0.1, lb * 0.5 + 0.1, 1);
      fx.additive.push(x, y, z, 7 * flick, cr * 0.9, cg * 0.9, cb * 0.9, 0.55);
      const sc = (MISSILE_STREAK_M * (lk.trail === 'thin' ? 1.5 : 1)) / sp;
      fx.streaks.push(x, y, z, 0.55, lr * 0.6, lg * 0.6, lb * 0.6, 0.95, vx * sc, vy * sc, vz * sc);
      fx.streaks.push(x, y, z, 1.4, cr, cg, cb, 0.4, vx * sc * 1.6, vy * sc * 1.6, vz * sc * 1.6);
    }
    if (k === 1) {
      // blinking beacon so a target can spot incoming missiles
      const blink = Math.sin(fx.time * (mine ? 16 : 9) + i) > 0.2 ? 1 : 0.15;
      if (!dropping)
        fx.additive.push(x, y + 0.4, z, (mine ? 7 : 3.5) * blink, 3.5, 0.25, 0.2, 0.9 * blink);
      if (P.evaded[i]) {
        for (let n = 0; n < 3; n++)
          fx.glow.emit(
            x,
            y,
            z,
            rr(-10, 10),
            rr(-10, 10),
            rr(-10, 10),
            rr(0.5, 1.1),
            0.7,
            0.1,
            3,
            1.6,
            0.4,
            1,
            1,
            12,
          );
        fx.additive.push(x, y, z, 6, 3, 1.2, 0.3, 0.8);
      }
    }
    const wi = WARHEADS.indexOf(lk.warhead);
    if (bodyN[wi]! < 96) {
      const O = fx.o;
      O.position.set(x, y, z);
      fx.v.set(dx, dy, dz);
      O.quaternion.setFromUnitVectors(fx.fwd, fx.v);
      O.scale.set(big, big, big * (k === 3 ? 0.8 : 1));
      O.updateMatrix();
      fx.bodies[wi]!.setMatrixAt(bodyN[wi]!++, O.matrix);
    }
    i++;
  }
  fx.bodies.forEach((m, n) => {
    m.count = bodyN[n]!;
    m.instanceMatrix.needsUpdate = true;
  });
  fx.o.scale.set(1, 1, 1);
}

function updateDebris(fx: Fx, dt: number) {
  const hf = world.heightfield,
    O = fx.o;
  for (let i = 0; i < fx.dN;) {
    const o = i * 3;
    fx.dl[o]! -= dt;
    if (fx.dl[o]! <= 0 || (hf && fx.dp[o + 1]! < sampleHeight(hf, fx.dp[o]!, fx.dp[o + 2]!))) {
      const l = --fx.dN,
        lo = l * 3;
      if (l !== i) {
        for (let k = 0; k < 3; k++) {
          fx.dp[o + k] = fx.dp[lo + k]!;
          fx.dv[o + k] = fx.dv[lo + k]!;
          fx.dr[o + k] = fx.dr[lo + k]!;
          fx.ds[o + k] = fx.ds[lo + k]!;
          fx.dl[o + k] = fx.dl[lo + k]!;
          fx.dsc[o + k] = fx.dsc[lo + k]!;
        }
        const ca = fx.debris.instanceColor!;
        ca.setXYZ(i, ca.getX(l), ca.getY(l), ca.getZ(l));
      }
      continue;
    }
    fx.dv[o + 1]! -= 14 * dt;
    const d = Math.max(0, 1 - 0.25 * dt);
    for (let k = 0; k < 3; k++) {
      fx.dv[o + k]! *= d;
      fx.dp[o + k]! += fx.dv[o + k]! * dt;
      fx.dr[o + k]! += fx.ds[o + k]! * dt;
    }
    // burning debris leaves a trail while young
    const life = fx.dl[o]! / fx.dl[o + 1]!;
    if (life > 0.55) {
      fx.dl[o + 2]! += dt;
      if (fx.dl[o + 2]! > 0.05) {
        fx.dl[o + 2] = 0;
        fx.puffs.emit(
          fx.dp[o]!,
          fx.dp[o + 1]!,
          fx.dp[o + 2]!,
          0,
          1,
          0,
          1,
          0.8,
          3,
          0.2,
          0.18,
          0.17,
          0.5,
          0.5,
          -0.5,
        );
        fx.glow.emit(
          fx.dp[o]!,
          fx.dp[o + 1]!,
          fx.dp[o + 2]!,
          0,
          0,
          0,
          0.25,
          1.2,
          0.2,
          2.2,
          0.9,
          0.25,
          0.8,
        );
      }
    }
    const sc = Math.min(1, life * 4);
    O.position.set(fx.dp[o]!, fx.dp[o + 1]!, fx.dp[o + 2]!);
    O.rotation.set(fx.dr[o]!, fx.dr[o + 1]!, fx.dr[o + 2]!);
    O.scale.set(fx.dsc[o]! * sc, fx.dsc[o + 1]! * sc, fx.dsc[o + 2]! * sc);
    O.updateMatrix();
    fx.debris.setMatrixAt(i, O.matrix);
    i++;
  }
  O.rotation.set(0, 0, 0);
  fx.debris.count = fx.dN;
  fx.debris.instanceMatrix.needsUpdate = true;
  if (fx.debris.instanceColor) fx.debris.instanceColor.needsUpdate = true;
}

/** Engine trails, barrel-roll swooshes, damage smoke. */
/** Own guns: muzzles glow hotter as heat builds; overheated, they sputter smoke and sparks. */
function gunHeat(fx: Fx, s: ShipState, dt: number) {
  const fd = FRAMES[s.frame];
  const k = (s.heat - 0.5) * 2;
  const flick = s.overheated ? (Math.sin(fx.time * 45) > 0 ? 1 : 0.25) : 1;
  for (const side of [-1, 1]) {
    fx.v.set(side * fd.radius * 0.4, 0, -fd.halfLength).applyQuaternion(fx.q.set(...s.rot));
    const x = s.pos[0] + fx.v.x,
      y = s.pos[1] + fx.v.y,
      z = s.pos[2] + fx.v.z;
    fx.glow.emit(x, y, z, 0, 0, 0, 0.07, (0.5 + k * 1.1) * flick, 0.2, 3, 0.9 + (1 - k), 0.25, 0.9);
    if (s.overheated) {
      if (rnd() < dt * 14)
        fx.puffs.emit(
          x,
          y,
          z,
          rr(-1, 1),
          rr(1, 3),
          rr(-1, 1),
          rr(0.7, 1.2),
          0.8,
          3,
          0.5,
          0.48,
          0.46,
          0.35,
          0.5,
          -0.5,
        );
      if (rnd() < dt * 10)
        fx.glow.emit(
          x,
          y,
          z,
          rr(-8, 8),
          rr(-4, 8),
          rr(-8, 8),
          rr(0.2, 0.4),
          0.3,
          0.05,
          3,
          1.4,
          0.4,
          1,
          1,
          14,
        );
    }
  }
}

function updateShipFx(fx: Fx, dt: number, cam: THREE.Vector3) {
  const v = fx.v,
    q = fx.q;
  for (const s of world.ships.values()) {
    if (!s.alive) continue;
    const dx = s.pos[0] - cam.x,
      dy = s.pos[1] - cam.y,
      dz = s.pos[2] - cam.z;
    if (dx * dx + dy * dy + dz * dz > TRAIL_CULL_DIST * TRAIL_CULL_DIST) continue;
    const look = lookOf(s);
    const engines = getModel(s.frame, look.tier, look.upgrade).engines;
    let tr = fx.trails.get(s.id);
    if (!tr) {
      tr = engines.map(() => ({ x: 0, y: 0, z: 0, has: false }));
      fx.trails.set(s.id, tr);
    }
    q.set(s.rot[0], s.rot[1], s.rot[2], s.rot[3]);
    const bl = world.boostLevel.get(s.id) ?? 0; // continuous boost intensity
    const sp = dx * dx + dy * dy + dz * dz > 500 * 500 ? TRAIL_SPACING * 3 : TRAIL_SPACING;
    const [ar, ag, ab] = trailRgb(s.nation, look.upgrade, s.cosmetic);
    const ub = 1 + look.upgrade * 0.03; // higher upgrades leave fatter, longer, brighter trails
    for (let i = 0; i < engines.length; i++) {
      const e = engines[i]!;
      const t = tr[i];
      if (!t) continue;
      v.set(e.pos[0], e.pos[1], e.pos[2] + 0.4)
        .multiplyScalar(MODEL_SCALE)
        .applyQuaternion(q);
      const x = s.pos[0] + v.x,
        y = s.pos[1] + v.y,
        z = s.pos[2] + v.z;
      if (t.has) {
        const mx = x - t.x,
          my = y - t.y,
          mz = z - t.z;
        const d = Math.hypot(mx, my, mz);
        if (d < 80) {
          const n = Math.min(24, Math.floor(d / sp));
          for (let k = 1; k <= n; k++) {
            const u = k / (n + 1);
            const life = (0.4 + 0.12 * bl) * (1 + look.upgrade * 0.03);
            const sz = e.r * MODEL_SCALE * (2.4 + 0.5 * bl) * ub;
            if (bl > 0.6 && k % 6 === 0)
              fx.puffs.emit(
                t.x + mx * u,
                t.y + my * u,
                t.z + mz * u,
                rr(-1, 1),
                rr(0.5, 2),
                rr(-1, 1),
                0.5,
                sz * 1.2,
                sz * 3,
                1.0,
                0.85,
                0.65,
                0.05,
                0.6,
              );
            // Nation trail warms toward a hot afterburner tint as the boost level rises.
            fx.glow.emit(
              t.x + mx * u,
              t.y + my * u,
              t.z + mz * u,
              0,
              0,
              0,
              life,
              sz,
              sz * (0.3 - 0.05 * bl),
              ar * 1.3 + (1.8 - ar * 1.3) * bl,
              ag * 1.3 + (1.25 - ag * 1.3) * bl,
              ab * 1.3 + (0.65 - ab * 1.3) * bl,
              0.16 + look.upgrade * 0.02 - 0.02 * bl,
            );
            if (look.upgrade >= 8 && k % 4 === 0)
              // ember sparks shed off high-upgrade trails
              fx.glow.emit(
                t.x + mx * u,
                t.y + my * u,
                t.z + mz * u,
                rr(-4, 4),
                rr(-4, 4),
                rr(-4, 4),
                life * 0.8,
                sz * 0.35,
                0,
                ar * 2,
                ag * 2,
                ab * 2,
                0.5,
              );
          }
          if (n > 0) {
            t.x += (mx / d) * n * sp;
            t.y += (my / d) * n * sp;
            t.z += (mz / d) * n * sp;
          }
          continue;
        }
      }
      t.x = x;
      t.y = y;
      t.z = z;
      t.has = true;
    }
    if (s.id === world.ownId && s.heat > 0.5) gunHeat(fx, s, dt);
    for (const bf of s.buffs) {
      if (bf.skill === 'overdrive' && rnd() < dt * 50) {
        // heat haze + ember shed behind the engines
        const hl = FRAMES[s.frame].halfLength;
        v.set((rnd() - 0.5) * FRAMES[s.frame].radius, 0, hl * 1.1).applyQuaternion(q);
        fx.puffs.emit(
          s.pos[0] + v.x,
          s.pos[1] + v.y,
          s.pos[2] + v.z,
          rr(-1, 1),
          rr(1, 3),
          rr(-1, 1),
          1.0,
          2,
          7,
          1.0,
          0.7,
          0.45,
          0.06,
          0.6,
          -0.8,
        );
        if (rnd() < 0.4)
          fx.glow.emit(
            s.pos[0] + v.x,
            s.pos[1] + v.y,
            s.pos[2] + v.z,
            rr(-3, 3),
            rr(-1, 3),
            rr(-3, 3),
            0.6,
            0.5,
            0.1,
            3,
            0.9,
            0.2,
            1,
            1,
            5,
          );
      } else if (bf.skill === 'shield-weave' && rnd() < dt * 30) {
        // rising blue motes: the shield rebuilding
        v.set(
          (rnd() - 0.5) * FRAMES[s.frame].radius * 2,
          rnd() - 0.5,
          (rnd() - 0.5) * FRAMES[s.frame].halfLength,
        ).applyQuaternion(q);
        fx.glow.emit(
          s.pos[0] + v.x,
          s.pos[1] + v.y,
          s.pos[2] + v.z,
          0,
          4,
          0,
          0.6,
          0.8,
          0.1,
          0.4,
          2,
          3,
          0.8,
        );
      } else if (bf.skill === 'chaff-screen' && rnd() < dt * 20) {
        // silver decoy glints shed off the tail
        const hl = FRAMES[s.frame].halfLength;
        v.set((rnd() - 0.5) * FRAMES[s.frame].radius, -0.5, hl * 1.2).applyQuaternion(q);
        fx.glow.emit(
          s.pos[0] + v.x,
          s.pos[1] + v.y,
          s.pos[2] + v.z,
          rr(-4, 4),
          rr(-4, 1),
          rr(-4, 4),
          1.2,
          1.4,
          0.3,
          2.4,
          2.5,
          2.8,
          1,
          0.8,
          3,
        );
      }
    }
    if (
      (s as { grounded?: boolean }).grounded &&
      Math.hypot(s.vel[0], s.vel[2]) > 3 &&
      rnd() < dt * 50
    ) {
      const r = FRAMES[s.frame].radius;
      v.set((rnd() - 0.5) * r * 2, -1, r * 1.2).applyQuaternion(q);
      fx.puffs.emit(
        s.pos[0] + v.x,
        s.pos[1] + v.y,
        s.pos[2] + v.z,
        -s.vel[0] * 0.15 + rr(-2, 2),
        rr(1, 3),
        -s.vel[2] * 0.15 + rr(-2, 2),
        rr(0.8, 1.6),
        1.2,
        5,
        0.55,
        0.4,
        0.28,
        0.45,
        1,
        -0.6,
      );
    }
    if (s.hp < s.maxHp * 0.35 && rnd() < dt * 40) {
      v.set(0, 0, 1).applyQuaternion(q);
      fx.puffs.emit(
        s.pos[0] + v.x,
        s.pos[1] + v.y,
        s.pos[2] + v.z,
        rr(-1, 1),
        rr(1, 3),
        rr(-1, 1),
        1.8,
        1.4,
        6,
        0.08,
        0.075,
        0.07,
        0.7,
        0.5,
        -1,
      );
      if (rnd() < 0.3)
        fx.glow.emit(
          s.pos[0] + v.x,
          s.pos[1] + v.y,
          s.pos[2] + v.z,
          0,
          1,
          0,
          0.3,
          2,
          0.5,
          2.4,
          0.9,
          0.2,
          0.7,
        );
    }
  }
  // barrel-roll swoosh: light ribbons off both wingtips
  for (let i = 0; i < fx.rN;) {
    const r = fx.rolls[i]!;
    r.t -= dt;
    const s = world.ships.get(r.id);
    if (r.t <= 0 || !s) {
      const last = fx.rolls[--fx.rN]!;
      fx.rolls[fx.rN] = fx.rolls[i]!;
      fx.rolls[i] = last;
      continue;
    }
    q.set(s.rot[0], s.rot[1], s.rot[2], s.rot[3]);
    const w = FRAMES[s.frame].radius * 1.05;
    const ang = rollAngle(s),
      ca = Math.cos(ang),
      sa = Math.sin(ang);
    for (const side of [-1, 1]) {
      // wingtip follows the visual roll: rotate (side*w, 0) about the forward axis
      v.set(side * w * ca, side * w * sa, 0.3).applyQuaternion(q);
      const x = s.pos[0] + v.x,
        y = s.pos[1] + v.y,
        z = s.pos[2] + v.z;
      fx.glow.emit(x, y, z, 0, 0, 0, 0.6, 1.1, 0.15, 1.6, 1.9, 2.4, 0.8);
      fx.puffs.emit(
        x,
        y,
        z,
        rr(-0.5, 0.5),
        rr(-0.5, 0.5),
        rr(-0.5, 0.5),
        1.0,
        0.9,
        2.4,
        0.95,
        0.97,
        1.0,
        0.45,
        0.8,
        0,
        0.8,
        0.85,
        0.9,
      );
    }
    // whoosh streak trailing behind the roll
    fx.streaks.push(
      s.pos[0],
      s.pos[1],
      s.pos[2],
      w * 0.6,
      1.4,
      1.7,
      2.2,
      0.35,
      -s.vel[0] * 0.07,
      -s.vel[1] * 0.07,
      -s.vel[2] * 0.07,
    );
    i++;
  }
}
