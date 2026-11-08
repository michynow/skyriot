import type { CityBlock, CityLayout, GateDef, LaunchDeck, NationId, Vec3 } from '../types';
import { HARBOUR } from '../terrain/heightfield';

/** City content: ground, buildings (colliders + client look), Launch Decks and the Gate per City. */
export interface CityContent {
  layout: CityLayout;
  launchDecks: Record<NationId, LaunchDeck[]>;
  gate: GateDef;
  spawn: Vec3;
}

/** Yaw that turns a block's +Z face toward the map centre (same convention as Gates). */
const faceCentre = (x: number, z: number) => Math.atan2(-x, -z);

/** Gate frame: two pillars outside the ring and a lintel over it, standing on `groundY`, facing the centre. */
function gateFrame(pos: Vec3, radius: number, groundY: number, kind: string): CityBlock[] {
  const yaw = faceCentre(pos[0], pos[2]);
  const off = radius + 14;
  const top = pos[1] + radius + 10;
  const cx = Math.cos(yaw),
    sz = -Math.sin(yaw); // local +X in world
  const pillar = (s: number): CityBlock => ({
    kind: `${kind}-pillar`,
    pos: [pos[0] + cx * off * s, groundY, pos[2] + sz * off * s],
    size: [16, top - groundY, 16],
    yaw,
  });
  return [
    pillar(-1),
    pillar(1),
    { kind: `${kind}-lintel`, pos: [pos[0], top, pos[2]], size: [off * 2 + 16, 14, 16], yaw },
  ];
}

/** A level bridge between two points at deck height `y` (box long along local Z). */
function bridge(a: [number, number], b: [number, number], y: number, trim: number): CityBlock {
  const dx = b[0] - a[0],
    dz = b[1] - a[1];
  const len = Math.hypot(dx, dz) - trim * 2;
  return {
    kind: 'gild-bridge',
    pos: [(a[0] + b[0]) / 2, y, (a[1] + b[1]) / 2],
    size: [16, 5, len],
    yaw: Math.atan2(dx, dz),
  };
}

// ---------------------------------------------------------------- Gildspire

const G = 200; // main mesa top (SKY_MESAS[0])
const gildTower = (x: number, z: number, h: number, y = G, w = 34): CityBlock => ({
  kind: 'gild-tower',
  // sunk 20 m so a tower near the cliff edge never shows its footing
  pos: [x, y - 20, z],
  size: [w, h + 20, w],
  yaw: faceCentre(x, z),
});

const GILD_GATE: GateDef = { pos: [-730, 262, -570], radius: 45, to: 'rustwater-canyons' };

function gildTerraces(): CityBlock[] {
  const out: CityBlock[] = [];
  const gateA = Math.atan2(GILD_GATE.pos[0], GILD_GATE.pos[2]);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + 0.2;
    let da = Math.abs(a - gateA) % (Math.PI * 2);
    if (da > Math.PI) da = Math.PI * 2 - da;
    if (da < 0.45) continue; // keep the arrival approach open
    const r = 455;
    const x = Math.sin(a) * r,
      z = Math.cos(a) * r;
    // built down into the cliff lip: the tiers step out over the edge
    out.push({
      kind: 'terrace',
      pos: [x, G - 50, z],
      size: [130, 66 + (i % 3) * 8, 46],
      yaw: a + Math.PI,
    });
  }
  return out;
}

export const GILDSPIRE_CITY: CityContent = {
  gate: GILD_GATE,
  spawn: [-590, 275, -460],
  launchDecks: {
    concord: [
      { pos: [0, 214, 0], radius: 60 },
      { pos: [175, 214, 70], radius: 40 },
    ],
    vex: [{ pos: [-175, 214, 70], radius: 40 }],
  },
  layout: {
    ground: 'sky-mesa',
    blocks: [
      { kind: 'gild-plaza', pos: [0, G, 0], size: [440, 1.2, 440], shape: 'cyl', solid: false },
      // service ring around the plaza, fronts toward the decks
      { kind: 'gild-hangar', pos: [0, G, -330], size: [210, 72, 110], yaw: 0, service: 'hangar' },
      {
        kind: 'gild-vendor',
        pos: [310, G, 110],
        size: [96, 50, 80],
        yaw: faceCentre(310, 110),
        service: 'vendor',
      },
      {
        kind: 'gild-charms',
        pos: [-310, G, 110],
        size: [74, 46, 74],
        yaw: faceCentre(-310, 110),
        service: 'charms',
      },
      // gilded towers (kept off the gate-to-plaza approach)
      gildTower(260, -250, 300),
      gildTower(-140, -430, 230),
      gildTower(430, -110, 220),
      gildTower(150, 340, 260),
      gildTower(-210, 340, 240),
      gildTower(-420, -60, 190),
      gildTower(380, 240, 180),
      gildTower(-40, 420, 330, G, 44),
      // spire-top towers and pavilions
      gildTower(560, -470, 170, 300, 40),
      gildTower(-620, 360, 120, 260, 36),
      { kind: 'gild-pavilion', pos: [660, 230, 420], size: [70, 30, 70], shape: 'cyl' },
      // sky bridges from the city towers to the spires
      bridge([260, -250], [560, -470], 300, 24),
      bridge([-210, 340], [-620, 360], 260, 24),
      bridge([380, 240], [660, 420], 230, 30),
      ...gildTerraces(),
      ...gateFrame(GILD_GATE.pos, GILD_GATE.radius, 190, 'gild-gate'),
    ],
  },
};

// ---------------------------------------------------------------- Rivet Harbor

const Q = HARBOUR.quay;
const W = HARBOUR.bay;
const RIVET_GATE: GateDef = { pos: [-700, 170, -560], radius: 45, to: 'rustwater-canyons' };

/** Container stacks: deterministic heights from the index (8.6 m per container). */
function containerYard(
  x0: number,
  z0: number,
  cols: number,
  rows: number,
  yaw: number,
): CityBlock[] {
  const out: CityBlock[] = [];
  const c = Math.cos(yaw),
    s = Math.sin(yaw);
  for (let i = 0; i < cols; i++)
    for (let k = 0; k < rows; k++) {
      const lx = (i - (cols - 1) / 2) * 16,
        lz = (k - (rows - 1) / 2) * 44;
      const levels = 1 + ((i * 7 + k * 3 + cols) % 4);
      out.push({
        kind: 'containers',
        pos: [x0 + lx * c + lz * s, Q, z0 - lx * s + lz * c],
        size: [13, levels * 8.6, 40],
        yaw,
      });
    }
  return out;
}

export const RIVET_HARBOR_CITY: CityContent = {
  gate: RIVET_GATE,
  spawn: [-580, 185, -460],
  launchDecks: {
    vex: [
      { pos: [0, 20, -60], radius: 60 },
      { pos: [-165, 20, -20], radius: 40 },
    ],
    concord: [{ pos: [165, 20, -20], radius: 40 }],
  },
  layout: {
    ground: 'harbour',
    blocks: [
      { kind: 'quay-plaza', pos: [0, Q, -60], size: [340, 1, 340], shape: 'cyl', solid: false },
      { kind: 'shed-hangar', pos: [0, Q, -340], size: [200, 62, 110], yaw: 0, service: 'hangar' },
      {
        kind: 'workshop',
        pos: [310, Q, -130],
        size: [104, 40, 72],
        yaw: faceCentre(310, -130),
        service: 'vendor',
      },
      {
        kind: 'charm-stall',
        pos: [-300, Q, -150],
        size: [62, 30, 52],
        yaw: faceCentre(-300, -150),
        service: 'charms',
      },
      // scaffolded towers
      { kind: 'scaffold-tower', pos: [-540, Q, -230], size: [46, 210, 46], yaw: 0.2 },
      { kind: 'scaffold-tower', pos: [500, Q, -360], size: [52, 250, 52], yaw: -0.3 },
      { kind: 'scaffold-tower', pos: [-190, Q, -580], size: [40, 170, 40], yaw: 0.5 },
      // smelter with smoke stacks
      { kind: 'factory', pos: [720, Q, -140], size: [150, 42, 120], yaw: 0 },
      { kind: 'stack', pos: [670, Q, -240], size: [20, 160, 20], shape: 'cyl' },
      { kind: 'stack', pos: [730, Q, -250], size: [18, 140, 18], shape: 'cyl' },
      { kind: 'stack', pos: [790, Q, -235], size: [22, 175, 22], shape: 'cyl' },
      { kind: 'warehouse', pos: [-680, Q, -40], size: [130, 32, 74], yaw: 0.1 },
      { kind: 'warehouse', pos: [200, Q, -560], size: [150, 36, 80], yaw: 0 },
      // quay front: cranes over the piers, container yards either side of the plaza
      { kind: 'crane', pos: [-420, Q, 112], size: [24, 112, 24], yaw: 0 },
      { kind: 'crane', pos: [-300, Q, 112], size: [24, 104, 24], yaw: 0 },
      { kind: 'crane', pos: [300, Q, 112], size: [24, 108, 24], yaw: 0 },
      { kind: 'crane', pos: [420, Q, 112], size: [24, 116, 24], yaw: 0 },
      ...containerYard(-470, -10, 5, 2, 0),
      ...containerYard(470, 0, 5, 2, 0),
      ...containerYard(-200, 95, 4, 1, Math.PI / 2),
      // piers, the moored freighter, a breakwater with a lighthouse at the bay mouth
      { kind: 'pier', pos: [-360, W, 290], size: [44, Q - W, 280], yaw: 0 },
      { kind: 'pier', pos: [360, W, 290], size: [44, Q - W, 280], yaw: 0 },
      { kind: 'freighter', pos: [0, W, 380], size: [64, 34, 270], yaw: 0.04 },
      { kind: 'breakwater', pos: [560, W, 720], size: [460, 14, 30], yaw: 0.25 },
      { kind: 'lighthouse', pos: [775, W + 14, 665], size: [24, 80, 24], shape: 'cyl' },
      ...gateFrame(RIVET_GATE.pos, RIVET_GATE.radius, Q, 'rivet-gate'),
    ],
  },
};
