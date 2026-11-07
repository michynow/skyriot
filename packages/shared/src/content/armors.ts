import type { ArmorDef, FrameId } from '../types';
import { FRAMES } from './frames';

// One armor line per Frame, T1–T3. T1 = the Frame's stock hull (balance freeze: an un-geared Ship plays as today);
// T2 / T3 step HP and shield up like the engine variants and add a little Defence.
const LINES: Record<FrameId, [string, string, string]> = {
  wasp: ['scale-plating', 'lamellar-plating', 'dragonscale-plating'],
  anvil: ['riveted-slab', 'bolted-slab', 'bastion-slab'],
  halo: ['ring-plate', 'choir-plate', 'seraph-plate'],
  bulwark: ['hull-plate', 'ironclad-plate', 'dreadnought-plate'],
};

/** Per tier: HP / shield multiplier, shield regen multiplier, Defence added on top of the Frame's. */
const STEPS = [
  { hull: 1, regen: 1, defence: 0 },
  { hull: 1.08, regen: 1.05, defence: 0.03 },
  { hull: 1.16, regen: 1.1, defence: 0.06 },
];

export const ARMOR_NAMES: Record<string, string> = {
  'scale-plating': 'Scale Plating',
  'lamellar-plating': 'Lamellar Plating',
  'dragonscale-plating': 'Dragonscale Plating',
  'riveted-slab': 'Riveted Slab',
  'bolted-slab': 'Bolted Slab',
  'bastion-slab': 'Bastion Slab',
  'ring-plate': 'Ring Plate',
  'choir-plate': 'Choir Plate',
  'seraph-plate': 'Seraph Plate',
  'hull-plate': 'Hull Plate',
  'ironclad-plate': 'Ironclad Plate',
  'dreadnought-plate': 'Dreadnought Plate',
};

export const ARMORS: Record<string, ArmorDef> = {};
/** Which Frame each armor fits. */
export const ARMOR_FRAME: Record<string, FrameId> = {};
/** Tier (1–3) of each armor. */
export const ARMOR_TIER: Record<string, number> = {};

for (const [frame, ids] of Object.entries(LINES) as [FrameId, string[]][]) {
  const f = FRAMES[frame];
  ids.forEach((id, i) => {
    const s = STEPS[i]!;
    ARMORS[id] = {
      id,
      maxHp: Math.round(f.maxHp * s.hull),
      maxShield: Math.round(f.maxShield * s.hull),
      shieldRegenPerSec: Math.round(f.shieldRegenPerSec * s.regen),
      defence: (f.defence ?? 0) + s.defence,
    };
    ARMOR_FRAME[id] = frame;
    ARMOR_TIER[id] = i + 1;
  });
}

/** Stock (T1) armor per Frame. */
export const STOCK_ARMOR: Record<FrameId, string> = {
  wasp: LINES.wasp[0],
  anvil: LINES.anvil[0],
  halo: LINES.halo[0],
  bulwark: LINES.bulwark[0],
};
