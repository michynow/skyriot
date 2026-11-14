import * as THREE from 'three';
import {
  BREACH_RADIUS,
  FRAMES,
  HEAL_FIELD_RADIUS,
  SKILLS,
  type ShipId,
  type ShipState,
  type SimEvent,
} from '@skyriot/shared';
import { getModel, MODEL_SCALE } from '../frames/models';
import { lookOf } from '../frames/look';
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
  red: [3.2, 0.5, 0.3] as RGB,
  cyan: [0.4, 2.6, 3.0] as RGB,
};

const v = new THREE.Vector3();
const q = new THREE.Quaternion();

function ring(
  fx: Fx,
  p: number[],
  col: RGB,
  s1: number,
  life = 0.6,
  vel: number[] = [0, 0, 0],
  s0 = 1.5,
) {
  fx.ringP.emit(
    p[0]!,
    p[1]!,
    p[2]!,
    vel[0]!,
    vel[1]!,
    vel[2]!,
    life,
    s0,
    s1,
    col[0],
    col[1],
    col[2],
    0.9,
    0,
    0,
    col[0] * 0.3,
    col[1] * 0.3,
    col[2] * 0.3,
  );
}
function flatRing(fx: Fx, p: number[], col: RGB, s1: number, life = 0.8) {
  fx.ringFlatP.emit(
    p[0]!,
    p[1]!,
    p[2]!,
    0,
    0,
    0,
    life,
    2,
    s1,
    col[0],
    col[1],
    col[2],
    0.8,
    0,
    0,
    col[0] * 0.3,
    col[1] * 0.3,
    col[2] * 0.3,
  );
}
function burst(
  fx: Fx,
  p: number[],
  col: RGB,
  n: number,
  speed: number,
  life = 0.7,
  size = 1.1,
  grav = 0,
) {
  for (let i = 0; i < n; i++) {
    const x = rnd() - 0.5,
      y = rnd() - 0.5,
      z = rnd() - 0.5;
    const l = (1 / Math.hypot(x, y, z)) * rr(0.3, 1) * speed;
    fx.glow.emit(
      p[0]!,
      p[1]!,
      p[2]!,
      x * l,
      y * l,
      z * l,
      rr(life * 0.6, life),
      size,
      size * 0.15,
      col[0],
      col[1],
      col[2],
      1,
      2,
      grav,
    );
  }
}
function sparkle(fx: Fx, s: ShipState, col: RGB) {
  const r = FRAMES[s.frame].radius;
  for (let i = 0; i < 26; i++) {
    const a = rnd() * 6.28,
      rad = r * rr(0.5, 1.3);
    fx.glow.emit(
      s.pos[0] + Math.cos(a) * rad,
      s.pos[1] + rr(-r, r) * 0.5,
      s.pos[2] + Math.sin(a) * rad,
      0,
      rr(3, 9),
      0,
      rr(0.7, 1.3),
      0.7,
      0.1,
      col[0],
      col[1],
      col[2],
      1,
      0.6,
      -2,
    );
  }
}
function beam(fx: Fx, src: ShipId, dst: ShipId, col: RGB, life: number) {
  if (fx.bn >= fx.beams.length) return;
  const b = fx.beams[fx.bn++]!;
  b.src = src;
  b.dst = dst;
  b.t = b.T = life;
  b.r = col[0];
  b.g = col[1];
  b.b = col[2];
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
  const L = FRAMES[s.frame].halfLength;
  const P: number[] = [s.pos[0], s.pos[1], s.pos[2]];
  q.set(s.rot[0], s.rot[1], s.rot[2], s.rot[3]);
  const F = v.set(0, 0, -1).applyQuaternion(q).toArray();
  const Rt = v.set(1, 0, 0).applyQuaternion(q).toArray();
  const Up = v.set(0, 1, 0).applyQuaternion(q).toArray();
  /** Point `f` metres along the nose, `r` to the right, `u` up from the Ship. */
  const pt = (f: number, r = 0, u = 0): number[] => [
    P[0]! + F[0]! * f + Rt[0]! * r + Up[0]! * u,
    P[1]! + F[1]! * f + Rt[1]! * r + Up[1]! * u,
    P[2]! + F[2]! * f + Rt[2]! * r + Up[2]! * u,
  ];
  const nose = pt(L),
    tail = pt(-L);
  /** A light streak from `p` reaching `len` metres along the nose (negative = backwards). */
  const streak = (p: number[], len: number, col: RGB, w = R * 0.4, a = 0.8) =>
    fx.streaks.push(
      p[0]!,
      p[1]!,
      p[2]!,
      w,
      col[0],
      col[1],
      col[2],
      a,
      F[0]! * len,
      F[1]! * len,
      F[2]! * len,
    );
  /** Ring that closes in on `p` (focus / charge) instead of expanding. */
  const focus = (p: number[], col: RGB, from: number, life = 0.5) =>
    ring(fx, p, col, R * 0.4, life, [0, 0, 0], from);
  /** Glows spun around the hull's long axis: a corkscrew (dir = +1 / -1). */
  const swirl = (col: RGB, n: number, rad: number, speed: number, dir = 1, life = 0.8) => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 6.283;
      const c = Math.cos(a) * rad,
        sn = Math.sin(a) * rad;
      const p = pt(rr(-L, L), c, sn);
      const t = dir * speed;
      fx.glow.emit(
        p[0]!,
        p[1]!,
        p[2]!,
        (-Rt[0]! * sn + Up[0]! * c) * (t / rad) + s.vel[0],
        (-Rt[1]! * sn + Up[1]! * c) * (t / rad) + s.vel[1],
        (-Rt[2]! * sn + Up[2]! * c) * (t / rad) + s.vel[2],
        rr(life * 0.6, life),
        1.3,
        0.2,
        col[0],
        col[1],
        col[2],
        1,
        1,
      );
    }
  };
  const dust = (n: number, col: RGB) => {
    for (let i = 0; i < n; i++) {
      const a = rnd() * 6.28,
        sp = rr(6, 26);
      fx.puffs.emit(
        P[0]!,
        P[1]! - R,
        P[2]!,
        Math.cos(a) * sp,
        rr(1, 5),
        Math.sin(a) * sp,
        rr(1.4, 2.6),
        3,
        10,
        col[0],
        col[1],
        col[2],
        0.5,
        1.4,
        -0.3,
      );
    }
  };
  const targets = targetsOf(e);
  const nat = PALETTES[s.nation].accent;
  const ncol: RGB = nat === PALETTES.concord.accent ? [0.3, 1.5, 2.4] : [2.6, 0.9, 0.25];

  switch (e.skill) {
    // ---- attack (red / orange): at the weapons ----
    case 'gun-tune': // three barrel flashes off the nose
      for (const r of [-R * 0.5, 0, R * 0.5]) streak(pt(L, r), R * 5, C.red, R * 0.25);
      ring(fx, nose, C.red, R * 2.2, 0.4);
      break;
    case 'warhead-tune': // a warhead lights up under each wing
      for (const r of [-R, R]) {
        ring(fx, pt(0, r, -R * 0.3), C.heat, R * 1.8, 0.5);
        burst(fx, pt(0, r, -R * 0.3), C.heat, 14, 14, 0.5, 1.1);
      }
      break;
    case 'zenith-tune': // both at once, climbing gold
      ring(fx, nose, C.red, R * 2.5, 0.45);
      ring(fx, P, C.gold, R * 5, 0.6, [0, 14, 0]);
      ring(fx, P, C.gold, R * 3.5, 0.75, [0, 22, 0]);
      break;
    case 'overdrive': {
      for (const en of getModel(s.frame, lookOf(s).tier, lookOf(s).upgrade).engines) {
        v.set(en.pos[0], en.pos[1], en.pos[2] + 0.5)
          .multiplyScalar(MODEL_SCALE)
          .applyQuaternion(q);
        fx.glow.emit(
          P[0]! + v.x,
          P[1]! + v.y,
          P[2]! + v.z,
          0,
          0,
          0,
          0.35,
          6 * R * 0.4,
          1,
          ...C.heat,
          1,
        );
      }
      for (const r of [-R, 0, R]) streak(pt(L * 0.5, r), R * 7, C.overdrive, R * 0.3);
      ring(fx, P, C.overdrive, R * 7, 0.6);
      break;
    }
    case 'quiver-surge': // racks blow open: three staggered shock rings and a wide spray
      for (const [k, life] of [
        [3, 0.35],
        [6, 0.55],
        [10, 0.8],
      ] as const)
        ring(fx, nose, k === 6 ? C.yellow : C.heat, R * k, life);
      burst(fx, nose, C.heat, 60, 40, 0.7, 1.4);
      fx.sph.follow(e.id, C.heat, 1.4, 0.6);
      break;
    case 'overcharge-round': // charge gathers at the muzzle
      focus(nose, C.charge, R * 7, 0.6);
      focus(nose, C.white, R * 4, 0.45);
      fx.glow.emit(
        nose[0]!,
        nose[1]!,
        nose[2]!,
        s.vel[0],
        s.vel[1],
        s.vel[2],
        0.9,
        1,
        R * 2.2,
        ...C.charge,
        1,
      );
      break;
    case 'quake-round': // the big one: slow heavy charge plus a ground-shaking pulse
      focus(nose, C.ground, R * 12, 0.9);
      focus(nose, C.heat, R * 8, 0.7);
      focus(nose, C.white, R * 4, 0.5);
      fx.sph.wave(s.pos, [1.4, 0.8, 0.2], 0.7, R, R * 9);
      fx.glow.emit(
        nose[0]!,
        nose[1]!,
        nose[2]!,
        s.vel[0],
        s.vel[1],
        s.vel[2],
        1.2,
        1,
        R * 3.5,
        ...C.ground,
        1,
      );
      break;
    case 'core-breach':
      fx.sph.wave(s.pos, [2.4, 1.0, 0.3], 0.9, R, BREACH_RADIUS);
      ring(fx, P, C.heat, BREACH_RADIUS / 0.78, 0.9, [0, 0, 0], 4);
      flatRing(fx, P, C.white, BREACH_RADIUS / 0.78, 0.7);
      burst(fx, P, C.heat, 90, BREACH_RADIUS * 0.8, 1.0, 2.4);
      burst(fx, P, C.white, 30, BREACH_RADIUS * 0.4, 0.5, 2.0);
      break;

    // ---- weapon modes (orange): the bay opens differently per mode ----
    case 'air-barrage-mode': // fan of rocket trails forward
      for (const r of [-2, -1, 0, 1, 2]) streak(pt(L, r * R * 0.5), R * 9, C.air, R * 0.25);
      ring(fx, nose, C.air, R * 4, 0.5);
      break;
    case 'ground-strike-mode': // bay doors: a ring dropping away below the hull
      ring(fx, pt(0, 0, -R), C.ground, R * 4, 0.7, [0, -30, 0]);
      ring(fx, pt(0, 0, -R), C.ground, R * 2.5, 0.9, [0, -45, 0]);
      burst(fx, pt(0, 0, -R), C.ground, 20, 16, 0.6, 1.0, -30);
      break;
    case 'wide-lock-mode': // a seeker cone sweeps out
      for (const r of [-1, 0, 1]) {
        const p = pt(R * 16, r * R * 7);
        ring(fx, p, C.red, R * 2.2, 0.7, [0, 0, 0], R * 4);
        fx.streaks.push(
          nose[0]!,
          nose[1]!,
          nose[2]!,
          R * 0.15,
          ...C.red,
          0.6,
          p[0]! - nose[0]!,
          p[1]! - nose[1]!,
          p[2]! - nose[2]!,
        );
      }
      break;
    case 'siege-anchor': // slam down
      flatRing(fx, P, C.ground, R * 8, 0.8);
      dust(18, [0.6, 0.45, 0.32]);
      fx.hex.follow(e.id, C.ground, 1.2, 0.5, 1.3);
      break;
    case 'air-siege': // hover lock: two rings stacked under the hull
      flatRing(fx, pt(0, 0, -R), C.air, R * 6, 0.7);
      flatRing(fx, pt(0, 0, -R * 2.5), C.air, R * 4, 0.9);
      fx.hex.follow(e.id, C.air, 1.2, 0.5, 1.3);
      break;

    // ---- defence (blue): around the hull ----
    case 'hardened-hull': // plates bolt on
      fx.hex.follow(e.id, C.silver, 1.6, 0.7, 1.25);
      burst(fx, P, C.silver, 18, R * 2, 0.4, 0.8);
      break;
    case 'shield-damper': // the shield tightens
      fx.sph.follow(e.id, C.cyan, 1.4, 0.7);
      focus(P, C.cyan, R * 7, 0.55);
      break;
    case 'blast-ward': // a big bubble snaps outward
      fx.sph.follow(e.id, C.blue, 2, 1.0, 2.1);
      ring(fx, P, C.blue, R * 9, 0.5);
      break;
    case 'siege-bastion': // dug in: walls rise
      fx.hex.follow(e.id, C.blue, 1.8, 0.9, 1.5);
      flatRing(fx, P, C.blue, R * 6, 0.9);
      dust(10, [0.5, 0.55, 0.65]);
      break;
    case 'sanctum': // golden halo drops over the Ship
      fx.hex.follow(e.id, C.gold, 2.2, 1.0, 1.6);
      ring(fx, pt(0, 0, R * 3), C.gold, R * 3, 0.9, [0, -R * 3, 0], R * 3);
      sparkle(fx, s, C.gold);
      break;
    case 'chaff-screen':
      for (let i = 0; i < 14; i++)
        fx.puffs.emit(
          P[0]!,
          P[1]!,
          P[2]!,
          rr(-12, 12),
          rr(-6, 6),
          rr(-12, 12),
          rr(1.4, 2.4),
          1.5,
          5,
          0.95,
          0.9,
          0.85,
          0.5,
          1.2,
          0,
          0.4,
          0.38,
          0.37,
        );
      burst(fx, tail, C.silver, 40, 34, 0.9, 1.3, -8);
      break;

    // ---- shield (cyan) and heal (green) ----
    case 'shield-weave': // threads spin up the hull
      swirl(C.cyan, 28, R * 1.2, 26, 1, 0.9);
      fx.sph.follow(e.id, C.cyan, 1.2, 0.9);
      break;
    case 'renewal-pulse':
    case 'recharge-pulse': {
      const col = e.skill === 'renewal-pulse' ? C.green : C.cyan;
      flatRing(fx, P, col, HEAL_FIELD_RADIUS / 0.78, 1.0);
      fx.sph.wave(s.pos, [col[0] * 0.5, col[1] * 0.5, col[2] * 0.5], 0.7, R, HEAL_FIELD_RADIUS);
      sparkle(fx, s, col);
      for (const t of targets) {
        const ts = world.ships.get(t);
        if (ts) sparkle(fx, ts, col);
      }
      break;
    }
    case 'mend-beam':
    case 'charge-beam':
    case 'fuel-line':
    case 'lifeline': {
      const col =
        e.skill === 'mend-beam'
          ? C.green
          : e.skill === 'charge-beam'
            ? C.cyan
            : e.skill === 'fuel-line'
              ? C.yellow
              : C.gold;
      const t = targets[0];
      const ts = t ? world.ships.get(t) : s;
      if (t) beam(fx, e.id, t, col, e.skill === 'lifeline' ? 1.4 : 0.8);
      if (ts) {
        sparkle(fx, ts, col);
        if (e.skill === 'lifeline') {
          fx.sph.follow(ts.id, col, 1.4, 0.9);
          ring(fx, ts.pos, C.green, FRAMES[ts.frame].radius * 6, 0.8);
          ring(fx, ts.pos, C.cyan, FRAMES[ts.frame].radius * 4, 1.0);
        }
      }
      break;
    }
    case 'repair-kit':
      sparkle(fx, s, C.green);
      break;
    case 'shield-kit':
      sparkle(fx, s, C.cyan);
      break;
    case 'sp-kit':
      sparkle(fx, s, C.violet);
      focus(P, C.violet, R * 4, 0.5);
      break;
    case 'fuel-cell':
      sparkle(fx, s, C.yellow);
      break;

    // ---- ally auras: one big ring in the aura's colour ----
    case 'rally-field':
    case 'ward-lattice':
    case 'veer-field': {
      const col = e.skill === 'rally-field' ? C.red : e.skill === 'ward-lattice' ? C.blue : C.gold;
      const rad = SKILLS[e.skill]?.auraRadiusM ?? 150;
      ring(fx, P, col, rad / 0.78, 0.9, [0, 0, 0], 4);
      flatRing(fx, P, col, rad / 0.78, 1.0);
      fx.sph.wave(s.pos, [col[0] * 0.5, col[1] * 0.5, col[2] * 0.5], 0.8, R, rad);
      for (const t of targets) beam(fx, e.id, t, col, 0.9);
      break;
    }

    // ---- movement (gold): along the flight line ----
    case 'afterburn-dash': // shock cone off the tail
      ring(fx, tail, C.yellow, R * 3, 0.3);
      ring(fx, tail, C.heat, R * 6, 0.5);
      streak(P, -R * 14, C.heat, R * 0.7);
      burst(fx, tail, C.heat, 30, 40, 0.5, 1.2);
      break;
    case 'pivot-flip': // a hoop the Ship swings through
      ring(fx, P, C.yellow, R * 5, 0.5, [0, 0, 0], R * 5);
      streak(nose, -L * 5, C.yellow, R * 0.3);
      break;
    case 'backdraft': // retro thrusters fire forward
      for (const r of [-R * 0.8, R * 0.8]) streak(pt(L, r), R * 10, C.yellow, R * 0.45);
      ring(fx, nose, C.yellow, R * 4, 0.4);
      burst(fx, nose, C.white, 24, 50, 0.4, 1.0);
      break;
    case 'reverse-drive':
      ring(fx, nose, C.gold, R * 3, 0.5);
      ring(fx, pt(L * 3), C.gold, R * 2, 0.7);
      break;
    case 'roll-cascade': // corkscrew
      swirl(C.yellow, 36, R * 1.6, 40, 1, 0.7);
      swirl(C.white, 18, R * 2.4, 40, -1, 0.7);
      break;
    case 'trim-tabs': // wingtip vortices
      for (const r of [-R * 1.6, R * 1.6]) streak(pt(0, r), -R * 9, C.yellow, R * 0.2);
      ring(fx, tail, C.yellow, R * 2.5, 0.4);
      break;
    case 'jink-jets': // side thrusters puff left and right
      for (const d of [-1, 1]) {
        const p = pt(0, d * R);
        fx.streaks.push(
          p[0]!,
          p[1]!,
          p[2]!,
          R * 0.35,
          ...C.yellow,
          0.8,
          Rt[0]! * d * R * 5,
          Rt[1]! * d * R * 5,
          Rt[2]! * d * R * 5,
        );
        burst(fx, p, C.yellow, 10, 18, 0.4, 0.9);
      }
      break;
    case 'track-drive':
      dust(22, [0.75, 0.6, 0.3]);
      streak(tail, -R * 6, C.yellow, R * 0.5);
      break;

    // ---- stealth and debuffs (violet): on the victim ----
    case 'shroud-veil':
    case 'ground-shroud':
      // inward-collapsing shimmer: the hull folds out of sight
      ring(fx, P, C.violet, R * 0.5, 0.5, [0, 0, 0], R * 6);
      burst(fx, P, C.phantom, 26, R * 3, 0.5, 0.8);
      fx.sph.follow(e.id, C.violet, 0.8, 0.6);
      if (e.skill === 'ground-shroud') flatRing(fx, P, C.violet, R * 5, 0.7);
      break;
    case 'blind-tag':
    case 'snare-tag':
    case 'shield-breaker':
    case 'dispel-lance':
      for (const t of targets) {
        const ts = world.ships.get(t);
        if (!ts) continue;
        const tr = FRAMES[ts.frame].radius;
        if (e.skill === 'blind-tag') {
          // dark bubble closes over the victim
          beam(fx, e.id, t, C.violet, 0.5);
          fx.sph.follow(t, C.violet, 1.6, 1.0, 1.3);
          ring(fx, ts.pos, C.violet, tr * 0.5, 0.6, [0, 0, 0], tr * 6);
        } else if (e.skill === 'snare-tag') {
          // net: flat rings tightening
          beam(fx, e.id, t, C.yellow, 0.7);
          for (const k of [6, 4.5, 3])
            ring(fx, ts.pos, C.yellow, tr, 0.4 + k * 0.08, [0, 0, 0], tr * k);
        } else if (e.skill === 'shield-breaker') {
          // the shield shatters outward
          beam(fx, e.id, t, C.red, 0.6);
          fx.hex.follow(t, C.red, 1.6, 0.5, 1.4);
          burst(fx, ts.pos, C.cyan, 34, 30, 0.6, 1.1, -10);
        } else {
          // lance: white bolt, the buffs burst off in colours
          beam(fx, e.id, t, C.white, 0.4);
          burst(fx, ts.pos, C.red, 12, 22, 0.6, 1.0);
          burst(fx, ts.pos, C.blue, 12, 22, 0.6, 1.0);
          burst(fx, ts.pos, C.gold, 12, 22, 0.6, 1.0);
          ring(fx, ts.pos, C.white, tr * 5, 0.5);
        }
      }
      break;

    // ---- utility (teal / white) ----
    case 'steady-hands': // sights close on the nose point
      focus(pt(L * 4), C.white, R * 5, 0.5);
      focus(pt(L * 4), C.cyan, R * 3, 0.65);
      break;
    case 'thrift-circuit':
      swirl(C.violet, 24, R * 1.3, 18, 1, 1.0);
      break;
    case 'scan-pulse': {
      const rad = FRAMES[s.frame].radarRangeM;
      fx.sph.wave(s.pos, [0.1, 0.5, 0.45], 0.9, R, rad);
      flatRing(fx, P, C.cyan, rad / 0.78, 1.0);
      for (const t of targets) {
        const ts = world.ships.get(t);
        if (ts) ring(fx, ts.pos, C.red, FRAMES[ts.frame].radius * 5, 0.9);
      }
      break;
    }
    case 'purge':
      fx.sph.wave(s.pos, C.white, 0.7, R * 0.8, 130);
      ring(fx, P, C.white, 170, 0.6);
      burst(fx, P, C.white, 40, 60, 0.6, 1.4);
      break;
    default:
      burst(fx, P, ncol, 16, R * 4, 0.5, 0.9);
  }
}

/** Draw and expire energy beams between ships (aura allies, debuff victims). */
export function updateBeams(fx: Fx, dt: number) {
  for (let i = 0; i < fx.bn;) {
    const b = fx.beams[i]!;
    b.t -= dt;
    const a = world.ships.get(b.src),
      t = world.ships.get(b.dst);
    if (b.t <= 0 || !a || !t) {
      const last = fx.beams[--fx.bn]!;
      if (last !== b) {
        fx.beams[i] = last;
        fx.beams[fx.bn] = b;
      }
      continue;
    }
    const k = Math.min(1, b.t / (b.T * 0.6));
    const flick = 0.8 + 0.4 * Math.sin(fx.time * 40 + i);
    fx.streaks.push(
      t.pos[0],
      t.pos[1],
      t.pos[2],
      0.9,
      b.r,
      b.g,
      b.b,
      0.8 * k * flick,
      a.pos[0] - t.pos[0],
      a.pos[1] - t.pos[1],
      a.pos[2] - t.pos[2],
    );
    fx.additive.push(t.pos[0], t.pos[1], t.pos[2], 3 * k, b.r, b.g, b.b, 0.8 * k);
    i++;
  }
}
