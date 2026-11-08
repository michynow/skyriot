import type { EngineDef, FrameId } from '../types';

// Stock engine per Frame first, then its shop variants (tiers 2–3).
// Ships throttle down to minSpeed (0 = hover in place; the Wasp's jets can't, it holds 50 m/s);
// boostTurnMul widens the turn while boosting (heavier = wider). Speeds: stock Wasp boosts to 560 m/s
// (max ~420, boost ~1.34x max); accel ~1.5 s to max. Turn rates (rad/s) are unchanged from the 125 m/s tune, so turn
// radius grows with speed (Wasp ~205 m at max).
// Class mobility (genre gear classes): Wasp fastest; Anvil as agile as the Wasp but a little slower;
// Halo the best turner (support duels, hover in place); Bulwark slow in the air, built to land.
export const ENGINES: Record<string, EngineDef> = {
  'kestrel-jet': e('kestrel-jet', 'Kestrel Jet', 300, 420, 560, 290, 2.04, 0.7, 50),
  'mule-turbine': e('mule-turbine', 'Mule Turbine', 265, 375, 505, 245, 1.83, 0.68),
  'lantern-drive': e('lantern-drive', 'Lantern Drive', 250, 350, 485, 200, 2.16, 0.65),
  'crawler-rig': e('crawler-rig', 'Crawler Rig', 185, 270, 380, 280, 1.4, 0.55),
  'falcon-jet': e('falcon-jet', 'Falcon Jet', 315, 440, 590, 310, 2.12, 0.7, 50),
  'gyre-jet': e('gyre-jet', 'Gyre Jet', 335, 465, 620, 330, 2.21, 0.7, 50),
  'ox-turbine': e('ox-turbine', 'Ox Turbine', 280, 390, 530, 260, 1.91, 0.68),
  'bison-turbine': e('bison-turbine', 'Bison Turbine', 295, 415, 555, 280, 1.99, 0.68),
  'beacon-drive': e('beacon-drive', 'Beacon Drive', 270, 370, 510, 215, 2.24, 0.65),
  'pharos-drive': e('pharos-drive', 'Pharos Drive', 280, 390, 540, 230, 2.33, 0.65),
  'tread-rig': e('tread-rig', 'Tread Rig', 200, 285, 405, 290, 1.46, 0.55),
  'titan-rig': e('titan-rig', 'Titan Rig', 205, 300, 425, 310, 1.52, 0.55),
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
