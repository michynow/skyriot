import type { Quat } from '../types';

// Scratch-free quaternion/basis helpers writing into caller-provided arrays.

export function forwardOf(q: Quat, out: number[]): void {
  const [x, y, z, w] = q;
  out[0] = -2 * (x * z + w * y);
  out[1] = -2 * (y * z - w * x);
  out[2] = -(1 - 2 * (x * x + y * y));
}

export function rightOf(q: Quat, out: number[]): void {
  const [x, y, z, w] = q;
  out[0] = 1 - 2 * (y * y + z * z);
  out[1] = 2 * (x * y + w * z);
  out[2] = 2 * (x * z - w * y);
}

export function upOf(q: Quat, out: number[]): void {
  const [x, y, z, w] = q;
  out[0] = 2 * (x * y - w * z);
  out[1] = 1 - 2 * (x * x + z * z);
  out[2] = 2 * (y * z + w * x);
}

/** Quaternion from orthonormal basis: columns right, up, back (= -forward). */
export function quatFromBasis(r: number[], u: number[], f: number[], out: Quat): void {
  const m00 = r[0]!,
    m10 = r[1]!,
    m20 = r[2]!;
  const m01 = u[0]!,
    m11 = u[1]!,
    m21 = u[2]!;
  const m02 = -f[0]!,
    m12 = -f[1]!,
    m22 = -f[2]!;
  const tr = m00 + m11 + m22;
  let x: number, y: number, z: number, w: number;
  if (tr > 0) {
    const s = Math.sqrt(tr + 1) * 2;
    w = 0.25 * s;
    x = (m21 - m12) / s;
    y = (m02 - m20) / s;
    z = (m10 - m01) / s;
  } else if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1 + m00 - m11 - m22) * 2;
    w = (m21 - m12) / s;
    x = 0.25 * s;
    y = (m01 + m10) / s;
    z = (m02 + m20) / s;
  } else if (m11 > m22) {
    const s = Math.sqrt(1 + m11 - m00 - m22) * 2;
    w = (m02 - m20) / s;
    x = (m01 + m10) / s;
    y = 0.25 * s;
    z = (m12 + m21) / s;
  } else {
    const s = Math.sqrt(1 + m22 - m00 - m11) * 2;
    w = (m10 - m01) / s;
    x = (m02 + m20) / s;
    y = (m12 + m21) / s;
    z = 0.25 * s;
  }
  const n = 1 / Math.hypot(x, y, z, w);
  out[0] = x * n;
  out[1] = y * n;
  out[2] = z * n;
  out[3] = w * n;
}

/**
 * Horizon-aligned right/up for forward `f`. Near vertical it falls back to the previous
 * orientation's right vector so the frame stays continuous.
 */
export function uprightFrame(f: number[], prev: Quat, outR: number[], outU: number[]): void {
  const fx = f[0]!,
    fy = f[1]!,
    fz = f[2]!;
  let rx = -fz,
    ry = 0,
    rz = fx;
  let len = Math.hypot(rx, rz);
  if (len < 1e-3) {
    rightOf(prev, outR);
    rx = outR[0]!;
    ry = outR[1]!;
    rz = outR[2]!;
    const d = rx * fx + ry * fy + rz * fz;
    rx -= d * fx;
    ry -= d * fy;
    rz -= d * fz;
    len = Math.hypot(rx, ry, rz);
  } else {
    len = Math.hypot(rx, ry, rz);
  }
  rx /= len;
  ry /= len;
  rz /= len;
  outR[0] = rx;
  outR[1] = ry;
  outR[2] = rz;
  outU[0] = ry * fz - rz * fy;
  outU[1] = rz * fx - rx * fz;
  outU[2] = rx * fy - ry * fx;
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
