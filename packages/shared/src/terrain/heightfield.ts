import { createNoise2D } from 'simplex-noise';
import type { MapDef } from '../types';

export interface Heightfield {
  /** Samples per side. */
  resolution: number;
  size: number;
  /** Row-major (z rows, x columns), metres. Index = iz * resolution + ix. */
  heights: Float32Array;
}

/**
 * Deterministic terrain from map seed. Same output in browser and Node, so the client mesh
 * and the server Rapier heightfield collider always agree.
 */
export function generateHeightfield(map: MapDef): Heightfield {
  const n = map.resolution;
  const noise = createNoise2D(mulberry32(map.seed));
  const heights = new Float32Array(n * n);
  for (let iz = 0; iz < n; iz++) {
    for (let ix = 0; ix < n; ix++) {
      const u = ix / (n - 1);
      const v = iz / (n - 1);
      // Ridged multi-octave noise → sharp canyon walls; mesas from terracing.
      let h = 0;
      let amp = 1;
      let freq = 2.2;
      for (let o = 0; o < 5; o++) {
        const r = 1 - Math.abs(noise(u * freq, v * freq));
        h += r * r * amp;
        amp *= 0.5;
        freq *= 2.03;
      }
      h /= 1.9375;
      const terraced = Math.floor(h * 6) / 6;
      h = h * 0.55 + terraced * 0.45;
      heights[iz * n + ix] = flattenForBases(
        map,
        (u - 0.5) * map.size,
        (v - 0.5) * map.size,
        h * map.maxHeight,
      );
    }
  }
  return { resolution: n, size: map.size, heights };
}

/** Base plateau: flat at the Core's height within plateauRadius, smoothstep back to terrain over the next 30%. */
function flattenForBases(map: MapDef, x: number, z: number, h: number): number {
  for (const nation of ['concord', 'vex'] as const) {
    const base = map.bases[nation];
    const r = base.plateauRadius;
    const d = Math.hypot(x - base.core[0], z - base.core[2]);
    if (d >= r * PLATEAU_BLEND) continue;
    const t = Math.max(d - r, 0) / (r * (PLATEAU_BLEND - 1));
    const k = t * t * (3 - 2 * t);
    return base.core[1] * (1 - k) + h * k;
  }
  return h;
}

const PLATEAU_BLEND = 1.3;

/** Bilinear height at world x/z. Terrain spans [-size/2, size/2]. */
export function sampleHeight(hf: Heightfield, x: number, z: number): number {
  const n = hf.resolution;
  const fx = Math.min(Math.max((x / hf.size + 0.5) * (n - 1), 0), n - 1.0001);
  const fz = Math.min(Math.max((z / hf.size + 0.5) * (n - 1), 0), n - 1.0001);
  const ix = Math.floor(fx);
  const iz = Math.floor(fz);
  const tx = fx - ix;
  const tz = fz - iz;
  const h = hf.heights;
  const a = h[iz * n + ix]!;
  const b = h[iz * n + ix + 1]!;
  const c = h[(iz + 1) * n + ix]!;
  const d = h[(iz + 1) * n + ix + 1]!;
  return (a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + d * tx) * tz;
}

/** Seeded PRNG; also exported for sim use (no Math.random in sim). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
