import type * as THREE from 'three';
import type { FrameId } from '@skyriot/shared';
import { Bricks, type Slot } from './bricks';

type V3 = [number, number, number];
type Geos = Partial<Record<Slot, THREE.BufferGeometry>>;

export interface Engine {
  pos: V3;
  r: number;
}
export interface FrameModelData {
  /** Static, merged per slot. */
  body: Geos;
  engines: Engine[];
  /** Halo ring: spins around Z at `pivot`. */
  spinner?: { pivot: V3; geos: Geos; speed: number };
  /** Bulwark siege legs: geometry for one leg hanging down from its pivot; instanced at `pivots` (x sign => side). */
  legs?: { geos: Geos; pivots: V3[] };
  /** Barrel + muzzle, separate so first-person view can keep it while hiding the hull (Bulwark). */
  gun?: Geos;
  /** Hover skirts + pads: lowered to ground contact when grounded (Bulwark). */
  hover?: Geos;
  /** Stabiliser fins for airborne siege: fin geometry extends +/-X from each pivot (side from pivot x). */
  fins?: { geos: Geos; pivots: V3[] };
  /** Hover glow pads (Bulwark). */
  pads?: { pos: V3; r: number }[];
}

export const tierBand = (tier: number) => Math.min(3, Math.max(0, Math.floor((tier - 1) / 3)));

/** Rank lights along the spine: one per tier. */
function pips(b: Bricks, tier: number, y: number, z0: number, step = 0.28) {
  const n = Math.min(10, Math.max(1, tier));
  for (let i = 0; i < n; i++) b.box('accent', [0.12, 0.06, 0.16], [0, y, z0 + i * step]);
}

function wasp(tier: number, glow: boolean): FrameModelData {
  const b = new Bricks();
  const band = tierBand(tier);
  // spine + nose
  b.box('primary', [0.9, 0.5, 3.0], [0, 0, 0.7], { studs: true });
  b.wedge('primary', [0.9, 0.5, 2.0], [0, 0, -2.0]);
  b.box('secondary', [0.5, 0.18, 2.4], [0, 0.34, 1.0]);
  b.ellipsoid('glass', [0.7, 0.55, 1.5], [0, 0.22, -0.55], { top: true });
  // swept wings (yawed plates) + wing roots
  for (const s of [1, -1]) {
    b.box('primary', [2.4, 0.1, 1.15], [s * 1.55, -0.05, 0.9], { rot: [0, -s * 0.52, 0] });
    b.box('secondary', [1.9, 0.06, 0.35], [s * 1.5, 0.03, 0.95], { rot: [0, -s * 0.52, 0] });
    b.wedge('dark', [0.25, 0.2, 1.3], [s * 2.55, -0.05, 1.8], { rot: [0, 0, 0] });
    // twin weapon pods under the wings
    b.cyl('dark', 0.2, 1.9, [s * 1.35, -0.28, 0.3]);
    b.cyl('accent', 0.1, 0.5, [s * 1.35, -0.28, -0.8]);
    b.cyl('dark', 0.05, 1.0, [s * 1.35, -0.28, -1.3]);
    // tail fins
    b.wedge('secondary', [0.1, 0.8, 1.1], [s * 0.5, 0.55, 2.0], { flip: false });
    b.cyl('dark', 0.28, 0.7, [s * 0.38, 0, 2.0]);
    b.cyl('accent', 0.2, 0.08, [s * 0.38, 0, 2.38]);
  }
  pips(b, tier, 0.44, 0.3);
  if (band >= 1) for (const s of [1, -1]) b.box('secondary', [0.1, 0.3, 1.6], [s * 0.5, 0.05, 0.6], { studs: false });
  if (band >= 2) for (const s of [1, -1]) {
    b.wedge('primary', [0.12, 0.45, 1.0], [s * 0.9, 0.0, -1.2], { flip: true });
    b.box('dark', [0.14, 0.14, 0.9], [s * 2.55, -0.02, 1.35], { rot: [0, -s * 0.52, 0] });
  }
  if (band >= 3) for (const s of [1, -1]) b.wedge('primary', [0.14, 1.2, 1.6], [s * 3.0, 0.4, 2.2], { flip: false, rot: [0, 0, s * 0.25] });
  if (glow) for (const s of [1, -1]) b.box('trim', [2.3, 0.04, 0.06], [s * 1.55, 0.02, 0.45], { rot: [0, -s * 0.52, 0] });
  return { body: b.build(), engines: [{ pos: [-0.38, 0, 2.4], r: 0.2 }, { pos: [0.38, 0, 2.4], r: 0.2 }] };
}

function anvil(tier: number, glow: boolean): FrameModelData {
  const b = new Bricks();
  const band = tierBand(tier);
  b.box('primary', [3.2, 1.2, 6.2], [0, 0, 0.7], { studs: true });
  b.wedge('primary', [3.2, 1.2, 2.6], [0, 0, -3.7]);
  b.ellipsoid('glass', [1.5, 0.9, 2.2], [0, 0.55, -2.4], { top: true });
  // bomb bay
  b.box('dark', [1.7, 0.45, 3.4], [0, -0.78, 0.9]);
  for (let i = 0; i < 3; i++) b.box('accent', [1.5, 0.05, 0.12], [0, -1.02, -0.3 + i * 1.2]);
  b.box('secondary', [3.3, 0.14, 0.5], [0, 0.62, 1.2]);
  for (const s of [1, -1]) {
    // broad wings with leading-edge wedge
    b.box('primary', [3.0, 0.35, 2.8], [s * 3.1, -0.15, 1.4], { rot: [0, -s * 0.12, 0], studs: true });
    b.wedge('secondary', [3.0, 0.3, 1.0], [s * 3.1, -0.15, -0.5], { rot: [0, -s * 0.12, 0] });
    // two nacelles per side
    for (const x of [2.0, 3.9]) {
      b.cyl('dark', 0.55, 2.4, [s * x, -0.1, 1.5]);
      b.cyl('secondary', 0.6, 0.35, [s * x, -0.1, 0.5]);
      b.cyl('accent', 0.42, 0.1, [s * x, -0.1, 2.72]);
    }
    b.wedge('secondary', [0.18, 1.8, 1.7], [s * 1.5, 1.2, 3.0], { flip: false });
    b.box('dark', [0.3, 0.3, 1.4], [s * 1.7, 0.7, -1.0]);
  }
  pips(b, tier, 0.7, 0.2, 0.3);
  if (band >= 1) for (const s of [1, -1]) b.box('dark', [0.5, 0.7, 4.0], [s * 1.85, 0.2, 0.7], { studs: true });
  if (band >= 2) {
    for (const s of [1, -1]) {
      b.cyl('dark', 0.16, 1.4, [s * 5.1, -0.1, -0.6]);
      b.box('primary', [0.5, 0.5, 1.2], [s * 5.3, -0.1, 1.4]);
    }
  }
  if (band >= 3) for (const s of [1, -1]) b.wedge('primary', [0.2, 1.6, 2.0], [s * 4.8, 0.9, 2.4]);
  if (glow) for (const s of [1, -1]) b.box('trim', [0.05, 0.05, 5.6], [s * 1.62, 0.2, 0.7]);
  return {
    body: b.build(),
    engines: [-3.9, -2, 2, 3.9].map((x) => ({ pos: [x, -0.1, 2.8] as V3, r: 0.4 })),
  };
}

function halo(tier: number, glow: boolean): FrameModelData {
  const b = new Bricks();
  const band = tierBand(tier);
  // rounded fuselage from round bricks
  b.cyl('primary', 0.85, 3.6, [0, 0, 0.2], { seg: 16 });
  b.ellipsoid('primary', [1.7, 1.7, 1.8], [0, 0, -1.6]);
  b.cyl('secondary', 0.9, 0.5, [0, 0, 0.9], { seg: 16 });
  b.cyl('secondary', 0.9, 0.3, [0, 0, -0.4], { seg: 16 });
  b.ellipsoid('glass', [1.0, 0.7, 1.6], [0, 0.55, -1.4], { top: true });
  b.cyl('dark', 0.5, 0.9, [0, 0, 2.2], { r2: 0.6 });
  b.cyl('accent', 0.38, 0.08, [0, 0, 2.68]);
  for (const s of [1, -1]) {
    // support pods + short stub wings
    b.box('primary', [1.3, 0.12, 0.9], [s * 1.2, -0.1, 0.9], { rot: [0, 0, s * 0.1] });
    b.cyl('secondary', 0.32, 1.7, [s * 1.9, -0.15, 1.0], { seg: 12 });
    b.ellipsoid('primary', [0.64, 0.64, 0.7], [s * 1.9, -0.15, 0.1]);
    b.cyl('accent', 0.2, 0.08, [s * 1.9, -0.15, 1.87]);
    // ring brackets
    b.box('dark', [1.4, 0.12, 0.14], [s * 0.7, 0.7 * 0.0, 0.2], { rot: [0, 0, s * 0.75] });
  }
  b.box('dark', [0.14, 1.2, 0.14], [0, 1.0, 0.2]);
  pips(b, tier, 0.86, 0.6);
  if (band >= 1) for (const s of [1, -1]) b.box('secondary', [0.2, 0.5, 1.2], [s * 0.9, 0.55, 1.4], { studs: false });
  if (band >= 2) b.cyl('secondary', 0.95, 0.15, [0, 0, 1.55], { seg: 16 });
  if (glow) b.cyl('trim', 0.92, 0.05, [0, 0, 0.2], { seg: 16 });

  // halo ring: spinning element, stands behind the canopy
  const r = new Bricks();
  r.torus('accent', 2.35, 0.17, [0, 0, 0]);
  r.torus('secondary', 2.35, 0.05, [0, 0, 0.18]);
  const n = 8;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    r.box('dark', [0.45, 0.38, 0.38], [Math.cos(a) * 2.35, Math.sin(a) * 2.35, 0], { rot: [0, 0, a] });
  }
  if (band >= 1) r.torus('primary', 1.7, 0.08, [0, 0, 0]);
  if (band >= 2) for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    r.box('accent', [0.3, 0.3, 0.3], [Math.cos(a) * 1.7, Math.sin(a) * 1.7, 0]);
  }
  if (glow) r.torus('trim', 2.35, 0.05, [0, 0, -0.18]);
  return {
    body: b.build(),
    engines: [{ pos: [0, 0, 2.7], r: 0.38 }, { pos: [-1.9, -0.15, 1.9], r: 0.2 }, { pos: [1.9, -0.15, 1.9], r: 0.2 }],
    spinner: { pivot: [0, 0, 0.2], geos: r.build(), speed: 0.9 },
  };
}

function bulwark(tier: number, glow: boolean): FrameModelData {
  const b = new Bricks();
  const band = tierBand(tier);
  const h = new Bricks();
  const gun = new Bricks();
  // hull
  b.box('primary', [3.6, 1.3, 5.2], [0, 0.1, 0.4], { studs: true });
  b.wedge('primary', [3.6, 1.0, 2.0], [0, 0.25, -3.1], { flip: true });
  // skirts
  for (const s of [1, -1]) {
    h.box('dark', [0.7, 1.0, 6.2], [s * 2.1, -0.15, 0.3]);
    h.box('accent', [0.06, 0.12, 5.4], [s * 2.47, -0.05, 0.3]);
    h.wedge('dark', [0.7, 1.0, 1.2], [s * 2.1, -0.15, -3.5], { flip: true });
    b.box('secondary', [0.9, 0.3, 1.3], [s * 2.1, 0.55, 0.9], { studs: true });
  }
  // turret
  b.cyl('dark', 1.15, 0.45, [0, 0.95, 0.2], { axis: 'y', seg: 16 });
  b.box('primary', [1.9, 0.9, 2.0], [0, 1.55, 0.2], { studs: true });
  b.wedge('primary', [1.9, 0.9, 1.0], [0, 1.55, -1.2], { flip: true });
  gun.cyl('dark', 0.2, 3.2, [0, 1.6, -2.6]);
  gun.cyl('secondary', 0.28, 0.5, [0, 1.6, -4.1]);
  b.box('accent', [0.5, 0.12, 0.3], [0, 2.05, 0.2]);
  b.ellipsoid('glass', [0.7, 0.4, 0.8], [0, 2.0, -0.4], { top: true });
  // rear thrusters
  b.box('dark', [2.4, 0.7, 0.6], [0, 0.1, 3.2]);
  const engines: Engine[] = [-0.8, 0.8].map((x) => ({ pos: [x, 0.1, 3.55] as V3, r: 0.3 }));
  for (const e of engines) b.cyl('accent', 0.26, 0.08, [e.pos[0], e.pos[1], 3.52]);
  pips(b, tier, 0.8, -0.6, 0.3);
  if (band >= 1) for (const s of [1, -1]) b.box('primary', [0.6, 0.8, 2.4], [s * 1.5, 0.75, 1.9], { studs: true });
  if (band >= 2) for (const s of [1, -1]) b.cyl('dark', 0.15, 1.8, [s * 1.0, 1.55, -1.2]);
  if (band >= 3) b.box('secondary', [1.3, 0.5, 1.0], [0, 2.3, 1.5], { studs: true });
  if (glow) for (const s of [1, -1]) b.box('trim', [0.05, 0.05, 5.8], [s * 2.47, 0.35, 0.3]);

  const pads = [[-1.4, -1.9], [1.4, -1.9], [-1.4, 1.9], [1.4, 1.9]].map(([x, z]) => ({ pos: [x!, -0.7, z!] as V3, r: 0.6 }));
  for (const p of pads) {
    h.cyl('dark', 0.7, 0.2, [p.pos[0], -0.6, p.pos[2]], { axis: 'y' });
    h.cyl('accent', 0.5, 0.06, [p.pos[0], -0.72, p.pos[2]], { axis: 'y' });
  }

  // siege leg: hangs down from its pivot
  const l = new Bricks();
  l.box('dark', [0.35, 2.3, 0.35], [0, -1.15, 0]);
  l.box('secondary', [0.45, 0.5, 0.45], [0, -0.3, 0]);
  l.cyl('dark', 0.55, 0.14, [0, -2.38, 0], { axis: 'y', r2: 0.7 });
  l.box('accent', [0.1, 0.5, 0.1], [0, -1.6, 0.2]);
  return {
    body: b.build(),
    gun: gun.build(),
    hover: h.build(),
    fins: (() => {
      const f = new Bricks();
      f.box('secondary', [1.8, 0.08, 1.1], [0.9, 0, 0]);
      f.box('accent', [0.12, 0.12, 1.1], [1.8, 0, 0]);
      f.wedge('dark', [1.2, 0.1, 0.8], [0.7, 0, 0.9], { rot: [0, 0, 0] });
      return { geos: f.build(), pivots: [[-1.8, 0.2, -1.6], [1.8, 0.2, -1.6], [-1.8, 0.2, 2.2], [1.8, 0.2, 2.2]] as V3[] };
    })(),
    engines,
    pads,
    legs: {
      geos: l.build(),
      pivots: [[-1.85, -0.1, -2.3], [1.85, -0.1, -2.3], [-1.85, -0.1, 2.5], [1.85, -0.1, 2.5]],
    },
  };
}

const cache = new Map<string, FrameModelData>();

/** Geometry is global and shared by all FrameModels of the same look; never disposed. */
export function getModel(frame: FrameId, tier: number, upgrade: number): FrameModelData {
  const t = Math.min(10, Math.max(1, Math.round(tier)));
  const glow = upgrade >= 7;
  const key = `${frame}|${t}|${glow ? 1 : 0}`;
  let m = cache.get(key);
  if (!m) {
    m = { wasp, anvil, halo, bulwark }[frame](t, glow);
    cache.set(key, m);
  }
  return m;
}
