import type { ShipId, ShipState } from '@skyriot/shared';

/** Last barrel-roll direction per Ship, written by the FX layer from `barrelRoll` events. */
export const rollDirs = new Map<ShipId, number>();
const maxTicks = new Map<ShipId, number>();

/**
 * Visual-only barrel-roll angle (radians, 0 when not rolling). Uses ShipState.rollPhase (0..1, -1 = none) when the sim
 * provides it, else derives the phase from the countdown in rollTicks.
 */
export function rollAngle(s: ShipState): number {
  let phase = (s as { rollPhase?: number }).rollPhase;
  if (phase === undefined) {
    if (s.rollTicks > 0) {
      const m = Math.max(maxTicks.get(s.id) ?? 0, s.rollTicks);
      maxTicks.set(s.id, m);
      phase = 1 - s.rollTicks / m;
    } else {
      maxTicks.delete(s.id);
      phase = -1;
    }
  }
  if (phase < 0 || phase > 1) return 0;
  const e = phase < 0.5 ? 4 * phase * phase * phase : 1 - Math.pow(-2 * phase + 2, 3) / 2; // ease in-out cubic
  return e * Math.PI * 2 * ((s as { rollDir?: number }).rollDir || rollDirs.get(s.id) || 1);
}
