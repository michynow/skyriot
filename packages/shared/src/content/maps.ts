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
