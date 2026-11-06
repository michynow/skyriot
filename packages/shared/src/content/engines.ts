import type { EngineDef, FrameId } from '../types';

// Stock engine per Frame first, then its shop variants (tiers 2–3).
// Ships throttle down to minSpeed (0 = hover in place; the Wasp's jets can't, it holds 50 m/s);
// boostTurnMul widens the turn while boosting (heavier = wider).
// Class mobility (genre gear classes): Wasp fastest; Anvil as agile as the Wasp but a little slower;
// Halo the best turner (support duels, hover in place); Bulwark slow in the air, built to land.
export const ENGINES: Record<string, EngineDef> = {
  'kestrel-jet': e('kestrel-jet', 'Kestrel Jet', 90, 125, 190, 130, 2.04, 0.7, 50),
  'mule-turbine': e('mule-turbine', 'Mule Turbine', 80, 112, 172, 110, 1.83, 0.68),
  'lantern-drive': e('lantern-drive', 'Lantern Drive', 75, 105, 165, 90, 2.16, 0.65),
  'crawler-rig': e('crawler-rig', 'Crawler Rig', 45, 65, 105, 100, 1.15, 0.55),
  'falcon-jet': e('falcon-jet', 'Falcon Jet', 95, 132, 200, 138, 2.12, 0.7, 50),
  'gyre-jet': e('gyre-jet', 'Gyre Jet', 100, 139, 210, 146, 2.21, 0.7, 50),
  'ox-turbine': e('ox-turbine', 'Ox Turbine', 84, 118, 181, 117, 1.91, 0.68),
  'bison-turbine': e('bison-turbine', 'Bison Turbine', 88, 124, 190, 124, 1.99, 0.68),
  'beacon-drive': e('beacon-drive', 'Beacon Drive', 80, 111, 174, 96, 2.24, 0.65),
  'pharos-drive': e('pharos-drive', 'Pharos Drive', 84, 117, 183, 102, 2.33, 0.65),
  'tread-rig': e('tread-rig', 'Tread Rig', 48, 69, 111, 106, 1.2, 0.55),
  'titan-rig': e('titan-rig', 'Titan Rig', 50, 73, 117, 112, 1.25, 0.55),
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
