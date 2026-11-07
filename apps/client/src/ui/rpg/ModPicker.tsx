import { create } from 'zustand';
import { ITEMS } from '@skyriot/shared';
import { session } from '../../net/session';
import { useRpgProfile } from './rpgData';
import { modLabel } from './Tooltip';
import './rpg.css';

const useModPicker = create<{ item: string | null; owner: string }>(() => ({
  item: null,
  owner: '',
}));

/** Open the "Choose Mod" picker for an item with an unchosen Mod slot; `owner` = the window that hosts it. */
export const openModPicker = (item: string, owner: string) =>
  useModPicker.setState({ item, owner });
export const closeModPicker = () => useModPicker.setState({ item: null });

/** The picker plate (centred over the window that owns it): three offers, pick one, once. */
export function ModPickerHost({ owner }: { owner: string }) {
  const { item: id, owner: o } = useModPicker();
  const profile = useRpgProfile();
  const item = profile?.items.find((i) => i.id === id);
  const slot = item?.mods?.findIndex((m) => typeof m !== 'string') ?? -1;
  if (!item || o !== owner || slot < 0) return null;
  const offers = item.mods![slot] as [string, string, string];
  const tier = ITEMS[item.def]?.tier ?? 1;
  return (
    <div className="rpg-modal" onPointerDown={(e) => e.stopPropagation()}>
      <div className="rpg-modal-card" role="dialog" aria-label="Choose Mod">
        <h3>Choose Mod</h3>
        <p>
          <b className={`rt-${item.rarity ?? 'standard'}`}>{ITEMS[item.def]?.name}</b> · slot{' '}
          {slot + 1}. You pick once; it can’t be changed.
        </p>
        {offers.map((m) => (
          <button
            key={m}
            type="button"
            className="rpg-btn wide"
            onClick={() => {
              session.conn?.chooseMod({ item: item.id, slot, mod: m });
              closeModPicker();
            }}
          >
            <i>◆</i> {modLabel(m, tier) ?? m}
          </button>
        ))}
        <button type="button" className="rpg-btn ghost" onClick={closeModPicker}>
          Later
        </button>
      </div>
    </div>
  );
}
