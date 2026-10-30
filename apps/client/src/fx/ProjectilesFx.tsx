import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { FRAMES, WEAPONS, sampleHeight, type NationId, type ProjectileKind, type ShipId, type SimEvent } from '@skyriot/shared';
import { PALETTES } from '../frames/palette';
import { getModel } from '../frames/models';
import { world } from '../state/world';
import { ParticlePool, SpriteBatch } from './sprites';

// ---- tuning -------------------------------------------------------------------------------
const MAX_PROJ = 512;
const MAX_DEBRIS = 320;
const MAX_BUBBLES = 24;
const MAX_ROLLS = 16;
const TRAIL_SPACING = 0.6;
const TRAIL_CULL_DIST = 1400;

type RGB = [number, number, number];
const TRACER: Record<NationId, RGB> = { concord: [0.35, 1.5, 2.4], vex: [2.6, 0.35, 0.22] };
const ACCENT: Record<NationId, RGB> = { concord: [0.2, 1.1, 1.8], vex: [1.8, 0.6, 0.14] };

const KIND_ID: Record<ProjectileKind, number> = { tracer: 0, missile: 1, rocket: 2, shell: 3, flare: 4 };
const rnd = Math.random;
const rr = (a: number, b: number) => a + (b - a) * rnd();

interface Bubble { victim: ShipId; t: number; r: number; g: number; b: number }
interface Trail { x: number; y: number; z: number; has: boolean }

// ---- projectile pool (struct of arrays) -------------------------------------------------
class Projectiles {
  n = 0;
  id = new Int32Array(MAX_PROJ);
  kind = new Uint8Array(MAX_PROJ);
  /** pos(3) vel(3) col(3) misc: range-left / lifetime, emitAcc, splash, turnRate */
  f = new Float32Array(MAX_PROJ * 13);
  target: (ShipId | null)[] = new Array(MAX_PROJ).fill(null);

  add(e: Extract<SimEvent, { type: 'projectileSpawned' }>, col: RGB) {
    if (this.n >= MAX_PROJ) return;
    const i = this.n++, o = i * 13, f = this.f;
    const w = WEAPONS[e.weapon];
    this.id[i] = e.id;
    this.kind[i] = KIND_ID[e.kind];
    f[o] = e.origin[0]; f[o + 1] = e.origin[1]; f[o + 2] = e.origin[2];
    f[o + 3] = e.dir[0] * e.speed; f[o + 4] = e.dir[1] * e.speed; f[o + 5] = e.dir[2] * e.speed;
    f[o + 6] = col[0]; f[o + 7] = col[1]; f[o + 8] = col[2];
    f[o + 9] = e.kind === 'flare' ? 4.5 : (w?.rangeM ?? 1000);
    f[o + 10] = 0;
    f[o + 11] = w?.splashRadius ?? 0;
    f[o + 12] = w?.homingTurnRate ?? 0;
    this.target[i] = e.target;
  }
  find(id: number) {
    for (let i = 0; i < this.n; i++) if (this.id[i] === id) return i;
    return -1;
  }
  remove(i: number) {
    const l = --this.n;
    if (i !== l) {
      this.id[i] = this.id[l]!; this.kind[i] = this.kind[l]!; this.target[i] = this.target[l]!;
      for (let k = 0; k < 13; k++) this.f[i * 13 + k] = this.f[l * 13 + k]!;
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
    const objs = [fx.additive.mesh, fx.smoke.mesh, fx.streaks.mesh, fx.bodies, fx.debris, fx.bubbles];
    objs.forEach((o) => scene.add(o));
    return () => objs.forEach((o) => scene.remove(o));
  }, [scene, fx]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    fx.time += dt;
    handleEvents(fx, dt);
    updateProjectiles(fx, dt);
    updateDebris(fx, dt);
    updateBubbles(fx, dt);
    updateShipFx(fx, dt, camera.position);
    fx.glow.update(dt, fx.additive);
    fx.puffs.update(dt, fx.smoke);
    fx.additive.flush();
    fx.smoke.flush();
    fx.streaks.flush();
  });
  return null;
}

type Fx = ReturnType<typeof makeFx>;

function makeFx() {
    const additive = new SpriteBatch(26000, true); // glow, sparks, fire, trails
    const smoke = new SpriteBatch(3500, false);
    const streaks = new SpriteBatch(1100, true); // tracer streaks
    const glow = new ParticlePool(24000);
    const puffs = new ParticlePool(3000);

    // missile / rocket / shell bodies
    const body = new THREE.CylinderGeometry(0.1, 0.12, 1.1, 8).rotateX(Math.PI / 2);
    const nose = new THREE.ConeGeometry(0.1, 0.4, 8).rotateX(-Math.PI / 2).translate(0, 0, -0.75);
    const bodies = new THREE.InstancedMesh(
      mergeSimple(body, nose),
      new THREE.MeshStandardMaterial({ color: '#d8d4cc', roughness: 0.4, metalness: 0.5, emissive: '#331a08', emissiveIntensity: 1 }),
      160,
    );
    bodies.count = 0; bodies.frustumCulled = false; bodies.castShadow = false;

    // debris bricks
    const debris = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 0.6, 1),
      new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0.1, emissive: '#5a3a24', emissiveIntensity: 0.9 }),
      MAX_DEBRIS,
    );
    debris.count = 0; debris.frustumCulled = false; debris.castShadow = true;
    debris.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_DEBRIS * 3), 3);

    // shield bubbles
    const bubbleMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide,
      vertexShader: /* glsl */ `
        varying vec3 vC; varying float vF;
        void main(){
          vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
          vec4 mv = viewMatrix * wp;
          vec3 n = normalize(mat3(viewMatrix) * mat3(instanceMatrix) * normal);
          vF = pow(1.0 - abs(dot(n, normalize(-mv.xyz))), 2.2);
          vC = instanceColor;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        varying vec3 vC; varying float vF;
        void main(){ gl_FragColor = vec4(vC * (vF * 1.6 + 0.1), 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    const bubbles = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 20, 14), bubbleMat, MAX_BUBBLES);
    bubbles.count = 0; bubbles.frustumCulled = false; bubbles.renderOrder = 15;
    bubbles.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_BUBBLES * 3), 3);

    return {
      additive, smoke, streaks, glow, puffs, bodies, debris, bubbles,
      proj: new Projectiles(),
      // debris state
      dN: 0,
      dp: new Float32Array(MAX_DEBRIS * 3),
      dv: new Float32Array(MAX_DEBRIS * 3),
      dr: new Float32Array(MAX_DEBRIS * 3),
      ds: new Float32Array(MAX_DEBRIS * 3),
      dl: new Float32Array(MAX_DEBRIS * 3), // life, maxLife, smoke timer
      dsc: new Float32Array(MAX_DEBRIS * 3),
      bub: Array.from({ length: MAX_BUBBLES }, (): Bubble => ({ victim: '', t: 0, r: 0, g: 0, b: 0 })),
      bN: 0,
      rolls: Array.from({ length: MAX_ROLLS }, () => ({ id: '', t: 0, dir: 1 })),
      rN: 0,
      trails: new Map<ShipId, Trail[]>(),
      o: new THREE.Object3D(),
      q: new THREE.Quaternion(),
      v: new THREE.Vector3(),
      v2: new THREE.Vector3(),
      fwd: new THREE.Vector3(0, 0, -1),
      c: new THREE.Color(),
      time: 0,
      boomT: new Map<ShipId, number>(),
    };
}

function mergeSimple(a: THREE.BufferGeometry, b: THREE.BufferGeometry) {
  const A = a.toNonIndexed(), B = b.toNonIndexed();
  const g = new THREE.BufferGeometry();
  for (const k of ['position', 'normal']) {
    const x = A.getAttribute(k).array as Float32Array, y = B.getAttribute(k).array as Float32Array;
    const m = new Float32Array(x.length + y.length);
    m.set(x); m.set(y, x.length);
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
    switch (e.type) {
      case 'projectileSpawned': {
        const nation = world.ships.get(e.owner)?.nation ?? 'concord';
        fx.proj.add(e, TRACER[nation]);
        // muzzle flash
        const [c0, c1, c2] = TRACER[nation];
        fx.glow.emit(e.origin[0], e.origin[1], e.origin[2], 0, 0, 0, 0.07, e.kind === 'tracer' ? 1.4 : 3, 0.4, c0 * 1.5, c1 * 1.5, c2 * 1.5, 1);
        break;
      }
      case 'projectileExpired': {
        const i = fx.proj.find(e.id);
        if (i >= 0) {
          const k = fx.proj.kind[i]!;
          const splash = fx.proj.f[i * 13 + 11]!;
          fx.proj.remove(i);
          if (k === 1 || k === 2 || k === 3) explosion(fx, e.pos, Math.max(0.5, splash / 8), false);
        }
        break;
      }
      case 'hit': {
        const i = fx.proj.find(e.projectile);
        let splash = 0, k = 0;
        if (i >= 0) { splash = fx.proj.f[i * 13 + 11]!; k = fx.proj.kind[i]!; fx.proj.remove(i); }
        const victim = world.ships.get(e.victim);
        sparks(fx, e.pos, e.deflected ? 12 : 8, e.deflected);
        if (k === 1 || k === 2 || k === 3) explosion(fx, e.pos, Math.max(0.5, splash / 8), false);
        if (victim && (e.deflected || victim.shield > 0)) {
          const col = e.deflected ? ([1.6, 1.8, 2.4] as RGB) : ACCENT[victim.nation];
          bubble(fx, e.victim, col, e.deflected ? 0.6 : 1);
        }
        break;
      }
      case 'shipDestroyed': {
        const v = world.ships.get(e.victim);
        if (!boomOnce(fx, e.victim)) break;
        explosion(fx, e.pos, v ? 1.2 + FRAMES[v.frame].radius * 0.35 : 2, true, v?.nation);
        break;
      }
      case 'shipRespawned': {
        const n = world.ships.get(e.id)?.nation ?? 'concord';
        const [r, g, b] = ACCENT[n];
        for (let i = 0; i < 24; i++) {
          const a = (i / 24) * Math.PI * 2;
          fx.glow.emit(e.pos[0], e.pos[1], e.pos[2], Math.cos(a) * 30, rr(-3, 3), Math.sin(a) * 30, 0.6, 1.5, 0.3, r * 1.5, g * 1.5, b * 1.5, 1, 3);
        }
        fx.glow.emit(e.pos[0], e.pos[1], e.pos[2], 0, 0, 0, 0.35, 4, 18, r, g, b, 0.8);
        break;
      }
      case 'barrelRoll': {
        if (fx.rN < MAX_ROLLS) {
          const r = fx.rolls[fx.rN++]!;
          r.id = e.id; r.t = 0.55; r.dir = e.dir;
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
          explosion(fx, e.pos, s ? 1.2 + FRAMES[s.frame].radius * 0.35 : 2, true, s?.nation);
        }
        break;
      }
      case 'launched': {
        const s = world.ships.get(e.id);
        if (!s) break;
        const [r, g, b] = ACCENT[s.nation];
        for (let i = 0; i < 40; i++) {
          const a = rnd() * 6.28, sp = rr(4, 26);
          fx.glow.emit(s.pos[0], s.pos[1] - 1, s.pos[2], Math.cos(a) * sp, rr(-30, -8), Math.sin(a) * sp, rr(0.3, 0.8), 2.2, 0.4, r * 2, g * 2, b * 2, 0.9, 1.5);
        }
        for (let i = 0; i < 14; i++) fx.puffs.emit(s.pos[0], s.pos[1] - 2, s.pos[2], rr(-12, 12), rr(-4, 2), rr(-12, 12), rr(1, 2), 3, 10, 0.7, 0.62, 0.55, 0.4, 1.4);
        break;
      }
      case 'resupplied': {
        const s = world.ships.get(e.id);
        if (!s) break;
        for (let i = 0; i < 20; i++) {
          const a = rnd() * 6.28, rad = FRAMES[s.frame].radius * rr(0.6, 1.4);
          fx.glow.emit(s.pos[0] + Math.cos(a) * rad, s.pos[1] + rr(-1, 1), s.pos[2] + Math.sin(a) * rad, 0, rr(3, 7), 0, rr(0.6, 1.1), 0.5, 0.1, 0.5, 2.2, 0.9, 0.9, 0.5, -1);
        }
        break;
      }
      case 'skillUsed':
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
    const x = rnd() - 0.5, y = rnd() - 0.2, z = rnd() - 0.5;
    const l = 1 / Math.hypot(x, y, z);
    fx.glow.emit(p[0], p[1], p[2], x * l * s, y * l * s, z * l * s, rr(0.15, 0.45), 0.45, 0.08,
      blue ? 1.2 : 2.6, blue ? 1.8 : 1.5, blue ? 2.6 : 0.5, 1, 2, 18);
  }
  fx.glow.emit(p[0], p[1], p[2], 0, 0, 0, 0.1, 2.6, 0.5, 3, 2.6, 2, 1);
}

function dust(fx: Fx, p: [number, number, number], k: number) {
  for (let i = 0; i < 16; i++) {
    const a = rnd() * 6.28, s = rr(4, 22) * k;
    fx.puffs.emit(p[0], p[1] + 1, p[2], Math.cos(a) * s, rr(4, 14) * k, Math.sin(a) * s, rr(1.2, 2.4), 3 * k, 14 * k,
      0.55, 0.38, 0.26, 0.5, 1.5, -1);
  }
  for (let i = 0; i < 6; i++) spawnDebris(fx, p, [0.4, 0.26, 0.16], rr(8, 30), 0.5 + rnd() * 0.7);
}

function explosion(fx: Fx, p: [number, number, number], k: number, big: boolean, nation?: NationId) {
  const [x, y, z] = p;
  fx.glow.emit(x, y, z, 0, 0, 0, 0.14, 10 * k, 22 * k, 3, 2.3, 1.4, 1);
  const n = big ? 26 : 12;
  for (let i = 0; i < n; i++) {
    const dx = rnd() - 0.5, dy = rnd() - 0.4, dz = rnd() - 0.5;
    const l = (1 / Math.hypot(dx, dy, dz)) * rr(3, 15) * k;
    fx.glow.emit(x, y, z, dx * l, dy * l, dz * l, rr(0.35, big ? 1.1 : 0.7), 3.2 * k, 8 * k, 2.4, rr(0.7, 1.2), 0.2, 0.9, 2.2);
  }
  for (let i = 0; i < n / 2; i++) {
    const dx = rnd() - 0.5, dy = rnd() - 0.5, dz = rnd() - 0.5;
    const l = (1 / Math.hypot(dx, dy, dz)) * rr(1, 6) * k;
    fx.glow.emit(x, y, z, dx * l, dy * l, dz * l, rr(0.2, 0.5), 2.2 * k, 5 * k, 3, 2.6, 1.6, 1, 2);
  }
  for (let i = 0; i < (big ? 18 : 8); i++) {
    const dx = rnd() - 0.5, dy = rnd() - 0.2, dz = rnd() - 0.5;
    const l = (1 / Math.hypot(dx, dy, dz)) * rr(2, 9) * k;
    fx.puffs.emit(x, y, z, dx * l, dy * l, dz * l, rr(1.4, big ? 3.2 : 2), 4 * k, 15 * k, 0.16, 0.14, 0.13, 0.6, 1.2, -1.5);
  }
  sparks(fx, p, big ? 36 : 14, false);
  if (big) {
    const pal = PALETTES[nation ?? 'concord'];
    const cols = [pal.primary, pal.secondary, pal.dark, pal.accent];
    for (let i = 0; i < 26; i++) {
      fx.c.set(cols[i % cols.length]!);
      spawnDebris(fx, p, [fx.c.r, fx.c.g, fx.c.b], rr(10, 55) * Math.min(1.5, k), rr(0.5, 1.6) * Math.min(1.8, k));
    }
  }
}

function spawnDebris(fx: Fx, p: [number, number, number], col: RGB, speed: number, size: number) {
  if (fx.dN >= MAX_DEBRIS) return;
  const i = fx.dN++, o = i * 3;
  const dx = rnd() - 0.5, dy = rnd() - 0.1, dz = rnd() - 0.5;
  const l = (1 / Math.hypot(dx, dy, dz)) * speed;
  fx.dp[o] = p[0]; fx.dp[o + 1] = p[1]; fx.dp[o + 2] = p[2];
  fx.dv[o] = dx * l; fx.dv[o + 1] = dy * l; fx.dv[o + 2] = dz * l;
  fx.dr[o] = rnd() * 6; fx.dr[o + 1] = rnd() * 6; fx.dr[o + 2] = rnd() * 6;
  fx.ds[o] = rr(-9, 9); fx.ds[o + 1] = rr(-9, 9); fx.ds[o + 2] = rr(-9, 9);
  fx.dl[o] = rr(2.5, 5); fx.dl[o + 1] = fx.dl[o]!; fx.dl[o + 2] = 0;
  fx.dsc[o] = size * rr(0.8, 1.6); fx.dsc[o + 1] = size * rr(0.5, 1); fx.dsc[o + 2] = size * rr(0.8, 1.6);
  const ca = fx.debris.instanceColor!;
  ca.setXYZ(i, col[0], col[1], col[2]);
}

function bubble(fx: Fx, victim: ShipId, col: RGB, power: number) {
  // reuse a slot already on this victim, else append (drop oldest if full)
  let i = -1;
  for (let k = 0; k < fx.bN; k++) if (fx.bub[k]!.victim === victim) { i = k; break; }
  if (i < 0) i = fx.bN < MAX_BUBBLES ? fx.bN++ : 0;
  const b = fx.bub[i]!;
  b.victim = victim; b.t = 0.45 * power + 0.1; b.r = col[0] * power; b.g = col[1] * power; b.b = col[2] * power;
}

// ---- per-frame sims ---------------------------------------------------------------------
function updateProjectiles(fx: Fx, dt: number) {
  const P = fx.proj, f = P.f, hf = world.heightfield;
  let bodyN = 0;
  for (let i = 0; i < P.n; ) {
    const o = i * 13, k = P.kind[i]!;
    let dead = false;
    if (k === 1) {
      // missile homing: steer velocity direction toward the target, capped turn rate
      const tgt = P.target[i] ? world.ships.get(P.target[i]!) : undefined;
      if (tgt && tgt.alive) {
        const sp = Math.hypot(f[o + 3]!, f[o + 4]!, f[o + 5]!) || 1;
        const tx = tgt.pos[0] - f[o]!, ty = tgt.pos[1] - f[o + 1]!, tz = tgt.pos[2] - f[o + 2]!;
        const tl = Math.hypot(tx, ty, tz) || 1;
        const turn = Math.min(1, (f[o + 12]! || 2) * dt * 1.4);
        let nx = f[o + 3]! / sp + (tx / tl - f[o + 3]! / sp) * turn;
        let ny = f[o + 4]! / sp + (ty / tl - f[o + 4]! / sp) * turn;
        let nz = f[o + 5]! / sp + (tz / tl - f[o + 5]! / sp) * turn;
        const nl = Math.hypot(nx, ny, nz) || 1;
        nx /= nl; ny /= nl; nz /= nl;
        f[o + 3] = nx * sp; f[o + 4] = ny * sp; f[o + 5] = nz * sp;
      }
    }
    if (k === 4) {
      // flare: decelerate, fall
      const d = Math.max(0, 1 - 1.6 * dt);
      f[o + 3]! *= d; f[o + 5]! *= d; f[o + 4] = f[o + 4]! * d - 16 * dt;
      f[o + 9]! -= dt;
    } else if (k === 3) {
      f[o + 4]! -= 9.8 * dt * 0.6;
      f[o + 9]! -= Math.hypot(f[o + 3]!, f[o + 4]!, f[o + 5]!) * dt;
    } else {
      f[o + 9]! -= Math.hypot(f[o + 3]!, f[o + 4]!, f[o + 5]!) * dt;
    }
    f[o]! += f[o + 3]! * dt; f[o + 1]! += f[o + 4]! * dt; f[o + 2]! += f[o + 5]! * dt;
    if (f[o + 9]! <= 0) dead = true;
    else if (hf && f[o + 1]! < sampleHeight(hf, f[o]!, f[o + 2]!)) {
      dead = true;
      const pos: [number, number, number] = [f[o]!, f[o + 1]!, f[o + 2]!];
      if (k === 0) sparks(fx, pos, 4, false);
      else if (k !== 4) { explosion(fx, pos, Math.max(0.6, f[o + 11]! / 8), false); dust(fx, pos, 0.8); }
    }
    if (dead) { P.remove(i); continue; }

    const x = f[o]!, y = f[o + 1]!, z = f[o + 2]!;
    const vx = f[o + 3]!, vy = f[o + 4]!, vz = f[o + 5]!;
    const sp = Math.hypot(vx, vy, vz) || 1;
    const r = f[o + 6]!, g = f[o + 7]!, b = f[o + 8]!;
    if (k === 0) {
      const len = Math.min(26, Math.max(7, sp * 0.03));
      const s = len / sp;
      fx.streaks.push(x, y, z, 0.5, r * 0.8, g * 0.8, b * 0.8, 0.75, vx * s, vy * s, vz * s);
      fx.streaks.push(x, y, z, 0.14, 1.8, 1.8, 1.8, 0.9, vx * s * 0.7, vy * s * 0.7, vz * s * 0.7);
    } else if (k === 4) {
      const fl = 0.8 + 0.4 * Math.sin(f[o + 9]! * 40 + i);
      fx.additive.push(x, y, z, 2.2 * fl, 3, 2.2, 1.2, 1);
      fx.additive.push(x, y, z, 6 * fl, 1.4, 0.9, 0.4, 0.5);
      f[o + 10]! += dt;
      while (f[o + 10]! > 0.04) {
        f[o + 10]! -= 0.04;
        fx.puffs.emit(x, y, z, rr(-1, 1), rr(-1, 1), rr(-1, 1), 1.6, 0.8, 3.5, 0.9, 0.85, 0.8, 0.35, 0.8, -0.5);
      }
    } else {
      // missile / rocket / shell: body + hot tail + smoke
      const big = k === 2 ? 1.7 : k === 3 ? 1.35 : 1;
      const s = (big * 6) / sp;
      fx.streaks.push(x, y, z, 0.5 * big, 2.4, 1.3, 0.4, 0.9, vx * s, vy * s, vz * s);
      fx.additive.push(x - (vx / sp) * 0.8, y - (vy / sp) * 0.8, z - (vz / sp) * 0.8, 1.6 * big, 3, 1.8, 0.7, 1);
      f[o + 10]! += dt;
      const step = 0.012;
      while (f[o + 10]! > step) {
        f[o + 10]! -= step;
        const back = f[o + 10]! * sp;
        fx.puffs.emit(x - (vx / sp) * (0.9 + back), y - (vy / sp) * (0.9 + back), z - (vz / sp) * (0.9 + back),
          rr(-1.5, 1.5), rr(-1.5, 1.5), rr(-1.5, 1.5), rr(1.2, 2.2), 0.9 * big, 4.2 * big, 0.62, 0.6, 0.58, 0.4, 0.5, -0.3);
      }
      if (bodyN < 160) {
        const O = fx.o;
        O.position.set(x, y, z);
        fx.v.set(vx / sp, vy / sp, vz / sp);
        O.quaternion.setFromUnitVectors(fx.fwd, fx.v);
        O.scale.set(big, big, big * (k === 3 ? 0.8 : 1));
        O.updateMatrix();
        fx.bodies.setMatrixAt(bodyN++, O.matrix);
      }
    }
    i++;
  }
  fx.bodies.count = bodyN;
  fx.bodies.instanceMatrix.needsUpdate = true;
  fx.o.scale.set(1, 1, 1);
}

function updateDebris(fx: Fx, dt: number) {
  const hf = world.heightfield, O = fx.o;
  for (let i = 0; i < fx.dN; ) {
    const o = i * 3;
    fx.dl[o]! -= dt;
    if (fx.dl[o]! <= 0 || (hf && fx.dp[o + 1]! < sampleHeight(hf, fx.dp[o]!, fx.dp[o + 2]!))) {
      const l = --fx.dN, lo = l * 3;
      if (l !== i) {
        for (let k = 0; k < 3; k++) {
          fx.dp[o + k] = fx.dp[lo + k]!; fx.dv[o + k] = fx.dv[lo + k]!; fx.dr[o + k] = fx.dr[lo + k]!;
          fx.ds[o + k] = fx.ds[lo + k]!; fx.dl[o + k] = fx.dl[lo + k]!; fx.dsc[o + k] = fx.dsc[lo + k]!;
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
        fx.puffs.emit(fx.dp[o]!, fx.dp[o + 1]!, fx.dp[o + 2]!, 0, 1, 0, 1, 0.8, 3, 0.2, 0.18, 0.17, 0.5, 0.5, -0.5);
        fx.glow.emit(fx.dp[o]!, fx.dp[o + 1]!, fx.dp[o + 2]!, 0, 0, 0, 0.25, 1.2, 0.2, 2.2, 0.9, 0.25, 0.8);
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

function updateBubbles(fx: Fx, dt: number) {
  const O = fx.o, ca = fx.bubbles.instanceColor!;
  for (let i = 0; i < fx.bN; ) {
    const b = fx.bub[i]!;
    const s = world.ships.get(b.victim);
    b.t -= dt;
    if (b.t <= 0 || !s || !s.alive) {
      const last = fx.bub[--fx.bN]!;
      if (last !== b) { const tmp = fx.bub[i]!; fx.bub[i] = last; fx.bub[fx.bN] = tmp; }
      continue;
    }
    const rad = FRAMES[s.frame].radius * 1.55;
    O.position.set(s.pos[0], s.pos[1], s.pos[2]);
    O.quaternion.set(s.rot[0], s.rot[1], s.rot[2], s.rot[3]);
    O.scale.set(rad, rad * 0.7, rad * 1.5);
    O.updateMatrix();
    fx.bubbles.setMatrixAt(i, O.matrix);
    const k = Math.min(1, b.t / 0.3);
    ca.setXYZ(i, b.r * k, b.g * k, b.b * k);
    i++;
  }
  O.quaternion.identity(); O.scale.set(1, 1, 1);
  fx.bubbles.count = fx.bN;
  fx.bubbles.instanceMatrix.needsUpdate = true;
  ca.needsUpdate = true;
}

/** Engine trails, barrel-roll swooshes, damage smoke. */
function updateShipFx(fx: Fx, dt: number, cam: THREE.Vector3) {
  const v = fx.v, q = fx.q;
  for (const s of world.ships.values()) {
    if (!s.alive) continue;
    const dx = s.pos[0] - cam.x, dy = s.pos[1] - cam.y, dz = s.pos[2] - cam.z;
    if (dx * dx + dy * dy + dz * dz > TRAIL_CULL_DIST * TRAIL_CULL_DIST) continue;
    const engines = getModel(s.frame, s.tier, s.upgrade).engines;
    let tr = fx.trails.get(s.id);
    if (!tr) {
      tr = engines.map(() => ({ x: 0, y: 0, z: 0, has: false }));
      fx.trails.set(s.id, tr);
    }
    q.set(s.rot[0], s.rot[1], s.rot[2], s.rot[3]);
    const boost = world.boosting.has(s.id);
    const sp = dx * dx + dy * dy + dz * dz > 500 * 500 ? TRAIL_SPACING * 3 : TRAIL_SPACING;
    const [ar, ag, ab] = ACCENT[s.nation];
    for (let i = 0; i < engines.length; i++) {
      const e = engines[i]!;
      const t = tr[i];
      if (!t) continue;
      v.set(e.pos[0], e.pos[1], e.pos[2] + 0.4).applyQuaternion(q);
      const x = s.pos[0] + v.x, y = s.pos[1] + v.y, z = s.pos[2] + v.z;
      if (t.has) {
        const mx = x - t.x, my = y - t.y, mz = z - t.z;
        const d = Math.hypot(mx, my, mz);
        if (d < 80) {
          const n = Math.min(24, Math.floor(d / sp));
          for (let k = 1; k <= n; k++) {
            const u = k / (n + 1);
            const life = boost ? 0.65 : 0.4;
            const sz = e.r * (boost ? 3.4 : 2.4);
            if (boost) fx.glow.emit(t.x + mx * u, t.y + my * u, t.z + mz * u, 0, 0, 0, life, sz, sz * 0.25, 2.6, 1.7, 0.8, 0.14);
            else fx.glow.emit(t.x + mx * u, t.y + my * u, t.z + mz * u, 0, 0, 0, life, sz, sz * 0.3, ar * 1.3, ag * 1.3, ab * 1.3, 0.16);
          }
          if (n > 0) { t.x += (mx / d) * n * sp; t.y += (my / d) * n * sp; t.z += (mz / d) * n * sp; }
          continue;
        }
      }
      t.x = x; t.y = y; t.z = z; t.has = true;
    }
    if ((s as { grounded?: boolean }).grounded && Math.hypot(s.vel[0], s.vel[2]) > 3 && rnd() < dt * 50) {
      const r = FRAMES[s.frame].radius;
      v.set((rnd() - 0.5) * r * 2, -1, r * 1.2).applyQuaternion(q);
      fx.puffs.emit(s.pos[0] + v.x, s.pos[1] + v.y, s.pos[2] + v.z, -s.vel[0] * 0.15 + rr(-2, 2), rr(1, 3), -s.vel[2] * 0.15 + rr(-2, 2), rr(0.8, 1.6), 1.2, 5, 0.55, 0.4, 0.28, 0.45, 1, -0.6);
    }
    if (s.hp < s.maxHp * 0.35 && rnd() < dt * 40) {
      v.set(0, 0, 1).applyQuaternion(q);
      fx.puffs.emit(s.pos[0] + v.x, s.pos[1] + v.y, s.pos[2] + v.z, rr(-1, 1), rr(1, 3), rr(-1, 1), 1.8, 1.4, 6, 0.08, 0.075, 0.07, 0.7, 0.5, -1);
      if (rnd() < 0.3) fx.glow.emit(s.pos[0] + v.x, s.pos[1] + v.y, s.pos[2] + v.z, 0, 1, 0, 0.3, 2, 0.5, 2.4, 0.9, 0.2, 0.7);
    }
  }
  // barrel-roll swoosh: light ribbons off both wingtips
  for (let i = 0; i < fx.rN; ) {
    const r = fx.rolls[i]!;
    r.t -= dt;
    const s = world.ships.get(r.id);
    if (r.t <= 0 || !s) {
      const last = fx.rolls[--fx.rN]!;
      fx.rolls[fx.rN] = fx.rolls[i]!; fx.rolls[i] = last;
      continue;
    }
    q.set(s.rot[0], s.rot[1], s.rot[2], s.rot[3]);
    const w = FRAMES[s.frame].radius * 1.05;
    for (const side of [-1, 1]) {
      v.set(side * w, 0, 0.3).applyQuaternion(q);
      fx.glow.emit(s.pos[0] + v.x, s.pos[1] + v.y, s.pos[2] + v.z, 0, 0, 0, 0.55, 0.9, 0.1, 1.6, 1.8, 2.2, 0.8);
    }
    i++;
  }
}
