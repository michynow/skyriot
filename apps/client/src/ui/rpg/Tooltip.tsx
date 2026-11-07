import type { ItemInstance } from '@skyriot/shared';
import { ITEMS } from '@skyriot/shared';

/** Item tooltip (rpg-ui.md §5 order). Placeholder until session C: name only. Fixed-position plate at `at`. */
export function ItemTooltip({ item, at }: { item: ItemInstance; at: [number, number] }) {
  const def = ITEMS[item.def];
  return (
    <div className="rpg-tooltip rpg-ui" style={{ left: at[0], top: at[1] }}>
      <b className={`rt-${item.rarity ?? 'standard'}`}>
        {def?.name ?? item.def}
        {item.upgrade > 0 && ` +${item.upgrade}`}
      </b>
    </div>
  );
}
