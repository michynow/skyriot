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
    stallSpeed: 30,
    groundMode: 'terrain',
    fogColor: '#c98a5a',
    fogNear: 400,
    fogFar: 2600,
    sky: 'desert-dusk',
  },
  launchDecks: {
    concord: [{ pos: [-1100, 330, -1100], radius: 60 }],
    vex: [{ pos: [1100, 340, 1100], radius: 60 }],
  },
  // ponytail: hand-placed; facing points at the map centre. Retune once the Base models land.
  bases: {
    concord: {
      core: [-1300, 160, -1300],
      facing: [0.7071, 0, 0.7071],
      plateauRadius: 420,
      tunnels: [
        { start: [-1360, 174, -1282], dir: [0.7071, 0, 0.7071], length: 160 },
        { start: [-1321, 174, -1321], dir: [0.7071, 0, 0.7071], length: 160 },
        { start: [-1282, 174, -1360], dir: [0.7071, 0, 0.7071], length: 160 },
      ],
      turrets: [
        [-1286, 166, -1060],
        [-1060, 166, -1286],
        [-1512, 166, -1173],
        [-1173, 166, -1512],
        [-1116, 166, -1116],
      ],
      shieldStations: [
        [-1456, 160, -975],
        [-975, 160, -1456],
      ],
      shieldRadius: 170,
    },
    vex: {
      core: [1300, 160, 1300],
      facing: [-0.7071, 0, -0.7071],
      plateauRadius: 420,
      tunnels: [
        { start: [1360, 174, 1282], dir: [-0.7071, 0, -0.7071], length: 160 },
        { start: [1321, 174, 1321], dir: [-0.7071, 0, -0.7071], length: 160 },
        { start: [1282, 174, 1360], dir: [-0.7071, 0, -0.7071], length: 160 },
      ],
      turrets: [
        [1286, 166, 1060],
        [1060, 166, 1286],
        [1512, 166, 1173],
        [1173, 166, 1512],
        [1116, 166, 1116],
      ],
      shieldStations: [
        [1456, 160, 975],
        [975, 160, 1456],
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
};

export const MAPS: Record<string, MapDef> = {
  [RUSTWATER_CANYONS.id]: RUSTWATER_CANYONS,
};
