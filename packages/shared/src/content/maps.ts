import type { MapDef } from '../types';

export const RUSTWATER_CANYONS: MapDef = {
  id: 'rustwater-canyons',
  name: 'Rustwater Canyons',
  seed: 1337,
  size: 4000,
  resolution: 257,
  maxHeight: 420,
  ceiling: 900,
  env: {
    kind: 'atmosphere',
    gravity: 9.8,
    groundMode: 'terrain',
    fogColor: '#c98a5a',
    fogNear: 400,
    fogFar: 2600,
    sky: 'desert-dusk',
  },
  // Behind each Base (250 m back from the Core, 150 m up), out of the way of attack runs.
  launchDecks: {
    concord: [{ pos: [-1400, 382, -1050], radius: 60 }],
    vex: [{ pos: [1269, 380, 1384], radius: 60 }],
  },
  // Placed where the ground ahead of the tunnels stays low (see bases plateau in heightfield.ts).
  // Layout per Base, in metres along facing (a) and sideways (b): tunnels start at a=-40 inside the Core
  // and climb 10 degrees for 160 m; Shield Stations at a=60, b=±260; Turrets ring the front.
  bases: {
    concord: {
      core: [-1200, 232, -900],
      facing: [0.8, 0, 0.6],
      plateauRadius: 380,
      tunnels: [
        { start: [-1246.4, 240, -904.8], dir: [0.7878, 0.1736, 0.5909], length: 160 },
        { start: [-1232, 240, -924], dir: [0.7878, 0.1736, 0.5909], length: 160 },
        { start: [-1217.6, 240, -943.2], dir: [0.7878, 0.1736, 0.5909], length: 160 },
      ],
      turrets: [
        [-1024, 232, -768],
        [-978, 232, -946],
        [-1182, 232, -674],
        [-1132, 232, -1124],
        [-1396, 232, -772],
      ],
      shieldStations: [
        [-996, 232, -1072],
        [-1308, 232, -656],
      ],
      shieldRadius: 170,
    },
    vex: {
      core: [1100, 230, 1200],
      facing: [-0.6757, 0, -0.7372],
      plateauRadius: 380,
      tunnels: [
        { start: [1144.7, 238, 1213.3], dir: [-0.6655, 0.1736, -0.726], length: 160 },
        { start: [1127, 238, 1229.5], dir: [-0.6655, 0.1736, -0.726], length: 160 },
        { start: [1109.3, 238, 1245.7], dir: [-0.6655, 0.1736, -0.726], length: 160 },
      ],
      turrets: [
        [951.3, 230, 1037.8],
        [873.3, 230, 1204.3],
        [1124, 230, 974.6],
        [991.9, 230, 1407.6],
        [1316.2, 230, 1110.3],
      ],
      shieldStations: [
        [867.8, 230, 1331.5],
        [1251.1, 230, 980.1],
      ],
      shieldRadius: 170,
    },
  },
  spawns: {
    concord: [
      [-1100, 450, -1100],
      [-1050, 470, -1150],
      [-1150, 460, -1050],
      [-1000, 480, -1200],
    ],
    vex: [
      [1100, 450, 1100],
      [1050, 470, 1150],
      [1150, 460, 1050],
      [1000, 480, 1200],
    ],
  },
  // Above the ridgelines behind each Base, inside the boundary warning (|x|, |z| < 1350): Concord side to Gildspire, Vex side to Rivet Harbor.
  gates: [
    { pos: [-1150, 620, -1200], radius: 45, to: 'gildspire' },
    { pos: [1250, 620, 1150], radius: 45, to: 'rivet-harbor' },
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
    // Soft boundary starts 450 m in from the edge; 2400 leaves a ±750 m open bowl.
    size: 2400,
    resolution: 129,
    maxHeight: 60,
    ceiling: 700,
    city: nation,
    env: {
      kind: 'atmosphere',
      gravity: 9.8,
      groundMode: 'terrain',
      fogColor: fog,
      fogNear: 500,
      fogFar: 2200,
      sky: 'desert-dusk',
    },
    launchDecks: { concord: [], vex: [] },
    spawns: {
      concord: [[0, 260, 300]],
      vex: [[0, 260, 300]],
    },
    // Off the spawn's heading (spawns face the centre), so a fresh Pilot doesn't drift straight in.
    gates: [{ pos: [-450, 260, -350], radius: 45, to: RUSTWATER_CANYONS.id }],
  };
}

export const GILDSPIRE = city('gildspire', 'Gildspire', 'concord', 4242, '#e3c38a');
export const RIVET_HARBOR = city('rivet-harbor', 'Rivet Harbor', 'vex', 6161, '#a8705a');

export const MAPS: Record<string, MapDef> = {
  [RUSTWATER_CANYONS.id]: RUSTWATER_CANYONS,
  [GILDSPIRE.id]: GILDSPIRE,
  [RIVET_HARBOR.id]: RIVET_HARBOR,
};
