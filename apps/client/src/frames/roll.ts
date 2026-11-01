import { ROLL_DURATION_SEC, type ShipId, type ShipState } from '@skyriot/shared';

/** Last barrel-roll direction per Ship, written by the FX layer from `barrelRoll` events. */
export const rollDirs = new Map<ShipId, number>();
/** Render-clock start (ms) and direction of each roll in progress. */
const rolls = new Map<ShipId, { start: number; dir: number; done: boolean }>();

/**
 * Visual-only barrel-roll angle (radians, 0 when not rolling). The sim's rollPhase only advances per tick / snapshot
 * (20-30 Hz), which made the spin stutter; it is used to detect the start, then the spin runs on the render clock.
 */
export function rollAngle(s: ShipState): number {
  const now = performance.now();
  let r = rolls.get(s.id);
  if (!r && s.rollPhase >= 0) {
    r = {
      start: now - s.rollPhase * ROLL_DURATION_SEC * 1000,
      dir: s.rollDir || rollDirs.get(s.id) || 1,
      done: false,
    };
    rolls.set(s.id, r);
  }
  if (!r) return 0;
  // Kept (done) until the sim reports the roll over, so a lagging snapshot can't restart it.
  if (s.rollPhase < 0 && (r.done || !s.alive)) {
    rolls.delete(s.id);
    return 0;
  }
  const phase = (now - r.start) / (ROLL_DURATION_SEC * 1000);
  if (r.done || phase >= 1) {
    r.done = true;
    return 0;
  }
  const e = (1 - Math.cos(Math.PI * phase)) / 2; // ease in-out sine: peak spin ~1.6x average, no whip
  return e * Math.PI * 2 * r.dir;
}
