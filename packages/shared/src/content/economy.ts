import type { ShopEntry } from '../types';

export const MAX_UPGRADE = 10;

/** Shop catalogue; sessions add entries here. */
export const SHOP: ShopEntry[] = [];

/** Deterministic upgrade cost (ADR 0004): never fails, never breaks. `level` = the + being bought (1..10). */
export function upgradeCost(tier: number, level: number): { credits: number; scrap: number } {
  return { credits: Math.round(100 * tier * level ** 1.5), scrap: Math.round(5 * tier * level) };
}

/** Stat multiplier an upgraded item applies (damage for weapons, speeds for engines). */
export function upgradeMul(upgrade: number): number {
  return 1 + 0.04 * upgrade;
}
