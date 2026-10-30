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
    concord: [{ pos: [-1600, 330, -1600], radius: 45 }],
    vex: [{ pos: [1600, 340, 1600], radius: 45 }],
  },
  spawns: {
    concord: [
      [-1600, 450, -1600],
      [-1550, 470, -1650],
      [-1650, 460, -1550],
      [-1500, 480, -1700],
    ],
    vex: [
      [1600, 450, 1600],
      [1550, 470, 1650],
      [1650, 460, 1550],
      [1500, 480, 1700],
    ],
  },
};

export const MAPS: Record<string, MapDef> = {
  [RUSTWATER_CANYONS.id]: RUSTWATER_CANYONS,
};
