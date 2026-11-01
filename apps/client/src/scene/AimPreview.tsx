import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AIR_BARRAGE_COUNT,
  AIR_BARRAGE_SPREAD_RAD,
  BOMB_DROP_SPEED,
  BOMB_GRAVITY,
  CARPET_BOMB_WEAPON,
  CARPET_BOMBS,
  CARPET_SPACING,
  FRAMES,
  GROUND_STRIKE_SPLASH_MUL,
  NOSE_OFFSET,
  WEAPONS,
  sampleHeight,
  type ShipState,
} from '@skyriot/shared';
import {
  BufferAttribute,
  BufferGeometry,
  Line,
  LineDashedMaterial,
  Mesh,
  MeshBasicMaterial,
  RingGeometry,
} from 'three';
import { world } from '../state/world';
import { isFlying } from '../hud/hudStore';

const PATH_POINTS = 48;
const PATHS = AIR_BARRAGE_COUNT;
const RINGS = Math.max(CARPET_BOMBS, AIR_BARRAGE_COUNT) + 1;
const STEP_SEC = 0.1;
const COLOR = '#ffb347';
const CARPET_COLOR = '#ff6a3d';

/** Integrate a projectile path (optional gravity) until terrain or range; writes points, returns count. */
function trace(
  out: Float32Array,
  x: number,
  y: number,
  z: number,
  vx: number,
  vy: number,
  vz: number,
  gravity: number,
  range: number,
  hit: number[],
): number {
  const hf = world.heightfield;
  let travelled = 0;
  let n = 0;
  for (; n < PATH_POINTS; n++) {
    out[n * 3] = x;
    out[n * 3 + 1] = y;
    out[n * 3 + 2] = z;
    const ground = hf ? sampleHeight(hf, x, z) : -Infinity;
    if (y <= ground || travelled >= range) {
      y = Math.max(y, ground);
      out[n * 3 + 1] = y;
      n++;
      break;
    }
    vy -= gravity * STEP_SEC;
    const dx = vx * STEP_SEC,
      dy = vy * STEP_SEC,
      dz = vz * STEP_SEC;
    travelled += Math.hypot(dx, dy, dz);
    x += dx;
    y += dy;
    z += dz;
  }
  hit[0] = x;
  hit[1] = y;
  hit[2] = z;
  return n;
}

/**
 * Where the Secondary (and Carpet Drop) will land: a dashed trajectory and a splash ring on impact. Shown for
 * dumb ordnance only — homing missiles get the lock reticle instead.
 */
export function AimPreview() {
  const { lines, rings } = useMemo(() => {
    const lines = Array.from({ length: PATHS }, () => {
      const g = new BufferGeometry();
      g.setAttribute('position', new BufferAttribute(new Float32Array(PATH_POINTS * 3), 3));
      const l = new Line(
        g,
        new LineDashedMaterial({
          color: COLOR,
          dashSize: 6,
          gapSize: 4,
          transparent: true,
          opacity: 0.85,
          depthWrite: false,
        }),
      );
      l.frustumCulled = false;
      return l;
    });
    const ringGeo = new RingGeometry(0.85, 1, 48).rotateX(-Math.PI / 2);
    const rings = Array.from({ length: RINGS }, () => {
      const m = new Mesh(
        ringGeo,
        new MeshBasicMaterial({
          color: COLOR,
          transparent: true,
          opacity: 0.75,
          depthWrite: false,
        }),
      );
      m.frustumCulled = false;
      return m;
    });
    return { lines, rings };
  }, []);
  const hit = useMemo(() => [0, 0, 0], []);
  useEffect(
    () => () => {
      for (const l of lines) {
        l.geometry.dispose();
        (l.material as LineDashedMaterial).dispose();
      }
      rings[0]?.geometry.dispose();
      for (const r of rings) (r.material as MeshBasicMaterial).dispose();
    },
    [lines, rings],
  );

  useFrame(() => {
    lines.forEach((l) => (l.visible = false));
    rings.forEach((r) => (r.visible = false));
    const own: ShipState | undefined = world.ownId ? world.ships.get(world.ownId) : undefined;
    if (!own || !isFlying(own) || own.docked || own.halted) return;
    const fd = FRAMES[own.frame];
    const w = WEAPONS[fd.secondary];
    if (!w) return;
    const [qx, qy, qz, qw] = own.rot;
    const fx = -2 * (qx * qz + qw * qy),
      fy = -2 * (qy * qz - qw * qx),
      fz = -(1 - 2 * (qx * qx + qy * qy));
    const rx = 1 - 2 * (qy * qy + qz * qz),
      ry = 2 * (qx * qy + qw * qz),
      rz = 2 * (qx * qz - qw * qy);
    const nose = fd.halfLength + NOSE_OFFSET;
    const ox = own.pos[0] + fx * nose,
      oy = own.pos[1] + fy * nose,
      oz = own.pos[2] + fz * nose;
    let used = 0;
    let ringsUsed = 0;
    const show = (n: number, splash: number, color: string) => {
      const l = lines[used++]!;
      (l.geometry.getAttribute('position') as BufferAttribute).needsUpdate = true;
      l.geometry.setDrawRange(0, n);
      l.computeLineDistances();
      (l.material as LineDashedMaterial).color.set(color);
      l.visible = n > 1;
      ring(splash, color);
    };
    const ring = (splash: number, color: string) => {
      const r = rings[ringsUsed++];
      if (!r) return;
      r.position.set(hit[0]!, hit[1]! + 0.6, hit[2]!);
      r.scale.setScalar(Math.max(splash, 4));
      (r.material as MeshBasicMaterial).color.set(color);
      r.visible = true;
    };
    const buf = (i: number) =>
      (lines[i]!.geometry.getAttribute('position') as BufferAttribute).array as Float32Array;

    const mode = own.toggles.bombing;
    if (mode === 'ground-strike-mode') {
      const n = trace(
        buf(0),
        own.pos[0],
        own.pos[1] - fd.radius - 1,
        own.pos[2],
        own.vel[0],
        own.vel[1] - BOMB_DROP_SPEED,
        own.vel[2],
        BOMB_GRAVITY,
        w.rangeM,
        hit,
      );
      show(n, w.splashRadius * GROUND_STRIKE_SPLASH_MUL, COLOR);
    } else if (mode === 'air-barrage-mode') {
      for (let k = 0; k < AIR_BARRAGE_COUNT; k++) {
        const off = (k - (AIR_BARRAGE_COUNT - 1) / 2) * AIR_BARRAGE_SPREAD_RAD;
        const dx = fx + rx * off,
          dy = fy + ry * off,
          dz = fz + rz * off;
        const dl = Math.hypot(dx, dy, dz);
        const n = trace(
          buf(k),
          ox,
          oy,
          oz,
          (dx / dl) * w.speed,
          (dy / dl) * w.speed,
          (dz / dl) * w.speed,
          0,
          w.rangeM,
          hit,
        );
        show(n, w.splashRadius, COLOR);
      }
    } else if (w.homingTurnRate === 0) {
      // Dumb Secondary (rocket, mortar shell): straight down the nose.
      const n = trace(
        buf(0),
        ox,
        oy,
        oz,
        fx * w.speed,
        fy * w.speed,
        fz * w.speed,
        0,
        w.rangeM,
        hit,
      );
      show(n, w.splashRadius, COLOR);
    }

    // Carpet Drop, when ready: a line of impact rings straight below.
    const slot = fd.hotbar.indexOf('carpet-drop');
    const bomb = WEAPONS[CARPET_BOMB_WEAPON];
    const hf = world.heightfield;
    if (slot >= 0 && !own.cooldowns[slot] && bomb && hf) {
      const hl = Math.hypot(fx, fz) || 1;
      for (let i = 0; i < CARPET_BOMBS && ringsUsed < RINGS; i++) {
        const off = (i - (CARPET_BOMBS - 1) / 2) * CARPET_SPACING;
        hit[0] = own.pos[0] + (fx / hl) * off;
        hit[2] = own.pos[2] + (fz / hl) * off;
        hit[1] = sampleHeight(hf, hit[0], hit[2]);
        if (own.pos[1] - hit[1] > bomb.rangeM) continue;
        ring(bomb.splashRadius, CARPET_COLOR);
      }
    }
  });

  return (
    <>
      {lines.map((l, i) => (
        <primitive key={`l${i}`} object={l} />
      ))}
      {rings.map((r, i) => (
        <primitive key={`r${i}`} object={r} />
      ))}
    </>
  );
}
