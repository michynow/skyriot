import type { EngineDef, FrameId } from '../types';

// Stock engine per Frame first, then its shop variants (tiers 2–3).
// Ships throttle down to minSpeed (0 = hover in place; the Wasp's jets can't, it holds 50 m/s);
// boostTurnMul widens the turn while boosting (heavier = wider). Speeds: stock Wasp tops out at 560 m/s
// (boost ~1.34x max); accel ~1 s to max. Turn rates (rad/s) are unchanged from the 125 m/s tune, so turn
// radius grows with speed (Wasp ~275 m at max).
// Class mobility (genre gear classes): Wasp fastest; Anvil as agile as the Wasp but a little slower;
// Halo the best turner (support duels, hover in place); Bulwark slow in the air, built to land.
export const ENGINES: Record<string, EngineDef> = {
  'kestrel-jet': e('kestrel-jet', 'Kestrel Jet', 405, 560, 750, 580, 2.04, 0.7, 50),
  'mule-turbine': e('mule-turbine', 'Mule Turbine', 355, 500, 675, 490, 1.83, 0.68),
  'lantern-drive': e('lantern-drive', 'Lantern Drive', 335, 470, 650, 405, 2.16, 0.65),
  'crawler-rig': e('crawler-rig', 'Crawler Rig', 250, 360, 510, 555, 1.4, 0.55),
  'falcon-jet': e('falcon-jet', 'Falcon Jet', 425, 590, 790, 620, 2.12, 0.7, 50),
  'gyre-jet': e('gyre-jet', 'Gyre Jet', 450, 625, 830, 655, 2.21, 0.7, 50),
  'ox-turbine': e('ox-turbine', 'Ox Turbine', 375, 525, 710, 520, 1.91, 0.68),
  'bison-turbine': e('bison-turbine', 'Bison Turbine', 395, 555, 745, 555, 1.99, 0.68),
  'beacon-drive': e('beacon-drive', 'Beacon Drive', 360, 495, 685, 430, 2.24, 0.65),
  'pharos-drive': e('pharos-drive', 'Pharos Drive', 375, 525, 720, 455, 2.33, 0.65),
  'tread-rig': e('tread-rig', 'Tread Rig', 265, 380, 540, 585, 1.46, 0.55),
  'titan-rig': e('titan-rig', 'Titan Rig', 275, 405, 570, 620, 1.52, 0.55),
};

/** Which Frame each engine fits (an engine line is built for one hull). */
export const ENGINE_FRAME: Record<string, FrameId> = {
  'kestrel-jet': 'wasp',
  'falcon-jet': 'wasp',
  'gyre-jet': 'wasp',
  'mule-turbine': 'anvil',
  'ox-turbine': 'anvil',
  'bison-turbine': 'anvil',
  'lantern-drive': 'halo',
  'beacon-drive': 'halo',
  'pharos-drive': 'halo',
  'crawler-rig': 'bulwark',
  'tread-rig': 'bulwark',
  'titan-rig': 'bulwark',
};

function e(
  id: string,
  name: string,
  cruiseSpeed: number,
  maxSpeed: number,
  boostSpeed: number,
  accel: number,
  turnRate: number,
  boostTurnMul: number,
  minSpeed = 0,
): EngineDef {
  return {
    id,
    name,
    minSpeed,
    cruiseSpeed,
    maxSpeed,
    boostSpeed,
    accel,
    turnRate,
    boostTurnMul,
  };
}

/** Engine stats to spread into a FrameDef. */
export function engineStats(id: string): Omit<EngineDef, 'id' | 'name'> & { engine: string } {
  const { id: _id, name: _name, ...stats } = ENGINES[id]!;
  return { engine: id, ...stats };
}
