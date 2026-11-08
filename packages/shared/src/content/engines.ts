import type { EngineDef, FrameId } from '../types';

// Stock engine per Frame first, then its shop variants (tiers 2–3).
// Ships throttle down to minSpeed (0 = hover in place; the Wasp's jets can't, it holds 50 m/s);
// boostTurnMul widens the turn while boosting (heavier = wider). Speeds: stock Wasp boosts to 400 m/s
// (max ~300, boost ~1.34x max); accel ~1.5 s to max. Turn rates are 0.8x the 125 m/s tune's (Wasp
// turn radius ~185 m at max).
// Class mobility (genre gear classes): Wasp fastest; Anvil as agile as the Wasp but a little slower;
// Halo the best turner (support duels, hover in place); Bulwark slow in the air, built to land.
export const ENGINES: Record<string, EngineDef> = {
  'kestrel-jet': e('kestrel-jet', 'Kestrel Jet', 215, 300, 400, 205, 1.63, 0.7, 50),
  'mule-turbine': e('mule-turbine', 'Mule Turbine', 190, 270, 360, 175, 1.46, 0.68),
  'lantern-drive': e('lantern-drive', 'Lantern Drive', 180, 250, 345, 145, 1.73, 0.65),
  'crawler-rig': e('crawler-rig', 'Crawler Rig', 130, 195, 270, 200, 1.25, 0.55),
  'falcon-jet': e('falcon-jet', 'Falcon Jet', 225, 315, 420, 220, 1.7, 0.7, 50),
  'gyre-jet': e('gyre-jet', 'Gyre Jet', 240, 330, 445, 235, 1.77, 0.7, 50),
  'ox-turbine': e('ox-turbine', 'Ox Turbine', 200, 280, 380, 185, 1.53, 0.68),
  'bison-turbine': e('bison-turbine', 'Bison Turbine', 210, 295, 395, 200, 1.59, 0.68),
  'beacon-drive': e('beacon-drive', 'Beacon Drive', 195, 265, 365, 155, 1.79, 0.65),
  'pharos-drive': e('pharos-drive', 'Pharos Drive', 200, 280, 385, 165, 1.86, 0.65),
  'tread-rig': e('tread-rig', 'Tread Rig', 145, 205, 290, 205, 1.3, 0.55),
  'titan-rig': e('titan-rig', 'Titan Rig', 145, 215, 305, 220, 1.35, 0.55),
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
