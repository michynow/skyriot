import {
  FRAMES,
  NOSE_OFFSET,
  SKILLS,
  TICK_DT,
  WEAPONS,
  type PilotInput,
  type ShipState,
  type SimEvent,
} from '@skyriot/shared';

type Spawn = Extract<SimEvent, { type: 'projectileSpawned' }>;

const MATCH_WINDOW_MS = 1500; // a local shot the server never confirmed stops waiting after this

// Cosmetic own Primary fire: shown the tick the input is sampled, matched later to the server's spawn.
let fireCd = 0;
let nextLocalId = -1;
const unmatched: { id: number; at: number }[] = [];
const rekey = new Map<number, number>();

/**
 * Mirror of the server's Primary fire timing for the own predicted Ship. Returns a local
 * `projectileSpawned` (negative id) when the server will most likely fire this tick too.
 */
export function predictOwnShot(s: ShipState, input: PilotInput): Spawn | null {
  fireCd = Math.max(fireCd - TICK_DT, -TICK_DT);
  if (!s.alive || s.launchPhase !== 'none' || s.halted || !input.fire1 || fireCd > 0) return null;
  if (s.ammo1 <= 0 || s.overheated) return null;
  const fd = FRAMES[s.frame];
  const w = WEAPONS[fd.primary];
  if (!w || w.kind !== 'tracer') return null;
  let rateMul = 1;
  for (const b of s.buffs) {
    const e = SKILLS[b.skill]?.buff;
    if (e?.noAttack) return null;
    rateMul *= e?.fireRateMul ?? 1;
  }
  fireCd += w.fireIntervalSec / rateMul;
  const [x, y, z, qw] = s.rot;
  const dir: [number, number, number] = [
    -2 * (x * z + qw * y),
    -2 * (y * z - qw * x),
    -(1 - 2 * (x * x + y * y)),
  ];
  const nose = fd.halfLength + NOSE_OFFSET;
  const id = nextLocalId--;
  const now = performance.now();
  while (unmatched.length && now - unmatched[0]!.at > MATCH_WINDOW_MS) unmatched.shift();
  unmatched.push({ id, at: now });
  return {
    type: 'projectileSpawned',
    id,
    owner: s.id,
    kind: 'tracer',
    weapon: w.id,
    origin: [s.pos[0] + dir[0] * nose, s.pos[1] + dir[1] * nose, s.pos[2] + dir[2] * nose],
    dir,
    speed: w.speed,
    target: null,
    tick: 0,
  };
}

/**
 * Server spawn of an own tracer: true if a local shot already showed it (skip the sound). The
 * FX then moves that local tracer onto the server's id and path (see `takeLocalShot`).
 */
export function matchOwnShot(e: Spawn): boolean {
  const now = performance.now();
  while (unmatched.length && now - unmatched[0]!.at > MATCH_WINDOW_MS) unmatched.shift();
  const local = unmatched.shift();
  if (!local) return false;
  rekey.set(e.id, local.id);
  return true;
}

/** FX side: the local id drawn for this server projectile, if any (consumed). */
export function takeLocalShot(serverId: number): number | undefined {
  const id = rekey.get(serverId);
  rekey.delete(serverId);
  return id;
}
