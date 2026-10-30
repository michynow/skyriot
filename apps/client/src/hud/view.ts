import { Vector3, type Camera } from 'three';

/** Camera handle for HUD projection; written by the game loop each frame. */
export const view: { camera: Camera | null } = { camera: null };

const _v = new Vector3();

/** Project a world point to CSS pixels. Returns false if behind the camera. */
export function project(x: number, y: number, z: number, out: { x: number; y: number }): boolean {
  const cam = view.camera;
  if (!cam) return false;
  _v.set(x, y, z).project(cam);
  out.x = (_v.x * 0.5 + 0.5) * window.innerWidth;
  out.y = (-_v.y * 0.5 + 0.5) * window.innerHeight;
  return _v.z < 1;
}
