import * as THREE from 'three';
import { FRAMES, SKILLS, type ShipId, type ShipState, type SimEvent } from '@skyriot/shared';
import { getModel, MODEL_SCALE } from '../frames/models';
import { PALETTES } from '../frames/palette';
import { world } from '../state/world';
import type { Fx } from './ProjectilesFx';

type RGB = [number, number, number];
const rnd = Math.random;
const rr = (a: number, b: number) => a + (b - a) * rnd();

const C = {
  overdrive: [3, 0.55, 0.12] as RGB,
  phantom: [0.4, 2.2, 3.2] as RGB,
  gold: [3, 2.2, 0.4] as RGB,
  air: [0.4, 1.5, 3.2] as RGB,
  ground: [3.2, 1.8, 0.3] as RGB,
  rally: [0.4, 2.6, 0.8] as RGB,
  charge: [0.5, 1.1, 3.4] as RGB,
  white: [3, 3, 3] as RGB,
  violet: [1.7, 0.8, 3.2] as RGB,
  silver: [1.8, 1.95, 2.3] as RGB,
  heat: [3.2, 1.2, 0.25] as RGB,
  green: [0.5, 2.8, 0.9] as RGB,
  blue: [0.5, 1.4, 3.4] as RGB,
  yellow: [3.2, 2.6, 0.4] as RGB,
};

const v = new THREE.Vector3();
const q = new THREE.Quaternion();

function ring(fx: Fx, p: number[], col: RGB, s1: number, life = 0.6, vel: number[] = [0, 0, 0], s0 = 1.5) {
  fx.ringP.emit(p[0]!, p[1]!, p[2]!, vel[0]!, vel[1]!, vel[2]!, life, s0, s1, col[0], col[1], col[2], 0.9, 0, 0, col[0] * 0.3, col[1] * 0.3, col[2] * 0.3);
}
function flatRing(fx: Fx, p: number[], col: RGB, s1: number, life = 0.8) {
  fx.ringFlatP.emit(p[0]!, p[1]!, p[2]!, 0, 0, 0, life, 2, s1, col[0], col[1], col[2], 0.8, 0, 0, col[0] * 0.3, col[1] * 0.3, col[2] * 0.3);
}
function burst(fx: Fx, p: number[], col: RGB, n: number, speed: number, life = 0.7, size = 1.1, grav = 0) {
  for (let i = 0; i < n; i++) {
    const x = rnd() - 0.5, y = rnd() - 0.5, z = rnd() - 0.5;
    const l = (1 / Math.hypot(x, y, z)) * rr(0.3, 1) * speed;
    fx.glow.emit(p[0]!, p[1]!, p[2]!, x * l, y * l, z * l, rr(life * 0.6, life), size, size * 0.15, col[0], col[1], col[2], 1, 2, grav);
  }
}
function sparkle(fx: Fx, s: ShipState, col: RGB) {
  const r = FRAMES[s.frame].radius;
  for (let i = 0; i < 26; i++) {
    const a = rnd() * 6.28, rad = r * rr(0.5, 1.3);
    fx.glow.emit(s.pos[0] + Math.cos(a) * rad, s.pos[1] + rr(-r, r) * 0.5, s.pos[2] + Math.sin(a) * rad, 0, rr(3, 9), 0, rr(0.7, 1.3), 0.7, 0.1, col[0], col[1], col[2], 1, 0.6, -2);
  }
}
function beam(fx: Fx, src: ShipId, dst: ShipId, col: RGB, life: number) {
  if (fx.bn >= fx.beams.length) return;
  const b = fx.beams[fx.bn++]!;
  b.src = src; b.dst = dst; b.t = b.T = life; b.r = col[0]; b.g = col[1]; b.b = col[2];
}

/** Extra visual-only tracking: nearest allies when the event carries no `targets`. */
function targetsOf(e: SimEvent & { type: 'skillUsed' }): ShipId[] {
  return (e as unknown as { targets?: ShipId[] }).targets ?? [];
}

/** Distinct activation animation per Skill. Persistent buff looks live in FrameModel (driven by ShipState.buffs). */
export function skillActivation(fx: Fx, e: SimEvent & { type: 'skillUsed' }) {
  const s = world.ships.get(e.id);
  if (!s) return;
  const R = FRAMES[s.frame].radius;
  const P: number[] = [s.pos[0], s.pos[1], s.pos[2]];
  q.set(s.rot[0], s.rot[1], s.rot[2], s.rot[3]);
  const fwd = v.set(0, 0, -1).applyQuaternion(q);
  const fx0 = fwd.x, fy0 = fwd.y, fz0 = fwd.z;
  const nat = PALETTES[s.nation].accent;
  const ncol: RGB = nat === PALETTES.concord.accent ? [0.3, 1.5, 2.4] : [2.6, 0.9, 0.25];
  switch (e.skill) {
    case 'overdrive': {
      for (const en of getModel(s.frame, s.tier, s.upgrade).engines) {
        v.set(en.pos[0], en.pos[1], en.pos[2] + 0.5).multiplyScalar(MODEL_SCALE).applyQuaternion(q);
        fx.glow.emit(P[0]! + v.x, P[1]! + v.y, P[2]! + v.z, 0, 0, 0, 0.35, 6 * R * 0.4, 1, ...C.heat, 1);
        for (let i = 0; i < 8; i++) fx.glow.emit(P[0]! + v.x, P[1]! + v.y, P[2]! + v.z, rr(-6, 6) + s.vel[0] * 0.5, rr(-6, 6), rr(-6, 6) + s.vel[2] * 0.5, 0.6, 1.2, 0.2, ...C.overdrive, 1, 1);
      }
      ring(fx, P, C.overdrive, R * 7, 0.6);
      break;
    }
    case 'phantom-weave':
      burst(fx, P, C.phantom, 40, R * 8, 0.8, 1.0);
      ring(fx, P, C.phantom, R * 5, 0.7);
      break;
    case 'hunter-sight':
      // three gold scan rings sweeping forward
      for (let i = 0; i < 3; i++) fx.ringP.emit(P[0]! + fx0 * R * i, P[1]! + fy0 * R * i, P[2]! + fz0 * R * i, fx0 * 260 + s.vel[0], fy0 * 260 + s.vel[1], fz0 * 260 + s.vel[2], 0.9 - i * 0.1, R * 0.8, R * (5 + i * 2), ...C.gold, 0.9, 0, 0, 1.2, 0.8, 0.15);
      break;
    case 'air-barrage-mode':
    case 'ground-strike-mode': {
      const col = e.skill === 'air-barrage-mode' ? C.air : C.ground;
      burst(fx, P, col, 30, R * 6, 0.6, 1.0);
      ring(fx, P, col, R * 5, 0.5);
      fx.sph.follow(e.id, col, 1.2, 0.5);
      break;
    }
    case 'bulk-plating':
      burst(fx, P, C.silver, 40, R * 7, 0.5, 0.8, 18);
      ring(fx, P, C.silver, R * 3.5, 0.35);
      break;
    case 'rally-field':
    case 'overcharge': {
      const col = e.skill === 'rally-field' ? C.rally : C.charge;
      const rad = SKILLS[e.skill]?.auraRadiusM ?? 150;
      ring(fx, P, col, rad / 0.78, 0.9, [0, 0, 0], 4);
      flatRing(fx, P, col, rad / 0.78, 1.0);
      fx.sph.wave(s.pos, [col[0] * 0.5, col[1] * 0.5, col[2] * 0.5], 0.8, R, rad);
      for (const t of targetsOf(e)) beam(fx, e.id, t, col, 0.9);
      break;
    }
    case 'purge':
      fx.sph.wave(s.pos, C.white, 0.7, R * 0.8, 130);
      ring(fx, P, C.white, 170, 0.6);
      burst(fx, P, C.white, 40, 60, 0.6, 1.4);
      break;
    case 'fortify':
      fx.hex.follow(e.id, ncol, 2.2, 1.0, 1.5);
      burst(fx, P, ncol, 24, R * 4, 0.6, 0.9);
      break;
    case 'barrage-calibration': {
      v.set(0, 1.6 * MODEL_SCALE, -4.1 * MODEL_SCALE).applyQuaternion(q);
      fx.glow.emit(P[0]! + v.x, P[1]! + v.y, P[2]! + v.z, 0, 0, 0, 0.4, 8, 1, ...C.ground, 1);
      ring(fx, [P[0]! + v.x, P[1]! + v.y, P[2]! + v.z], C.ground, R * 3, 0.7);
      break;
    }
    case 'afterburn-dash':
      burst(fx, P, ncol, 30, 40, 0.5, 1.2);
      ring(fx, [P[0]! - fx0 * R, P[1]! - fy0 * R, P[2]! - fz0 * R], ncol, R * 4, 0.4);
      fx.streaks.push(P[0]!, P[1]!, P[2]!, R * 0.5, ncol[0], ncol[1], ncol[2], 0.7, -fx0 * 60, -fy0 * 60, -fz0 * 60);
      break;
    case 'flares':
      for (let i = 0; i < 14; i++) fx.puffs.emit(P[0]!, P[1]!, P[2]!, rr(-12, 12), rr(-6, 6), rr(-12, 12), rr(1.4, 2.4), 1.5, 5, 0.95, 0.9, 0.85, 0.5, 1.2, 0, 0.4, 0.38, 0.37);
      burst(fx, P, C.yellow, 16, 30, 0.5, 1.2);
      break;
    case 'ghost-skin':
      burst(fx, P, C.violet, 32, R * 6, 0.7, 1.0);
      ring(fx, P, C.violet, R * 4.5, 0.6);
      break;
    case 'iron-hide':
      fx.hex.follow(e.id, C.silver, 2.0, 0.9, 1.45);
      burst(fx, P, C.silver, 28, R * 5, 0.5, 0.8, 14);
      break;
    case 'mend-beam':
      for (const t of targetsOf(e)) beam(fx, e.id, t, C.green, 2.0);
      burst(fx, P, C.green, 14, R * 3, 0.6, 0.9);
      break;
    case 'aegis-bubble':
      fx.hex.follow(e.id, C.blue, 2.4, 1.6, 2.8);
      ring(fx, P, C.blue, R * 7, 0.7);
      break;
    case 'siege-anchor':
      flatRing(fx, P, C.ground, R * 8, 0.8);
      for (let i = 0; i < 18; i++) {
        const a = rnd() * 6.28, sp = rr(6, 26);
        fx.puffs.emit(P[0]!, P[1]! - R, P[2]!, Math.cos(a) * sp, rr(1, 5), Math.sin(a) * sp, rr(1.4, 2.6), 3, 10, 0.6, 0.45, 0.32, 0.5, 1.4, -0.3);
      }
      break;
    case 'scrap-wall':
      ring(fx, P, C.silver, R * 5, 0.5);
      burst(fx, P, C.silver, 22, R * 5, 0.5, 0.9, 12);
      break;
    case 'repair-kit': sparkle(fx, s, C.green); break;
    case 'shield-kit': sparkle(fx, s, C.blue); break;
    case 'fuel-cell': sparkle(fx, s, C.yellow); break;
    default:
      burst(fx, P, ncol, 16, R * 4, 0.5, 0.9);
  }
}

/** Draw and expire energy beams between ships (rally/overcharge allies, mend beam). */
export function updateBeams(fx: Fx, dt: number) {
  for (let i = 0; i < fx.bn; ) {
    const b = fx.beams[i]!;
    b.t -= dt;
    const a = world.ships.get(b.src), t = world.ships.get(b.dst);
    if (b.t <= 0 || !a || !t) {
      const last = fx.beams[--fx.bn]!;
      if (last !== b) { fx.beams[i] = last; fx.beams[fx.bn] = b; }
      continue;
    }
    const k = Math.min(1, b.t / (b.T * 0.6));
    const flick = 0.8 + 0.4 * Math.sin(fx.time * 40 + i);
    fx.streaks.push(t.pos[0], t.pos[1], t.pos[2], 0.9, b.r, b.g, b.b, 0.8 * k * flick, a.pos[0] - t.pos[0], a.pos[1] - t.pos[1], a.pos[2] - t.pos[2]);
    fx.additive.push(t.pos[0], t.pos[1], t.pos[2], 3 * k, b.r, b.g, b.b, 0.8 * k);
    i++;
  }
}
