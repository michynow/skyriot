import { create } from 'zustand';
import type { ShipState } from '@skyriot/shared';
import { world } from '../state/world';

/** Dev-only look override (set from dev/LookPreview); stays `off` in production builds. */
export const useLookOverride = create(() => ({
  apply: 'off' as 'off' | 'own' | 'all',
  tier: 1,
  upgrade: 0,
}));

/** Tier/upgrade a Ship is drawn with: its gear, unless the dev override applies. */
export function lookOf(s: Pick<ShipState, 'id' | 'tier' | 'upgrade'>) {
  const o = useLookOverride.getState();
  if (o.apply === 'all' || (o.apply === 'own' && s.id === world.ownId)) return o;
  return s;
}
