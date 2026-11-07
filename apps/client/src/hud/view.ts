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

/**
 * Project a world point to CSS pixels, pinned inside the screen (`margin` px from the edge) in its direction when
 * it is off-screen or behind the camera. Returns 0 without a camera, 1 on screen, 2 pinned to the edge.
 */
export function projectPinned(
  x: number,
  y: number,
  z: number,
  out: { x: number; y: number },
  margin = 70,
): 0 | 1 | 2 {
  const cam = view.camera;
  if (!cam) return 0;
  _v.set(x, y, z).project(cam);
  let nx = _v.x,
    ny = _v.y;
  const behind = _v.z > 1;
  if (behind) {
    nx = -nx;
    ny = -ny;
  }
  const off = behind || Math.abs(nx) > 1 || Math.abs(ny) > 1;
  if (off) {
    const mx = 1 - (2 * margin) / window.innerWidth,
      my = 1 - (2 * margin) / window.innerHeight;
    const s = Math.min(mx / Math.max(Math.abs(nx), 1e-6), my / Math.max(Math.abs(ny), 1e-6));
    nx *= s;
    ny *= s;
  }
  out.x = (nx * 0.5 + 0.5) * window.innerWidth;
  out.y = (-ny * 0.5 + 0.5) * window.innerHeight;
  return off ? 2 : 1;
}
