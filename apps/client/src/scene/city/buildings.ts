import * as THREE from 'three';
import type { CityBlock, CityLayout } from '@skyriot/shared';
import { Bricks, SLOTS, type Slot } from '../../frames/bricks';

/**
 * City building looks, one builder per CityBlock kind. Local space: origin at the footprint centre on
 * the ground, +Z = front (toward the plaza / map centre), size = the collider box, so what you see is
 * what you hit (thin props like crane booms reach outside it on purpose).
 *
 * Slots are re-read per City (see CITY_MATS): Gildspire primary gold, secondary white stone, trim
 * sandstone; Rivet Harbor primary rust, secondary teal paint, trim concrete. accent = lights, glass =
 * lit windows, dark = roofs / steel.
 */
type Build = (b: Bricks, w: number, h: number, d: number, blk: CityBlock) => void;

// ------------------------------------------------------------------ Gildspire

const gildTower: Build = (b, w, h) => {
  const shaft = h * 0.62;
  b.box('trim', [w * 1.25, 8, w * 1.25], [0, 4, 0]);
  b.box('secondary', [w, shaft, w], [0, shaft / 2, 0]);
  // window strips on every face
  for (let i = -1; i <= 1; i++)
    for (const r of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      const off = w / 2 + 0.3;
      b.box(
        'glass',
        [w * 0.12, shaft - 30, 0.6],
        [
          Math.sin(r) * off + Math.cos(r) * i * w * 0.3,
          10 + (shaft - 30) / 2,
          Math.cos(r) * off - Math.sin(r) * i * w * 0.3,
        ],
        { rot: [0, r, 0] },
      );
    }
  // gilded bands
  for (let y = 22; y < shaft; y += 26) b.box('primary', [w * 1.08, 2.4, w * 1.08], [0, y, 0]);
  // upper tier, crown, spire
  const up = h * 0.2;
  b.box('primary', [w * 1.15, 4, w * 1.15], [0, shaft + 2, 0]);
  b.box('secondary', [w * 0.72, up, w * 0.72], [0, shaft + 4 + up / 2, 0]);
  b.box('glass', [w * 0.74, up * 0.3, w * 0.74], [0, shaft + 4 + up * 0.6, 0]);
  const crown = shaft + 4 + up;
  b.cyl('primary', w * 0.5, 6, [0, crown + 3, 0], { axis: 'y', r2: w * 0.42, seg: 8 });
  b.cyl('primary', w * 0.34, h - crown - 6, [0, crown + 6 + (h - crown - 6) / 2, 0], {
    axis: 'y',
    r2: 0.4,
    seg: 8,
  });
  b.box('accent', [2.4, 2.4, 2.4], [0, h - 1.2, 0]);
  // little flying buttresses at the corners
  for (const [sx, sz] of [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ] as const)
    b.wedge('primary', [3, 18, 8], [sx * (w / 2 + 2), shaft - 9, sz * (w / 2 + 2)], {
      rot: [0, Math.atan2(sx, sz) + Math.PI, 0],
    });
};

const gildHangar: Build = (b, w, h, d) => {
  // stone shell with a huge open mouth to the plaza
  const wall = 14;
  b.box('secondary', [wall, h, d], [-(w - wall) / 2, h / 2, 0]);
  b.box('secondary', [wall, h, d], [(w - wall) / 2, h / 2, 0]);
  b.box('secondary', [w, h, wall], [0, h / 2, -(d - wall) / 2]);
  b.box('dark', [w - wall * 2, 2, d - wall], [0, 1, 0]);
  b.box('dark', [w - wall * 2, h - 18, 2], [0, (h - 18) / 2, -(d - wall * 2) / 2]); // dark back wall
  b.box('secondary', [w, 16, d], [0, h - 8, 0]);
  // gold barrel roof + crest
  b.cyl('primary', d * 0.3, w * 0.96, [0, h - d * 0.14, 0], { axis: 'x', seg: 18 });
  b.box('primary', [w * 1.04, 4, 8], [0, h - 16, d / 2 - 4]);
  b.box('primary', [w * 0.3, 18, 4], [0, h + d * 0.16 + 6, 0]);
  // landing lights leading inside, pylons with beacons
  for (let z = -d / 2 + 20; z < d / 2 + 40; z += 12)
    for (const s of [-1, 1]) b.box('accent', [2, 0.6, 4], [s * (w / 2 - wall - 12), 1.6, z]);
  for (const s of [-1, 1]) {
    b.box('trim', [10, h + 20, 10], [s * (w / 2 + 6), (h + 20) / 2, d / 2 - 6]);
    b.box('primary', [12, 6, 12], [s * (w / 2 + 6), h + 23, d / 2 - 6]);
    b.box('accent', [4, 4, 4], [s * (w / 2 + 6), h + 28, d / 2 - 6]);
  }
  // windows along the sides
  for (let z = -d / 2 + 14; z < d / 2 - 10; z += 14)
    for (const s of [-1, 1]) b.box('glass', [0.6, 14, 8], [s * (w / 2 + 0.3), h * 0.55, z]);
};

const gildVendor: Build = (b, w, h, d) => {
  const body = h * 0.62;
  b.box('trim', [w + 8, 4, d + 8], [0, 2, 0]);
  b.box('secondary', [w, body, d - 14], [0, body / 2, -7]);
  // colonnade on the front
  for (let i = 0; i < 7; i++)
    b.cyl('secondary', 2.4, body, [-w / 2 + 6 + (i * (w - 12)) / 6, body / 2, d / 2 - 6], {
      axis: 'y',
      seg: 10,
    });
  b.box('primary', [w + 4, 5, d + 2], [0, body + 2.5, 0]);
  b.wedge('primary', [w * 0.7, h - body - 5, 12], [0, body + 5 + (h - body - 5) / 2, d / 2 - 8], {
    flip: true,
  });
  b.cyl('primary', w * 0.18, 8, [0, body + 9, -10], { axis: 'y', seg: 16 });
  b.ellipsoid('primary', [w * 0.36, w * 0.3, w * 0.36], [0, body + 13, -10], { top: true });
  // shop windows and forge glow
  for (let i = 0; i < 5; i++)
    b.box(
      'glass',
      [w / 8, body * 0.5, 0.6],
      [-w / 2 + w / 10 + (i * w) / 5.6, body * 0.4, d / 2 - 13.6],
    );
  b.box('accent', [w * 0.6, 1.2, 1.2], [0, body - 4, d / 2 - 2]);
};

const gildCharms: Build = (b, w, h) => {
  const r = w / 2;
  const body = h * 0.5;
  b.cyl('trim', r + 4, 4, [0, 2, 0], { axis: 'y', seg: 24 });
  b.cyl('secondary', r, body, [0, body / 2, 0], { axis: 'y', seg: 24 });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    b.box(
      'glass',
      [r * 0.3, body * 0.6, 0.6],
      [Math.sin(a) * (r + 0.2), body * 0.5, Math.cos(a) * (r + 0.2)],
      { rot: [0, a, 0] },
    );
  }
  b.torus('accent', r + 0.5, 1.2, [0, body, 0], { rot: [Math.PI / 2, 0, 0] });
  b.ellipsoid('primary', [w * 0.94, (h - body) * 1.6, w * 0.94], [0, body, 0], { top: true });
  b.cyl('primary', 1, 12, [0, h + 2, 0], { axis: 'y', r2: 0.2, seg: 6 });
  b.box('accent', [3, 3, 3], [0, h - 2, 0]);
};

const gildPlaza: Build = (b, w) => {
  const r = w / 2;
  b.cyl('trim', r, 1.2, [0, 0.6, 0], { axis: 'y', seg: 48 });
  b.torus('primary', r * 0.98, 1.4, [0, 1.2, 0], { rot: [Math.PI / 2, 0, 0] });
  b.torus('primary', r * 0.62, 1, [0, 1.2, 0], { rot: [Math.PI / 2, 0, 0] });
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    b.box(
      i % 2 ? 'secondary' : 'accent',
      [3, 0.5, r * 0.34],
      [Math.sin(a) * r * 0.8, 1.3, Math.cos(a) * r * 0.8],
      { rot: [0, a, 0] },
    );
  }
  // lamp posts around the rim
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + 0.13;
    const x = Math.sin(a) * r * 0.93,
      z = Math.cos(a) * r * 0.93;
    b.cyl('primary', 0.8, 12, [x, 7, z], { axis: 'y', seg: 6 });
    b.box('glass', [2.4, 2.4, 2.4], [x, 14, z]);
  }
};

const terrace: Build = (b, w, h, d) => {
  // three tiers stepping down and out from the plaza (+Z) toward the cliff (-Z)
  for (let i = 0; i < 3; i++) {
    const th = h - i * 16;
    const dd = d * (0.45 + i * 0.35);
    const z = d / 2 - dd / 2 - i * 4;
    b.box(i === 0 ? 'secondary' : 'trim', [w - i * 10, th, dd], [0, th / 2, z]);
    b.box('primary', [w - i * 10, 1.2, 1], [0, th + 0.6, z - dd / 2 + 0.5]);
    for (let x = -w / 2 + 16; x < w / 2 - 10 - i * 5; x += 22)
      b.box('glass', [6, 5, 0.6], [x, th - 8, z - dd / 2 - 0.3]);
  }
};

const gildBridge: Build = (b, w, h, d) => {
  b.box('secondary', [w, 2.4, d], [0, h - 1.2, 0]);
  for (const s of [-1, 1]) {
    b.box('primary', [0.8, 2.4, d], [s * (w / 2 - 0.4), h + 1.2, 0]);
    b.box('accent', [0.4, 0.3, d], [s * (w / 2 - 1.5), h + 0.2, 0]);
  }
  // keel truss under the deck and lamp posts
  b.box('trim', [w * 0.5, 3, d], [0, h - 4, 0]);
  for (let z = -d / 2 + 20; z < d / 2; z += 40) {
    b.wedge('primary', [w * 0.4, 10, 14], [0, h - 9, z - 7], { flip: true });
    b.wedge('primary', [w * 0.4, 10, 14], [0, h - 9, z + 7]);
    for (const s of [-1, 1]) {
      b.cyl('primary', 0.4, 7, [s * (w / 2 - 1), h + 3.5, z], { axis: 'y', seg: 6 });
      b.box('glass', [1.4, 1.4, 1.4], [s * (w / 2 - 1), h + 7.4, z]);
    }
  }
};

const gildPavilion: Build = (b, w, h) => {
  const r = w / 2;
  b.cyl('trim', r, 4, [0, 2, 0], { axis: 'y', seg: 24 });
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    b.cyl(
      'secondary',
      1.6,
      h * 0.6,
      [Math.sin(a) * r * 0.85, 4 + h * 0.3, Math.cos(a) * r * 0.85],
      { axis: 'y', seg: 8 },
    );
  }
  b.cyl('primary', r, 3, [0, 4 + h * 0.6, 0], { axis: 'y', seg: 24 });
  b.ellipsoid('primary', [w * 0.9, h * 0.7, w * 0.9], [0, 6 + h * 0.6, 0], { top: true });
  b.box('accent', [6, 1, 6], [0, 4.5, 0]);
};

const gildGatePillar: Build = (b, w, h) => {
  b.box('trim', [w * 1.5, 10, w * 1.5], [0, 5, 0]);
  b.box('secondary', [w, h, w], [0, h / 2, 0]);
  for (let y = 24; y < h - 10; y += 20) b.box('primary', [w * 1.12, 2, w * 1.12], [0, y, 0]);
  b.box('glass', [0.6, h - 40, w * 0.25], [w / 2 + 0.3, h / 2, 0]);
  b.box('glass', [0.6, h - 40, w * 0.25], [-w / 2 - 0.3, h / 2, 0]);
};

const gildGateLintel: Build = (b, w, h, d) => {
  b.box('primary', [w, h, d], [0, h / 2, 0]);
  b.box('secondary', [w * 0.6, 6, d + 2], [0, h + 3, 0]);
  b.wedge('primary', [w * 0.3, 16, d], [0, h + 14, 0], { rot: [0, Math.PI / 2, 0] });
  b.cyl('accent', 4, d + 3, [0, h / 2, 0], { seg: 16 });
};

// ------------------------------------------------------------------ Rivet Harbor

const shedHangar: Build = (b, w, h, d) => {
  const r = d / 2;
  const cy = h - r;
  // quonset: rust barrel roof on low teal walls, ribs every 14 m
  b.cyl('primary', r, w, [0, cy, 0], { axis: 'x', seg: 22 });
  for (let x = -w / 2; x <= w / 2; x += 14)
    b.cyl('dark', r + 0.6, 2, [x, cy, 0], { axis: 'x', seg: 22 });
  b.box('secondary', [w + 2, 10, d + 2], [0, 5, 0]);
  // front: big door, hazard stripes, floodlights
  b.box('dark', [w * 0.62, h * 0.66, 2], [0, h * 0.33, r + 0.8]);
  for (let i = 0; i < 9; i++)
    b.box(
      i % 2 ? 'dark' : 'accent',
      [(w * 0.62) / 9, 3, 2.4],
      [-w * 0.31 + (i + 0.5) * ((w * 0.62) / 9), h * 0.66 + 1.5, r + 1],
    );
  for (const s of [-1, 1]) {
    b.box('secondary', [8, h * 0.8, 8], [s * (w * 0.31 + 6), h * 0.4, r + 2]);
    b.box('glass', [6, 3, 3], [s * (w * 0.31 + 6), h * 0.8 + 1.5, r + 4]);
  }
  b.box('trim', [w * 0.5, 0.5, 60], [0, 0.3, r + 30]);
};

const workshop: Build = (b, w, h, d) => {
  const body = h * 0.6;
  b.box('primary', [w, body, d], [0, body / 2, 0]);
  // sawtooth roof: glazed north faces
  const n = 4;
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + w / n / 2 + (i * w) / n;
    b.wedge('dark', [d, h - body, w / n], [x, body + (h - body) / 2, 0], {
      rot: [0, Math.PI / 2, 0],
    });
    b.box(
      'glass',
      [0.6, (h - body) * 0.8, d * 0.9],
      [x + w / n / 2 - 0.4, body + (h - body) * 0.42, 0],
    );
  }
  // roll-up doors and a teal awning
  for (const x of [-w * 0.25, w * 0.25]) {
    b.box('secondary', [w * 0.3, body * 0.7, 1], [x, body * 0.35, d / 2 + 0.5]);
    for (let y = 2; y < body * 0.7; y += 3) b.box('dark', [w * 0.3, 0.3, 1.2], [x, y, d / 2 + 0.6]);
  }
  b.box('accent', [w * 0.9, 1, 1], [0, body * 0.78, d / 2 + 1]);
  b.cyl('dark', 3, h * 0.6, [w * 0.35, h + h * 0.15, -d * 0.25], { axis: 'y', seg: 10 });
  b.box('trim', [w + 30, 0.4, 40], [0, 0.2, d / 2 + 20]);
};

const charmStall: Build = (b, w, h, d) => {
  const body = h * 0.7;
  b.box('secondary', [w, body, d], [0, body / 2, 0]);
  b.box('dark', [w + 4, 3, d + 4], [0, body + 1.5, 0]);
  b.wedge('primary', [w + 6, 6, 12], [0, body * 0.6, d / 2 + 6], { flip: true });
  // neon sign frame + glowing window
  b.box('accent', [w * 0.7, 1.2, 1], [0, h - 1, d / 2 - 2]);
  b.box('accent', [1.2, h - body, 1], [-w * 0.35, body + (h - body) / 2, d / 2 - 2]);
  b.box('accent', [1.2, h - body, 1], [w * 0.35, body + (h - body) / 2, d / 2 - 2]);
  b.box('glass', [w * 0.6, body * 0.4, 0.6], [0, body * 0.3, d / 2 + 0.3]);
};

const scaffoldTower: Build = (b, w, h) => {
  const core = w * 0.68;
  b.box('dark', [core, h * 0.92, core], [0, (h * 0.92) / 2, 0]);
  for (let y = 18; y < h * 0.9; y += 18)
    for (const r of [0, Math.PI / 2, Math.PI, -Math.PI / 2])
      b.box(
        'glass',
        [core * 0.5, 4, 0.6],
        [Math.sin(r) * (core / 2 + 0.3), y, Math.cos(r) * (core / 2 + 0.3)],
        { rot: [0, r, 0] },
      );
  // scaffold: corner poles, ledgers every 12 m, some boarded decks
  for (const [sx, sz] of [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ] as const)
    b.box('secondary', [1, h * 0.86, 1], [(sx * w) / 2, (h * 0.86) / 2, (sz * w) / 2]);
  let k = 0;
  for (let y = 12; y < h * 0.86; y += 12, k++) {
    for (const r of [0, Math.PI / 2, Math.PI, -Math.PI / 2])
      b.box('secondary', [w, 0.8, 0.8], [Math.sin(r) * (w / 2), y, Math.cos(r) * (w / 2)], {
        rot: [0, r, 0],
      });
    if (k % 3 === 0) b.box('primary', [w, 0.6, (w - core) / 2], [0, y - 0.6, (w + core) / 4]);
  }
  // rooftop jib crane and warning light
  b.box('primary', [3, 20, 3], [core * 0.3, h * 0.92 + 10, 0]);
  b.box('primary', [w * 1.3, 2, 2], [core * 0.3 + w * 0.3, h * 0.92 + 19, 0]);
  b.box('accent', [2, 2, 2], [core * 0.3, h - 1, 0]);
};

const factory: Build = (b, w, h, d) => {
  b.box('primary', [w, h * 0.8, d], [0, h * 0.4, 0]);
  b.wedge('dark', [w, h * 0.2, d / 2], [0, h * 0.9, d / 4], { flip: true });
  b.wedge('dark', [w, h * 0.2, d / 2], [0, h * 0.9, -d / 4]);
  for (let x = -w / 2 + 12; x < w / 2; x += 18)
    b.box('glass', [8, 8, 0.6], [x, h * 0.55, d / 2 + 0.3]);
  // pipe run along the front
  b.cyl('secondary', 2.4, w, [0, h * 0.3, d / 2 + 4], { axis: 'x', seg: 10 });
  b.cyl('secondary', 1.6, w, [0, h * 0.3 + 6, d / 2 + 4], { axis: 'x', seg: 10 });
};

const stack: Build = (b, w, h) => {
  const r = w / 2;
  b.cyl('trim', r * 1.4, 8, [0, 4, 0], { axis: 'y', seg: 16 });
  const bands = 6;
  for (let i = 0; i < bands; i++) {
    const y0 = 8 + ((h - 8) * i) / bands;
    const y1 = 8 + ((h - 8) * (i + 1)) / bands;
    const r0 = r * (1 - (0.25 * i) / bands),
      r1 = r * (1 - (0.25 * (i + 1)) / bands);
    b.cyl(i % 2 ? 'primary' : 'dark', r0, y1 - y0, [0, (y0 + y1) / 2, 0], {
      axis: 'y',
      r2: r1,
      seg: 16,
    });
  }
  b.torus('accent', r * 0.78, 0.6, [0, h - 0.5, 0], { rot: [Math.PI / 2, 0, 0] });
  b.box('accent', [1.5, 1.5, 1.5], [r * 0.8, h * 0.6, 0]);
};

const warehouse: Build = (b, w, h, d) => {
  b.box('secondary', [w, h * 0.7, d], [0, h * 0.35, 0]);
  for (let x = -w / 2; x <= w / 2; x += 10)
    b.box('dark', [0.8, h * 0.7, d + 0.8], [x, h * 0.35, 0]);
  b.wedge('primary', [w, h * 0.3, d / 2], [0, h * 0.85, d / 4], { flip: true });
  b.wedge('primary', [w, h * 0.3, d / 2], [0, h * 0.85, -d / 4]);
  b.box('dark', [w * 0.3, h * 0.45, 1], [0, h * 0.225, d / 2 + 0.5]);
  b.box('accent', [2, 2, 1], [w * 0.2, h * 0.5, d / 2 + 0.6]);
};

const crane: Build = (b, w, h) => {
  // gantry legs straddling the quay, machinery house, boom out over the water
  const leg = w * 0.5;
  for (const [sx, sz] of [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ] as const)
    b.box('secondary', [2.6, h * 0.7, 2.6], [sx * leg, h * 0.35, sz * leg]);
  for (let y = 14; y < h * 0.7; y += 14)
    for (const s of [-1, 1]) {
      b.box('secondary', [w, 1.2, 1.2], [0, y, s * leg]);
      b.box('secondary', [1.2, 1.2, w], [s * leg, y, 0]);
    }
  b.box('primary', [w * 1.2, 14, w * 1.4], [0, h * 0.7 + 7, -w * 0.2]);
  b.box('glass', [w * 0.5, 4, 0.6], [0, h * 0.7 + 8, w * 0.5 + 0.3]);
  const by = h * 0.7 + 16;
  b.box('secondary', [3, 3, 96], [-w * 0.3, by, 48]);
  b.box('secondary', [3, 3, 96], [w * 0.3, by, 48]);
  for (let z = 6; z < 96; z += 12) b.box('secondary', [w * 0.6, 1, 1], [0, by, z]);
  b.box('secondary', [w * 0.7, 3, 34], [0, by, -24]);
  b.box('dark', [w * 0.8, 8, 10], [0, by - 2, -38]); // counterweight
  b.box('primary', [2.4, h - by, 2.4], [0, by + (h - by) / 2, 0]);
  b.box('accent', [1.6, 1.6, 1.6], [0, h, 0]);
  b.box('accent', [1.2, 1.2, 1.2], [0, by + 1.5, 95]);
  // trolley and hanging spreader
  b.box('dark', [w * 0.7, 3, 6], [0, by - 3, 70]);
  b.cyl('dark', 0.25, 30, [0, by - 18, 70], { axis: 'y', seg: 4 });
  b.box('primary', [12, 2, 4], [0, by - 34, 70]);
};

const CONTAINER_SLOTS: Slot[] = ['primary', 'secondary', 'dark', 'trim'];
const containers: Build = (b, w, h, d, blk) => {
  const n = Math.round(h / 8.6);
  const seed = Math.abs(Math.round(blk.pos[0] * 7 + blk.pos[2] * 13));
  for (let i = 0; i < n; i++) {
    const y = i * 8.6 + 4.3;
    const slot = CONTAINER_SLOTS[(seed + i * 3) % CONTAINER_SLOTS.length]!;
    b.box(slot, [w - 0.4, 8.4, d], [((seed + i) % 3) * 0.4 - 0.4, y, 0]);
    for (let z = -d / 2 + 2; z < d / 2; z += 4) b.box('dark', [w, 7.6, 0.4], [0, y, z]);
  }
};

const pier: Build = (b, w, h, d) => {
  b.box('trim', [w, 2, d], [0, h - 1, 0]);
  for (let z = -d / 2 + 8; z < d / 2; z += 16)
    for (const s of [-1, 1])
      b.cyl('dark', 1.6, h - 2, [s * (w / 2 - 3), (h - 2) / 2, z], { axis: 'y', seg: 8 });
  for (let z = -d / 2 + 10; z < d / 2; z += 30)
    for (const s of [-1, 1])
      b.cyl('primary', 0.8, 1.4, [s * (w / 2 - 1.5), h + 0.7, z], { axis: 'y', seg: 8 });
  b.box('accent', [0.6, 0.4, d], [w / 2 - 0.5, h + 0.2, 0]);
  b.box('accent', [0.6, 0.4, d], [-w / 2 + 0.5, h + 0.2, 0]);
};

const freighter: Build = (b, w, h, d) => {
  const hull = h * 0.45;
  b.box('dark', [w, hull, d * 0.8], [0, hull / 2, -d * 0.1]);
  b.box('primary', [w + 0.4, 3, d * 0.8], [0, 4, -d * 0.1]); // waterline rust
  b.wedge('dark', [w, hull, d * 0.2], [0, hull / 2, d * 0.4], { flip: true, rot: [0, 0, 0] });
  // deck cargo: container rows
  for (let z = -d * 0.32; z < d * 0.28; z += 22)
    for (let x = -w / 2 + 8; x < w / 2 - 4; x += 13)
      b.box(
        CONTAINER_SLOTS[Math.abs(Math.round(x + z)) % 4]!,
        [12, 8.4 * (1 + (Math.abs(Math.round(z)) % 2)), 20],
        [x, hull + 4.2 * (1 + (Math.abs(Math.round(z)) % 2)), z],
      );
  // bridge house at the stern
  b.box('secondary', [w * 0.8, h - hull, 24], [0, hull + (h - hull) / 2, -d * 0.44]);
  b.box('glass', [w * 0.82, 3, 24.4], [0, h - 5, -d * 0.44]);
  b.cyl('primary', 4, 16, [0, h + 8, -d * 0.47], { axis: 'y', seg: 10 });
  b.box('accent', [1.4, 1.4, 1.4], [0, hull + 1, d * 0.49]);
};

const breakwater: Build = (b, w, h, d) => {
  b.box('trim', [w, h, d], [0, h / 2, 0]);
  for (let x = -w / 2 + 10; x < w / 2; x += 20)
    b.box('dark', [8, 4, d + 6], [x, h * 0.4, 0], { rot: [0, 0.4, 0.3] });
};

const lighthouse: Build = (b, w, h) => {
  const r = w / 2;
  for (let i = 0; i < 5; i++) {
    const y0 = (h * 0.8 * i) / 5,
      y1 = (h * 0.8 * (i + 1)) / 5;
    b.cyl(i % 2 ? 'trim' : 'primary', r * (1 - i * 0.07), y1 - y0, [0, (y0 + y1) / 2, 0], {
      axis: 'y',
      r2: r * (1 - (i + 1) * 0.07),
      seg: 16,
    });
  }
  b.cyl('dark', r * 0.8, 3, [0, h * 0.8 + 1.5, 0], { axis: 'y', seg: 16 });
  b.cyl('glass', r * 0.5, h * 0.12, [0, h * 0.86 + 3, 0], { axis: 'y', seg: 12 });
  b.cyl('dark', r * 0.6, 4, [0, h - 2, 0], { axis: 'y', r2: 0.5, seg: 12 });
};

const quayPlaza: Build = (b, w) => {
  const r = w / 2;
  b.cyl('trim', r, 1, [0, 0.5, 0], { axis: 'y', seg: 40 });
  // painted hazard ring and lane stripes
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2;
    b.box(
      i % 2 ? 'accent' : 'dark',
      [(2 * Math.PI * r * 0.95) / 40, 0.3, 3],
      [Math.sin(a) * r * 0.95, 1.1, Math.cos(a) * r * 0.95],
      { rot: [0, a, 0] },
    );
  }
  for (const x of [-r * 0.6, r * 0.6]) b.box('secondary', [3, 0.3, r * 1.1], [x, 1.1, 0]);
  // floodlight masts
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.5;
    const x = Math.sin(a) * r * 0.9,
      z = Math.cos(a) * r * 0.9;
    b.box('dark', [1.6, 30, 1.6], [x, 15, z]);
    b.box('glass', [6, 3, 3], [x, 30, z]);
  }
};

const rivetGatePillar: Build = (b, w, h) => {
  // riveted girder pillar on a concrete footing
  b.box('trim', [w * 1.6, 8, w * 1.6], [0, 4, 0]);
  for (const [sx, sz] of [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ] as const)
    b.box('primary', [3, h, 3], [(sx * w) / 2 - sx * 1.5, h / 2, (sz * w) / 2 - sz * 1.5]);
  for (let y = 10; y < h; y += 14) {
    b.box('secondary', [w, 1.4, w], [0, y, 0]);
    for (const r of [0.7, -0.7]) b.box('dark', [w * 1.3, 1, 1], [0, y + 7, 0], { rot: [0, 0, r] });
  }
  b.box('accent', [3, 3, 3], [0, h - 2, w / 2 + 1]);
};

const rivetGateLintel: Build = (b, w, h, d) => {
  b.box('primary', [w, h, d], [0, h / 2, 0]);
  for (let x = -w / 2 + 4; x < w / 2; x += 6)
    b.cyl('dark', 0.6, 0.8, [x, h * 0.7, d / 2 + 0.3], { seg: 6 });
  for (let i = 0; i < 12; i++)
    b.box(
      i % 2 ? 'dark' : 'accent',
      [w / 12, 2.4, d + 0.6],
      [-w / 2 + (i + 0.5) * (w / 12), 1.2, 0],
    );
};

const BUILDERS: Record<string, Build> = {
  'gild-tower': gildTower,
  'gild-hangar': gildHangar,
  'gild-vendor': gildVendor,
  'gild-charms': gildCharms,
  'gild-plaza': gildPlaza,
  'gild-bridge': gildBridge,
  'gild-pavilion': gildPavilion,
  'gild-gate-pillar': gildGatePillar,
  'gild-gate-lintel': gildGateLintel,
  terrace,
  'shed-hangar': shedHangar,
  workshop,
  'charm-stall': charmStall,
  'scaffold-tower': scaffoldTower,
  factory,
  stack,
  warehouse,
  crane,
  containers,
  pier,
  freighter,
  breakwater,
  lighthouse,
  'quay-plaza': quayPlaza,
  'rivet-gate-pillar': rivetGatePillar,
  'rivet-gate-lintel': rivetGateLintel,
};

/** Whole City merged per slot (<= 6 draw calls). Unknown kinds fall back to a plain box so colliders stay visible. */
export function buildCity(layout: CityLayout): Partial<Record<Slot, THREE.BufferGeometry>> {
  const all = new Bricks();
  const m = new THREE.Matrix4();
  for (const blk of layout.blocks) {
    const b = new Bricks();
    const [w, h, d] = blk.size;
    const f = BUILDERS[blk.kind];
    if (f) f(b, w, h, d, blk);
    else b.box('secondary', [w, h, d], [0, h / 2, 0]);
    m.makeRotationY(blk.yaw ?? 0).setPosition(blk.pos[0], blk.pos[1], blk.pos[2]);
    for (const p of b.parts) {
      p.geo.applyMatrix4(m);
      all.parts.push(p);
    }
  }
  return all.build();
}

export { SLOTS };
