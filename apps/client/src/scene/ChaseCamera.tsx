import { useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { FRAMES, sampleHeight } from '@skyriot/shared';
import { world } from '../state/world';
import { AIM_DISTANCE } from '../input/input';

const X_AXIS = new THREE.Vector3(1, 0, 0);

const BASE_FOV = 68;
const BOOST_FOV = 16;
const POS_OMEGA = 9; // critically-damped spring angular frequency (1/s): higher = stiffer
const ROT_RATE = 7;

/** Exact critically-damped spring step (frame-rate independent). */
function spring(x: number, v: number, target: number, w: number, dt: number, out: [number, number]) {
  const d = x - target;
  const e = Math.exp(-w * dt);
  const t = (v + w * d) * dt;
  out[0] = target + (d + t) * e;
  out[1] = (v - w * t) * e;
}

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
      tmp: new THREE.Vector3(),
      off: new THREE.Vector3(),
      qs: new THREE.Quaternion(),
      qo: new THREE.Quaternion(),
      eu: new THREE.Euler(0, 0, 0, 'YXZ'),
      qp: new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.1, 0, 0)),
      out: [0, 0] as [number, number],
    }),
    [],
  );

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const ship = world.ownId ? world.ships.get(world.ownId) : undefined;
    if (!ship) return;
    const def = FRAMES[ship.frame];

    st.qs.set(ship.rot[0], ship.rot[1], ship.rot[2], ship.rot[3]);
    if (!st.init) {
      st.q.copy(st.qs);
      st.init = true;
      camera.near = 0.3;
      camera.far = 7000;
      camera.updateProjectionMatrix();
      st.pos.set(ship.pos[0], ship.pos[1], ship.pos[2]);
    }
    // rotation lag: exponential slerp toward ship orientation
    st.q.slerp(st.qs, 1 - Math.exp(-ROT_RATE * dt));

    // zoom + free-look orbit (smoothed)
    st.zoom += (world.cameraZoom - st.zoom) * (1 - Math.exp(-8 * dt));
    const ty = world.freeLook ? -world.cursor.x * Math.PI * 0.95 : 0;
    const tp = world.freeLook ? Math.max(-0.2, Math.min(1.1, world.cursor.y * 0.9)) : 0;
    const k = 1 - Math.exp(-10 * dt);
    st.yaw += (ty - st.yaw) * k;
    st.pitch += (tp - st.pitch) * k;
    st.qo.setFromEuler(st.eu.set(st.pitch, st.yaw, 0));
    st.qs.copy(st.q).multiply(st.qo);

    const dist = (6 + def.radius * 2.6) * st.zoom;
    const height = dist * 0.26;
    st.off.set(0, height, dist).applyQuaternion(st.qs);
    // Pitch so the screen-centre ray meets the Ship's flight line at AIM_DISTANCE: centred cursor = fly straight.
    st.qp.setFromAxisAngle(X_AXIS, -Math.atan2(height, dist + AIM_DISTANCE));
    st.tmp.set(ship.pos[0], ship.pos[1], ship.pos[2]).add(st.off);

    for (let i = 0; i < 3; i++) {
      const key = (['x', 'y', 'z'] as const)[i]!;
      spring(st.pos[key], st.vel[key], st.tmp[key], POS_OMEGA, dt, st.out);
      st.pos[key] = st.out[0];
      st.vel[key] = st.out[1];
    }

    // never clip into terrain
    const hf = world.heightfield;
    if (hf) {
      const floor = sampleHeight(hf, st.pos.x, st.pos.z) + 4;
      if (st.pos.y < floor) {
        st.pos.y = floor;
        if (st.vel.y < 0) st.vel.y = 0;
      }
    }

    camera.position.copy(st.pos);
    camera.quaternion.copy(st.qs).multiply(st.qp);

    const boost = world.boosting.has(ship.id) ? BOOST_FOV : 0;
    st.fov += (BASE_FOV + boost - st.fov) * (1 - Math.exp(-5 * dt));
    if (Math.abs(camera.fov - st.fov) > 0.01) {
      camera.fov = st.fov;
      camera.updateProjectionMatrix();
    }
  });
  return null;
}
