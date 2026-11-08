import type { MapDef } from '../types';
import { GILDSPIRE_CITY, RIVET_HARBOR_CITY, type CityContent } from './cities';

export const RUSTWATER_CANYONS: MapDef = {
  id: 'rustwater-canyons',
  // Stretched x1.25 (from 4000 m) for the 400 m/s boost tune: same terrain under every point, each Base's
  // layout moved along with its Core.
  name: 'Rustwater Canyons',
  seed: 1337,
  size: 5000,
  resolution: 257,
  maxHeight: 420,
  ceiling: 900,
  env: {
    kind: 'atmosphere',
    gravity: 9.8,
    groundMode: 'terrain',
    fogColor: '#c98a5a',
    fogNear: 500,
    fogFar: 3250,
    sky: 'desert-dusk',
  },
  // Behind each Base (250 m back from the Core, 150 m up), out of the way of attack runs.
  launchDecks: {
    concord: [{ pos: [-1700, 382, -1275], radius: 60 }],
    vex: [{ pos: [1544, 380, 1684], radius: 60 }],
  },
  // Placed where the ground ahead of the tunnels stays low (see bases plateau in heightfield.ts).
  // Layout per Base, in metres along facing (a) and sideways (b): tunnels start at a=-40 inside the Core
  // and climb 10 degrees for 160 m; Shield Stations at a=60, b=±260; Turrets ring the front.
  bases: {
    concord: {
      core: [-1500, 232, -1125],
      facing: [0.8, 0, 0.6],
      plateauRadius: 380,
      tunnels: [
        { start: [-1546.4, 240, -1129.8], dir: [0.7878, 0.1736, 0.5909], length: 160 },
        { start: [-1532, 240, -1149], dir: [0.7878, 0.1736, 0.5909], length: 160 },
        { start: [-1517.6, 240, -1168.2], dir: [0.7878, 0.1736, 0.5909], length: 160 },
      ],
      turrets: [
        [-1324, 232, -993],
        [-1278, 232, -1171],
        [-1482, 232, -899],
        [-1432, 232, -1349],
        [-1696, 232, -997],
      ],
      shieldStations: [
        [-1296, 232, -1297],
        [-1608, 232, -881],
      ],
      shieldRadius: 170,
    },
    vex: {
      core: [1375, 230, 1500],
      facing: [-0.6757, 0, -0.7372],
      plateauRadius: 380,
      tunnels: [
        { start: [1419.7, 238, 1513.3], dir: [-0.6655, 0.1736, -0.726], length: 160 },
        { start: [1402, 238, 1529.5], dir: [-0.6655, 0.1736, -0.726], length: 160 },
        { start: [1384.3, 238, 1545.7], dir: [-0.6655, 0.1736, -0.726], length: 160 },
      ],
      turrets: [
        [1226.3, 230, 1337.8],
        [1148.3, 230, 1504.3],
        [1399, 230, 1274.6],
        [1266.9, 230, 1707.6],
        [1591.2, 230, 1410.3],
      ],
      shieldStations: [
        [1142.8, 230, 1631.5],
        [1526.1, 230, 1280.1],
      ],
      shieldRadius: 170,
    },
  },
  spawns: {
    concord: [
      [-1375, 450, -1375],
      [-1312.5, 470, -1437.5],
      [-1437.5, 460, -1312.5],
      [-1250, 480, -1500],
    ],
    vex: [
      [1375, 450, 1375],
      [1312.5, 470, 1437.5],
      [1437.5, 460, 1312.5],
      [1250, 480, 1500],
    ],
  },
  // Above the ridgelines behind each Base, inside the boundary warning (|x|, |z| < 1670): Concord side to Gildspire, Vex side to Rivet Harbor.
  gates: [
    { pos: [-1437.5, 620, -1500], radius: 45, to: 'gildspire' },
    { pos: [1562.5, 620, 1437.5], radius: 45, to: 'rivet-harbor' },
  ],
};

/**
 * City Maps: no Bases, safe zone (sim skips damage and firing). Each has its own ground and buildings
 * (cities.ts); the Gate back to Rustwater sits on the far side so arrivals look across the City.
 */
function city(
  id: string,
  name: string,
  nation: 'concord' | 'vex',
  seed: number,
  fog: string,
  c: CityContent,
): MapDef {
  return {
    id,
    name,
    seed,
    // Soft boundary starts 700 m in from the edge; 3600 leaves a ±1100 m open bowl.
    size: 3600,
    resolution: 257,
    maxHeight: 300,
    ceiling: 700,
    city: nation,
    layout: c.layout,
    env: {
      kind: 'atmosphere',
      gravity: 9.8,
      groundMode: 'terrain',
      fogColor: fog,
      fogNear: 750,
      fogFar: 3300,
      sky: 'desert-dusk',
    },
    launchDecks: c.launchDecks,
    spawns: { concord: [c.spawn], vex: [c.spawn] },
    gates: [c.gate],
  };
}

export const GILDSPIRE = city('gildspire', 'Gildspire', 'concord', 4242, '#efd9ae', GILDSPIRE_CITY);
export const RIVET_HARBOR = city(
  'rivet-harbor',
  'Rivet Harbor',
  'vex',
  6161,
  '#7f8c86',
  RIVET_HARBOR_CITY,
);

export const MAPS: Record<string, MapDef> = {
  [RUSTWATER_CANYONS.id]: RUSTWATER_CANYONS,
  [GILDSPIRE.id]: GILDSPIRE,
  [RIVET_HARBOR.id]: RIVET_HARBOR,
};
