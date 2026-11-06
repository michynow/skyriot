import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AIR_BARRAGE_COUNT,
  AIR_BARRAGE_SPREAD_RAD,
  AIR_BARRAGE_RANGE_MUL,
  BOMB_DROP_SPEED,
  BOMB_FORWARD_KICK,
  BOMB_RANGE_MUL,
  BOMB_GRAVITY,
  FRAMES,
  GROUND_STRIKE_SPLASH_MUL,
  NOSE_OFFSET,
  TICK_DT,
  WEAPONS,
  sampleHeight,
  type ShipState,
} from '@skyriot/shared';
import {
  BufferAttribute,
  BufferGeometry,
  CircleGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
} from 'three';
import { world } from '../state/world';
import { isFlying } from '../hud/hudStore';

/** Air mode: the sight floats this fraction of the rockets' range down the aim (nearer if terrain is in the way). */
const AIR_MARK_RANGE_FRAC = 0.9;
/** Ground-strike sight fades out as the Ship closes on the impact point (m). */
const FADE_NEAR_M = 25;
const FADE_FAR_M = 60;
/** Minimum angular size (radius / camera distance) so the sight stays readable far away. */
const MIN_ANGULAR = 0.045;
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
 * Where the Secondary will land: a bright gold toothed gun-sight ring (dark outline for contrast) over a
 * faint blast-area fill, sized to the real blast radius and drawn on top
 * of everything. Ground-strike bombs: flat on the terrain at the ballistic impact of the forward throw. Air
 * mode: facing the camera where the rockets meet terrain or AIR_MARK_RANGE_FRAC of their range down the aim,
 * whichever is nearer.
 */
export function AimPreview() {
  const { group, sight } = useMemo(() => {
    // Warm, bright sight so it reads against sky and terrain; a faint fill shows the blast area.
    const white = new MeshBasicMaterial({
      color: '#ffd23a',
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
    const fillMat = new MeshBasicMaterial({
      color: '#ff8a1f',
      transparent: true,
      opacity: 0.18,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    const fg = new Mesh(sightGeometry(0.84, 1, 0.66, 0.08), white);
    const bg = new Mesh(sightGeometry(0.8, 1.06, 0.6, 0.11), dark);
    const fill = new Mesh(new CircleGeometry(0.84, 48), fillMat);
    fill.renderOrder = 999;
    fg.renderOrder = 1001;
    bg.renderOrder = 1000;
    fg.frustumCulled = bg.frustumCulled = fill.frustumCulled = false;
    const sight = new Group();
    sight.add(fill, bg, fg);
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

  useFrame(({ camera, clock }) => {
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
    const [qx, qy, qz, qw] = own.rot;
    const fx = -2 * (qx * qz + qw * qy),
      fy = -2 * (qy * qz - qw * qx),
      fz = -(1 - 2 * (qx * qx + qy * qy));
    if (mode === 'ground-strike-mode') {
      // Same throw as the sim's centre bomb: Ship velocity plus a level forward kick.
      const kick = BOMB_FORWARD_KICK / (Math.hypot(fx, fz) || 1);
      const landed = trace(
        own.pos[0],
        own.pos[1] - fd.radius - 1,
        own.pos[2],
        own.vel[0] + fx * kick,
        own.vel[1] - BOMB_DROP_SPEED,
        own.vel[2] + fz * kick,
        BOMB_GRAVITY,
        w.rangeM * BOMB_RANGE_MUL,
        hit,
      );
      if (!landed) return; // bomb runs out of range in the air: no impact to mark
      const d = Math.hypot(hit[0]! - own.pos[0], hit[1]! - own.pos[1], hit[2]! - own.pos[2]);
      opacity = Math.min(Math.max((d - FADE_NEAR_M) / (FADE_FAR_M - FADE_NEAR_M), 0), 1);
      radius = w.splashRadius * GROUND_STRIKE_SPLASH_MUL;
      flat = true;
    } else if (mode === 'air-barrage-mode') {
      const nose = fd.halfLength + NOSE_OFFSET;
      trace(
        own.pos[0] + fx * nose,
        own.pos[1] + fy * nose,
        own.pos[2] + fz * nose,
        fx * w.speed,
        fy * w.speed,
        fz * w.speed,
        0,
        w.rangeM * AIR_BARRAGE_RANGE_MUL * AIR_MARK_RANGE_FRAC,
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
    const [fill, bg, fg] = sight.children as Mesh[];
    const pulse = 0.85 + 0.15 * Math.sin(clock.elapsedTime * 6);
    (fg!.material as MeshBasicMaterial).opacity = pulse * opacity;
    (bg!.material as MeshBasicMaterial).opacity = 0.6 * opacity;
    (fill!.material as MeshBasicMaterial).opacity = 0.18 * pulse * opacity;
    sight.visible = opacity > 0.01;
  });

  return <primitive object={group} />;
}
