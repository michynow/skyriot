import type { EngineDef, FrameId } from '../types';

// Stock engine per Frame first, then its shop variants (tiers 2–3).
export const ENGINES: Record<string, EngineDef> = {
  'kestrel-jet': e('kestrel-jet', 'Kestrel Jet', 60, 90, 125, 190, 130, 2.4),
  'mule-turbine': e('mule-turbine', 'Mule Turbine', 40, 60, 85, 135, 28, 0.85),
  'lantern-drive': e('lantern-drive', 'Lantern Drive', 50, 75, 105, 165, 60, 1.5),
  // Hover rig: no minimum speed, the Bulwark can sit still.
  'crawler-rig': e('crawler-rig', 'Crawler Rig', 0, 45, 65, 105, 100, 1.15),
  'falcon-jet': e('falcon-jet', 'Falcon Jet', 64, 95, 132, 200, 138, 2.5),
  'gyre-jet': e('gyre-jet', 'Gyre Jet', 68, 100, 139, 210, 146, 2.6),
  'ox-turbine': e('ox-turbine', 'Ox Turbine', 42, 64, 90, 143, 30, 0.9),
  'bison-turbine': e('bison-turbine', 'Bison Turbine', 45, 67, 95, 150, 33, 0.95),
  'beacon-drive': e('beacon-drive', 'Beacon Drive', 53, 80, 111, 174, 64, 1.58),
  'pharos-drive': e('pharos-drive', 'Pharos Drive', 56, 84, 117, 183, 68, 1.66),
  'tread-rig': e('tread-rig', 'Tread Rig', 0, 48, 69, 111, 106, 1.2),
  'titan-rig': e('titan-rig', 'Titan Rig', 0, 50, 73, 117, 112, 1.25),
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
  minSpeed: number,
  cruiseSpeed: number,
  maxSpeed: number,
  boostSpeed: number,
  accel: number,
  turnRate: number,
): EngineDef {
  return { id, name, minSpeed, cruiseSpeed, maxSpeed, boostSpeed, accel, turnRate };
}

/** Engine stats to spread into a FrameDef. */
export function engineStats(id: string): Omit<EngineDef, 'id' | 'name'> & { engine: string } {
  const { id: _id, name: _name, ...stats } = ENGINES[id]!;
  return { engine: id, ...stats };
}
