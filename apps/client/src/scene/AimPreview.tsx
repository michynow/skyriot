import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AIR_BARRAGE_COUNT,
  AIR_BARRAGE_SPREAD_RAD,
  BOMB_DROP_SPEED,
  BOMB_GRAVITY,
  FRAMES,
  GROUND_STRIKE_SPLASH_MUL,
  NOSE_OFFSET,
  TICK_DT,
  WEAPONS,
  sampleHeight,
  type ShipState,
} from '@skyriot/shared';
import { BufferAttribute, BufferGeometry, Group, Mesh, MeshBasicMaterial } from 'three';
import { world } from '../state/world';
import { isFlying } from '../hud/hudStore';

/** Air mode (and other dumb Secondaries): the sight floats this far down the aim at most, hidden past it. */
const AIR_MARK_MAX_M = 650;
/** Ground-strike sight fades out as the Ship closes on the impact point (m). */
const FADE_NEAR_M = 25;
const FADE_FAR_M = 60;
/** Minimum angular size (radius / camera distance) so the sight stays readable far away. */
const MIN_ANGULAR = 0.022;
const MAX_STEPS = 900;
const TEETH = 12;

/** Unit gun-sight ring in the XY plane: annulus [rIn, rOut] with teeth pointing in to `tip`. */
function sightGeometry(rIn: number, rOut: number, tip: number, halfTooth: number): BufferGeometry {
  const seg = 72;
  const pos: number[] = [];
  for (let i = 0; i < seg; i++) {
    const a0 = (i / seg) * Math.PI * 2,
      a1 = ((i + 1) / seg) * Math.PI * 2;
    const c0 = Math.cos(a0),
      s0 = Math.sin(a0),
      c1 = Math.cos(a1),
      s1 = Math.sin(a1);
    pos.push(c0 * rIn, s0 * rIn, 0, c0 * rOut, s0 * rOut, 0, c1 * rOut, s1 * rOut, 0);
    pos.push(c0 * rIn, s0 * rIn, 0, c1 * rOut, s1 * rOut, 0, c1 * rIn, s1 * rIn, 0);
  }
  for (let i = 0; i < TEETH; i++) {
    const a = (i / TEETH) * Math.PI * 2;
    // base sits a hair outside rIn so it overlaps the band without a seam
    const rb = rIn + 0.01;
    pos.push(
      Math.cos(a - halfTooth) * rb,
      Math.sin(a - halfTooth) * rb,
      0,
      Math.cos(a + halfTooth) * rb,
      Math.sin(a + halfTooth) * rb,
      0,
      Math.cos(a) * tip,
      Math.sin(a) * tip,
      0,
    );
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  return g;
}

/** Integrate one shot like the sim does (gravity, then move, per tick) until terrain or range. */
function trace(
  x: number,
  y: number,
  z: number,
  vx: number,
  vy: number,
  vz: number,
  gravity: number,
  range: number,
  hit: number[],
): boolean {
  const hf = world.heightfield;
  let travelled = 0;
  for (let n = 0; n < MAX_STEPS; n++) {
    vy -= gravity * TICK_DT;
    const step = Math.min(Math.hypot(vx, vy, vz) * TICK_DT, range - travelled);
    const sp = Math.hypot(vx, vy, vz) || 1;
    const nx = x + (vx / sp) * step,
      ny = y + (vy / sp) * step,
      nz = z + (vz / sp) * step;
    const ground = hf ? sampleHeight(hf, nx, nz) : -Infinity;
    if (ny <= ground) {
      hit[0] = nx;
      hit[1] = ground;
      hit[2] = nz;
      return true;
    }
    x = nx;
    y = ny;
    z = nz;
    travelled += step;
    if (travelled >= range - 1e-6) break;
  }
  hit[0] = x;
  hit[1] = y;
  hit[2] = z;
  return false;
}

/**
 * Where the Secondary will land: a white toothed gun-sight ring (dark outline for contrast), drawn on top
 * of everything. Ground-strike bombs: flat on the terrain at the ballistic impact. Air mode and other dumb
 * ordnance: facing the camera where the shot meets terrain or AIR_MARK_MAX_M down the aim, whichever is
 * nearer. Homing missiles get the lock reticle instead.
 */
export function AimPreview() {
  const { group, sight } = useMemo(() => {
    const white = new MeshBasicMaterial({
      color: '#ffffff',
      transparent: true,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    const dark = new MeshBasicMaterial({
      color: '#000000',
      transparent: true,
      opacity: 0.55,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    const fg = new Mesh(sightGeometry(0.9, 1, 0.74, 0.07), white);
    const bg = new Mesh(sightGeometry(0.86, 1.045, 0.68, 0.1), dark);
    fg.renderOrder = 1001;
    bg.renderOrder = 1000;
    fg.frustumCulled = bg.frustumCulled = false;
    const sight = new Group();
    sight.add(bg, fg);
    sight.visible = false;
    const group = new Group();
    group.add(sight);
    return { group, sight };
  }, []);
  const hit = useMemo(() => [0, 0, 0], []);
  useEffect(
    () => () => {
      for (const m of sight.children as Mesh[]) {
        m.geometry.dispose();
        (m.material as MeshBasicMaterial).dispose();
      }
    },
    [sight],
  );

  useFrame(({ camera }) => {
    sight.visible = false;
    const own: ShipState | undefined = world.ownId ? world.ships.get(world.ownId) : undefined;
    if (!own || !isFlying(own) || own.docked || own.halted) return;
    const fd = FRAMES[own.frame];
    const w = WEAPONS[fd.secondary];
    if (!w) return;
    const mode = own.toggles.bombing;
    let radius: number;
    let opacity = 1;
    let flat = false;
    if (mode === 'ground-strike-mode') {
      const landed = trace(
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
      if (!landed) return; // bomb runs out of range in the air: no impact to mark
      const d = Math.hypot(hit[0]! - own.pos[0], hit[1]! - own.pos[1], hit[2]! - own.pos[2]);
      opacity = Math.min(Math.max((d - FADE_NEAR_M) / (FADE_FAR_M - FADE_NEAR_M), 0), 1);
      radius = w.splashRadius * GROUND_STRIKE_SPLASH_MUL;
      flat = true;
    } else if (mode === 'air-barrage-mode' || w.homingTurnRate === 0) {
      const [qx, qy, qz, qw] = own.rot;
      const fx = -2 * (qx * qz + qw * qy),
        fy = -2 * (qy * qz - qw * qx),
        fz = -(1 - 2 * (qx * qx + qy * qy));
      const nose = fd.halfLength + NOSE_OFFSET;
      trace(
        own.pos[0] + fx * nose,
        own.pos[1] + fy * nose,
        own.pos[2] + fz * nose,
        fx * w.speed,
        fy * w.speed,
        fz * w.speed,
        0,
        Math.min(w.rangeM, AIR_MARK_MAX_M),
        hit,
      );
      const d = Math.hypot(hit[0]! - own.pos[0], hit[1]! - own.pos[1], hit[2]! - own.pos[2]);
      // the salvo fans out sideways: size the ring to cover it
      const fan =
        mode === 'air-barrage-mode'
          ? d * AIR_BARRAGE_SPREAD_RAD * ((AIR_BARRAGE_COUNT - 1) / 2)
          : 0;
      radius = w.splashRadius + fan;
    } else return;

    const camD = camera.position.distanceTo(sight.position.set(hit[0]!, hit[1]!, hit[2]!));
    sight.scale.setScalar(Math.max(radius, camD * MIN_ANGULAR));
    if (flat) {
      sight.position.y += 0.6;
      sight.rotation.set(-Math.PI / 2, 0, 0);
    } else sight.quaternion.copy(camera.quaternion);
    for (const m of sight.children as Mesh[]) {
      const mat = m.material as MeshBasicMaterial;
      mat.opacity = (mat.color.r > 0.5 ? 1 : 0.55) * opacity;
    }
    sight.visible = opacity > 0.01;
  });

  return <primitive object={group} />;
}
