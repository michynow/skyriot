import type { EquipSlot, ItemDefId } from '@skyriot/shared';

/** Empty-slot silhouettes: every equipment slot (charm0–2 share one), a Consumable cell, and a generic one. */
export type GhostSlot = EquipSlot | 'consumable' | 'generic';

/** Item icon on a 48-unit grid (rpg-ui.md §7). Placeholder until session E: a blank square plate. */
export function ItemIcon({ def, tier = 1 }: { def: ItemDefId; tier?: number }) {
  return (
    <svg viewBox="0 0 48 48" data-def={def} data-tier={tier} aria-hidden>
      <rect x="2" y="2" width="44" height="44" fill="#22262c" stroke="#000" strokeWidth="1.5" />
    </svg>
  );
}

/** Faint silhouette shown in an empty Slot. Placeholder until session E. */
export function SlotGhost({ slot }: { slot: GhostSlot }) {
  return (
    <svg className="rpg-ghost" viewBox="0 0 48 48" data-slot={slot} aria-hidden>
      <rect
        x="12"
        y="12"
        width="24"
        height="24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
    </svg>
  );
}
