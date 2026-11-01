import type { EngineDef } from '../types';

// One stock engine per Frame for now; swapping engines arrives with inventory (M2).
export const ENGINES: Record<string, EngineDef> = {
  'kestrel-jet': e('kestrel-jet', 'Kestrel Jet', 60, 90, 125, 190, 110, 2.0),
  'mule-turbine': e('mule-turbine', 'Mule Turbine', 40, 60, 85, 135, 70, 1.05),
  'lantern-drive': e('lantern-drive', 'Lantern Drive', 50, 75, 105, 165, 90, 1.55),
  // Hover rig: no minimum speed, the Bulwark can sit still.
  'crawler-rig': e('crawler-rig', 'Crawler Rig', 0, 45, 65, 105, 60, 1.2),
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
