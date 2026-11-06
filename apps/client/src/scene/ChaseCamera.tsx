import { useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { FRAMES, sampleHeight } from '@skyriot/shared';
import { world } from '../state/world';
import { AIM_DISTANCE } from '../input/input';
import { fpv } from '../frames/fpv';
import { MODEL_SCALE } from '../frames/models';

const X_AXIS = new THREE.Vector3(1, 0, 0);

const BASE_FOV = 60;
/** At full boost level the view widens this much (deg) and the camera sits this much further back. */
const BOOST_FOV = 6;
const BOOST_PULLBACK = 0.12;
const POS_OMEGA = 9; // critically-damped spring angular frequency (1/s): higher = stiffer
/** Per-Frame feel: rot = orientation follow rate (higher = twitchier), bank = share of the Ship's roll the camera follows. */
const FEEL = {
  wasp: { rot: 9, bank: 0.25 },
  anvil: { rot: 6, bank: 0.3 },
  halo: { rot: 7.5, bank: 0.3 },
  bulwark: { rot: 6, bank: 0.3 },
} as const;
/** Look-ahead into turns: extra view yaw/pitch (rad) per rad/s of turn rate, capped, eased in. */
const LOOK_PER_RATE = 0.1;
const LOOK_MAX = 0.14;
const LOOK_RATE = 4;
/** Screen drift on hard turns: camera shifts against the turn by dist * this per rad/s, capped. */
const DRIFT_PER_RATE = 0.07;
const DRIFT_MAX = 0.2;
const DRIFT_RATE = 6;

/** Exact critically-damped spring step (frame-rate independent). */
function spring(
  x: number,
  v: number,
  target: number,
  w: number,
  dt: number,
  out: [number, number],
) {
  const d = x - target;
  const e = Math.exp(-w * dt);
  const t = (v + w * d) * dt;
  out[0] = target + (d + t) * e;
  out[1] = (v - w * t) * e;
}

/** Set by the FX layer on a `teleport` of the own Ship: next frame the camera hard-snaps (no spring travel). */
export const camSnap = { pending: false };

/** Third-person chase camera for the own Ship. Mount inside <Canvas>. Writes the default camera. */
export function ChaseCamera() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const st = useMemo(
    () => ({
      init: false,
      pos: new THREE.Vector3(),
      vel: new THREE.Vector3(),
      q: new THREE.Quaternion(),
      fov: BASE_FOV,
      yaw: 0,
      pitch: 0,
      zoom: 1,
      shake: 0,
      boost: 0,
      fp: 0,
      anc: new THREE.Vector3(),
      sp: new THREE.Vector3(),
      fwd: new THREE.Vector3(),
      ancInit: false,
      fpPos: new THREE.Vector3(),
      qf: new THREE.Quaternion(),
      qsh: new THREE.Quaternion(),
      t: 0,
      tmp: new THREE.Vector3(),
      off: new THREE.Vector3(),
      qs: new THREE.Quaternion(),
      qo: new THREE.Quaternion(),
      eu: new THREE.Euler(0, 0, 0, 'YXZ'),
      qp: new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.1, 0, 0)),
      bx: new THREE.Vector3(),
      by: new THREE.Vector3(),
      bz: new THREE.Vector3(),
      m: new THREE.Matrix4(),
      drift: new THREE.Vector3(),
      lookYaw: 0,
      lookPitch: 0,
      qla: new THREE.Quaternion(),
      eul: new THREE.Euler(0, 0, 0, 'YXZ'),
      out: [0, 0] as [number, number],
    }),
    [],
  );

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const ship = world.ownId ? world.ships.get(world.ownId) : undefined;
    if (!ship) return;
    const def = FRAMES[ship.frame];

    if (camSnap.pending) {
      camSnap.pending = false;
      st.init = false;
      st.ancInit = false;
      st.vel.set(0, 0, 0);
    }
    st.qs.set(ship.rot[0], ship.rot[1], ship.rot[2], ship.rot[3]);
    // Follow only part of the bank: up = blend of world up and Ship up (all Ship up when near vertical).
    st.bz.set(0, 0, 1).applyQuaternion(st.qs);
    st.by.set(0, 1, 0).applyQuaternion(st.qs);
    // Roll follow is capped at feel.bank except near vertical (dive/loop apex), where up must come from the Ship; wide smoothstep = no snap.
    const feel = FEEL[ship.frame];
    const vert = THREE.MathUtils.smoothstep(Math.abs(st.bz.y), 0.93, 0.995);
    const bankW = feel.bank + (1 - feel.bank) * vert;
    st.by.multiplyScalar(bankW).add(st.tmp.set(0, 1 - bankW, 0));
    st.bx.crossVectors(st.by, st.bz).normalize();
    st.by.crossVectors(st.bz, st.bx);
    st.qs.setFromRotationMatrix(st.m.makeBasis(st.bx, st.by, st.bz));
    if (!st.init) {
      st.q.copy(st.qs);
      st.init = true;
      camera.near = 0.3;
      camera.far = 7000;
      camera.updateProjectionMatrix();
      st.pos.set(ship.pos[0], ship.pos[1], ship.pos[2]);
    }
    // rotation lag: exponential slerp toward ship orientation
    st.q.slerp(st.qs, 1 - Math.exp(-feel.rot * dt));

    // zoom + free-look orbit (smoothed)
    st.zoom += (world.cameraZoom - st.zoom) * (1 - Math.exp(-8 * dt));
    const ty = world.lookBack ? Math.PI : world.freeLook ? -world.cursor.x * Math.PI * 0.95 : 0;
    const tp = world.lookBack
      ? 0.12
      : world.freeLook
        ? Math.max(-0.2, Math.min(1.1, world.cursor.y * 0.9))
        : 0;
    const k = 1 - Math.exp(-(world.lookBack ? 16 : 10) * dt);
    st.yaw += (ty - st.yaw) * k;
    st.pitch += (tp - st.pitch) * k;
    st.qo.setFromEuler(st.eu.set(st.pitch, st.yaw, 0));
    st.qs.copy(st.q).multiply(st.qo);

    // Sized by the hull so the whole Ship fits in frame, sitting below the centre crosshair.
    st.boost += ((world.boostLevel.get(ship.id) ?? 0) - st.boost) * (1 - Math.exp(-4 * dt));
    const dist =
      Math.max(def.halfLength, def.radius) * 4.6 * st.zoom * (1 + BOOST_PULLBACK * st.boost);
    // Camera sits higher: the Ship frames low so targets under the crosshair stay visible.
    const height = Math.max(dist * 0.3, def.radius * st.zoom);
    st.off.set(0, height, dist).applyQuaternion(st.qs);
    // Pitch so the screen-centre ray meets the Ship's flight line at AIM_DISTANCE: centred cursor = fly straight.
    st.qp.setFromAxisAngle(X_AXIS, -Math.atan2(height, dist + AIM_DISTANCE));
    st.tmp.set(ship.pos[0], ship.pos[1], ship.pos[2]).add(st.off);

    // Anchor springs toward the ship (soft lateral/vertical sway), but its error ALONG the ship's forward
    // axis is removed every frame, so acceleration/boost never stretches the camera distance.
    st.sp.set(ship.pos[0], ship.pos[1], ship.pos[2]);
    if (!st.ancInit) {
      st.anc.copy(st.sp);
      st.ancInit = true;
    }
    for (let i = 0; i < 3; i++) {
      const key = (['x', 'y', 'z'] as const)[i]!;
      spring(st.anc[key], st.vel[key], st.sp[key], POS_OMEGA, dt, st.out);
      st.anc[key] = st.out[0];
      st.vel[key] = st.out[1];
    }
    st.fwd
      .set(0, 0, -1)
      .applyQuaternion(st.qsh.set(ship.rot[0], ship.rot[1], ship.rot[2], ship.rot[3]));
    st.anc.addScaledVector(st.fwd, st.sp.sub(st.anc).dot(st.fwd));
    st.vel.addScaledVector(st.fwd, -st.vel.dot(st.fwd));
    st.pos.copy(st.anc).add(st.off);

    // Hard turns: the Ship drifts toward the turn on screen and springs back when the turn ends.
    st.tmp
      .set(ship.angVel[0], ship.angVel[1], ship.angVel[2])
      .applyQuaternion(st.qo.copy(st.qs).invert());
    const dmax = DRIFT_MAX * dist;
    st.lookYaw +=
      (THREE.MathUtils.clamp(st.tmp.y * LOOK_PER_RATE, -LOOK_MAX, LOOK_MAX) - st.lookYaw) *
      (1 - Math.exp(-LOOK_RATE * dt));
    st.lookPitch +=
      (THREE.MathUtils.clamp(st.tmp.x * LOOK_PER_RATE, -LOOK_MAX, LOOK_MAX) - st.lookPitch) *
      (1 - Math.exp(-LOOK_RATE * dt));
    const dx = THREE.MathUtils.clamp(st.tmp.y * DRIFT_PER_RATE * dist, -dmax, dmax);
    const dy = THREE.MathUtils.clamp(-st.tmp.x * DRIFT_PER_RATE * dist, -dmax, dmax);
    const kd = 1 - Math.exp(-DRIFT_RATE * dt);
    st.drift.x += (dx - st.drift.x) * kd;
    st.drift.y += (dy - st.drift.y) * kd;
    st.pos.add(st.tmp.set(st.drift.x, st.drift.y, 0).applyQuaternion(st.qs));

    // never clip into terrain
    const hf = world.heightfield;
    if (hf) {
      const floor = sampleHeight(hf, st.pos.x, st.pos.z) + 3;
      if (st.pos.y < floor) {
        st.pos.y = floor;
        if (st.vel.y < 0) st.vel.y = 0;
      }
    }

    camera.position.copy(st.pos);
    st.qla.setFromEuler(st.eul.set(st.lookPitch, st.lookYaw, 0));
    camera.quaternion.copy(st.qs).multiply(st.qla).multiply(st.qp);

    // first person from the turret while a Bulwark is sieged (eased over ~0.4 s)
    const fpTarget = ship.sieged && ship.frame === 'bulwark' ? 1 : 0;
    st.fp = Math.min(1, Math.max(0, st.fp + (fpTarget ? dt : -dt) / 0.4));
    const e = st.fp * st.fp * (3 - 2 * st.fp);
    fpv.id = e > 0 ? ship.id : '';
    fpv.amount = e;
    if (e > 0) {
      const FP_H = 2.5 * MODEL_SCALE,
        FP_Z = 0.6 * MODEL_SCALE;
      st.qsh.set(ship.rot[0], ship.rot[1], ship.rot[2], ship.rot[3]);
      st.fpPos
        .set(0, FP_H, FP_Z)
        .applyQuaternion(st.qsh)
        .add(st.tmp.set(ship.pos[0], ship.pos[1], ship.pos[2]));
      st.qf
        .copy(st.qsh)
        .multiply(st.qp.setFromAxisAngle(X_AXIS, -Math.atan2(FP_H, AIM_DISTANCE + FP_Z)));
      camera.position.lerp(st.fpPos, e);
      camera.quaternion.slerp(st.qf, e);
    }

    // screen shake: world.shake is an impulse (0..1) written by the game; consumed here and decayed
    const w = world as unknown as { shake?: number };
    if (w.shake) {
      st.shake = Math.max(st.shake, w.shake);
      w.shake = 0;
    }
    st.t += dt;
    if (st.shake > 0.002) {
      const a = st.shake * st.shake * 0.5;
      camera.position.x += Math.sin(st.t * 83) * a;
      camera.position.y += Math.sin(st.t * 97 + 1) * a;
      camera.rotateZ(Math.sin(st.t * 71) * st.shake * 0.02);
      st.shake *= Math.exp(-6 * dt);
    } else st.shake = 0;

    st.fov = BASE_FOV + BOOST_FOV * st.boost;
    if (Math.abs(camera.fov - st.fov) > 0.01) {
      camera.fov = st.fov;
      camera.updateProjectionMatrix();
    }
  });
  return null;
}
