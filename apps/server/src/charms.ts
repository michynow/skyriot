import { CHARMS, CHARM_NAMES, type CharmEffect, type PilotProfile } from '@skyriot/shared';

/** The Pilot's equipped Charm effects; same effect doesn't stack, the strongest counts. */
export function charmEffect(profile: PilotProfile): CharmEffect {
  const out: Record<string, number> = {};
  for (const id of profile.charms) {
    const e = CHARMS[profile.items.find((i) => i.id === id)?.def ?? '']?.effect;
    if (e) for (const [k, v] of Object.entries(e)) out[k] = Math.max(out[k] ?? 0, v ?? 0);
  }
  return out;
}

/**
 * Logged-in time passes for every activated Charm (equipped or not: unequipping doesn't pause it). Spent ones are
 * deleted. Returns their names (the caller re-sends the profile, which re-equips the sim: combat Charms end).
 * ponytail: called once a minute and on leave, so a Charm can run up to a minute over.
 */
export function tickCharms(profile: PilotProfile, elapsedMs: number): string[] {
  const expired: string[] = [];
  for (let k = profile.items.length - 1; k >= 0; k--) {
    const i = profile.items[k]!;
    if (i.kind !== 'charm' || i.msLeft === undefined) continue;
    i.msLeft = Math.max(0, Math.round(i.msLeft - elapsedMs));
    if (i.msLeft > 0) continue;
    profile.items.splice(k, 1);
    profile.charms = profile.charms.map((c) => (c === i.id ? null : c));
    expired.push(CHARM_NAMES[i.def] ?? i.def);
  }
  return expired;
}
