import type { MapDef } from '../types';

export const RUSTWATER_CANYONS: MapDef = {
  id: 'rustwater-canyons',
  // Stretched x1.5 (from 4000 m) for the 560 m/s speed tune: same terrain under every point, each Base's
  // layout moved along with its Core.
  name: 'Rustwater Canyons',
  seed: 1337,
  size: 6000,
  resolution: 257,
  maxHeight: 420,
  ceiling: 900,
  env: {
    kind: 'atmosphere',
    gravity: 9.8,
    groundMode: 'terrain',
    fogColor: '#c98a5a',
    fogNear: 600,
    fogFar: 3900,
    sky: 'desert-dusk',
  },
  // Behind each Base (250 m back from the Core, 150 m up), out of the way of attack runs.
  launchDecks: {
    concord: [{ pos: [-2000, 382, -1500], radius: 60 }],
    vex: [{ pos: [1819, 380, 1984], radius: 60 }],
  },
  // Placed where the ground ahead of the tunnels stays low (see bases plateau in heightfield.ts).
  // Layout per Base, in metres along facing (a) and sideways (b): tunnels start at a=-40 inside the Core
  // and climb 10 degrees for 160 m; Shield Stations at a=60, b=±260; Turrets ring the front.
  bases: {
    concord: {
      core: [-1800, 232, -1350],
      facing: [0.8, 0, 0.6],
      plateauRadius: 380,
      tunnels: [
        { start: [-1846.4, 240, -1354.8], dir: [0.7878, 0.1736, 0.5909], length: 160 },
        { start: [-1832, 240, -1374], dir: [0.7878, 0.1736, 0.5909], length: 160 },
        { start: [-1817.6, 240, -1393.2], dir: [0.7878, 0.1736, 0.5909], length: 160 },
      ],
      turrets: [
        [-1624, 232, -1218],
        [-1578, 232, -1396],
        [-1782, 232, -1124],
        [-1732, 232, -1574],
        [-1996, 232, -1222],
      ],
      shieldStations: [
        [-1596, 232, -1522],
        [-1908, 232, -1106],
      ],
      shieldRadius: 170,
    },
    vex: {
      core: [1650, 230, 1800],
      facing: [-0.6757, 0, -0.7372],
      plateauRadius: 380,
      tunnels: [
        { start: [1694.7, 238, 1813.3], dir: [-0.6655, 0.1736, -0.726], length: 160 },
        { start: [1677, 238, 1829.5], dir: [-0.6655, 0.1736, -0.726], length: 160 },
        { start: [1659.3, 238, 1845.7], dir: [-0.6655, 0.1736, -0.726], length: 160 },
      ],
      turrets: [
        [1501.3, 230, 1637.8],
        [1423.3, 230, 1804.3],
        [1674, 230, 1574.6],
        [1541.9, 230, 2007.6],
        [1866.2, 230, 1710.3],
      ],
      shieldStations: [
        [1417.8, 230, 1931.5],
        [1801.1, 230, 1580.1],
      ],
      shieldRadius: 170,
    },
  },
  spawns: {
    concord: [
      [-1650, 450, -1650],
      [-1575, 470, -1725],
      [-1725, 460, -1575],
      [-1500, 480, -1800],
    ],
    vex: [
      [1650, 450, 1650],
      [1575, 470, 1725],
      [1725, 460, 1575],
      [1500, 480, 1800],
    ],
  },
  // Above the ridgelines behind each Base, inside the boundary warning (|x|, |z| < 2000): Concord side to Gildspire, Vex side to Rivet Harbor.
  gates: [
    { pos: [-1725, 620, -1800], radius: 45, to: 'gildspire' },
    { pos: [1875, 620, 1725], radius: 45, to: 'rivet-harbor' },
  ],
};

/** City Maps: small, low rolling ground, no Bases. Safe zone (sim skips damage and firing). */
function city(
  id: string,
  name: string,
  nation: 'concord' | 'vex',
  seed: number,
  fog: string,
): MapDef {
  return {
    id,
    name,
    seed,
    // Soft boundary starts 700 m in from the edge; 3600 leaves a ±1100 m open bowl.
    size: 3600,
    resolution: 129,
    maxHeight: 60,
    ceiling: 700,
    city: nation,
    env: {
      kind: 'atmosphere',
      gravity: 9.8,
      groundMode: 'terrain',
      fogColor: fog,
      fogNear: 750,
      fogFar: 3300,
      sky: 'desert-dusk',
    },
    launchDecks: { concord: [], vex: [] },
    spawns: {
      concord: [[0, 260, 450]],
      vex: [[0, 260, 450]],
    },
    // Off the spawn's heading (spawns face the centre), so a fresh Pilot doesn't drift straight in.
    gates: [{ pos: [-675, 260, -525], radius: 45, to: RUSTWATER_CANYONS.id }],
  };
}

export const GILDSPIRE = city('gildspire', 'Gildspire', 'concord', 4242, '#e3c38a');
export const RIVET_HARBOR = city('rivet-harbor', 'Rivet Harbor', 'vex', 6161, '#a8705a');

export const MAPS: Record<string, MapDef> = {
  [RUSTWATER_CANYONS.id]: RUSTWATER_CANYONS,
  [GILDSPIRE.id]: GILDSPIRE,
  [RIVET_HARBOR.id]: RIVET_HARBOR,
};
