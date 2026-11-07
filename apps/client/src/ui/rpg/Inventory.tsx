import { useMemo, useState } from 'react';
import { BAG_SIZE, ITEMS, type ItemInstance, type PilotProfile } from '@skyriot/shared';
import { UiGlyph } from '../../hud/icons';
import { session } from '../../net/session';
import type { DragPayload } from './dnd';
import { ItemCell } from './ItemCell';
import { ModPickerHost, openModPicker } from './ModPicker';
import { equip, inCity, sellPrice, targetSlot, useRpgProfile, useShownFrame } from './rpgData';
import { TipLayer, hideTip } from './Tooltip';
import { fmt, slotFor } from './statSheet';
import { Wallet } from './Wallet';
import { Window } from './Window';
import './rpg.css';

const FILTERS = [
  ['all', 'All', () => true],
  ['gear', 'Gear', (i: ItemInstance) => ['weapon', 'engine', 'armor', 'radar'].includes(i.kind)],
  ['cons', 'Consumables', (i: ItemInstance) => i.kind === 'consumable'],
  ['charm', 'Charms', (i: ItemInstance) => i.kind === 'charm'],
  ['cosm', 'Cosmetics', (i: ItemInstance) => i.kind === 'cosmetic'],
] as const;

const KIND_ORDER = ['weapon', 'engine', 'armor', 'radar', 'charm', 'cosmetic', 'consumable'];
const RARITY_ORDER = ['relic', 'prototype', 'custom', 'tuned', 'standard'];

/** Moves that turn the current Bag layout into kind → tier → rarity order (swap semantics, simulated locally). */
function sortMoves(items: ItemInstance[]): { item: string; bag: number }[] {
  const bagged = items.filter((i) => i.bag != null);
  const want = [...bagged].sort(
    (a, b) =>
      KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) ||
      (ITEMS[a.def]?.tier ?? 1) - (ITEMS[b.def]?.tier ?? 1) ||
      RARITY_ORDER.indexOf(a.rarity ?? 'standard') - RARITY_ORDER.indexOf(b.rarity ?? 'standard') ||
      a.def.localeCompare(b.def),
  );
  const cell: (string | null)[] = Array(BAG_SIZE).fill(null);
  for (const i of bagged) cell[i.bag!] = i.id;
  const moves: { item: string; bag: number }[] = [];
  want.forEach((i, k) => {
    if (cell[k] === i.id) return;
    const from = cell.indexOf(i.id);
    cell[from] = cell[k] ?? null;
    cell[k] = i.id;
    moves.push({ item: i.id, bag: k });
  });
  return moves;
}

/** Inventory window (I): the 8 × 6 Bag. */
export function Inventory() {
  const profile = useRpgProfile();
  const frame = useShownFrame();
  const [filter, setFilter] = useState<(typeof FILTERS)[number][0]>('all');
  const [sel, setSel] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<'sell' | 'discard' | null>(null);

  const cells = useMemo(() => {
    const c: (ItemInstance | undefined)[] = Array(BAG_SIZE).fill(undefined);
    for (const i of profile?.items ?? []) if (i.bag != null && i.bag < BAG_SIZE) c[i.bag] = i;
    return c;
  }, [profile]);
  const used = cells.filter(Boolean).length;
  const pred = FILTERS.find((f) => f[0] === filter)![2];
  const selected = profile?.items.find((i) => i.id === sel);

  const open = (p: PilotProfile, item: ItemInstance) => {
    if (item.mods?.some((m) => typeof m !== 'string')) return openModPicker(item.id, 'inventory');
    setSel(item.id);
    setConfirm(null);
    void p;
  };
  const equipItem = (p: PilotProfile, item: ItemInstance) => {
    const slot = targetSlot(p, frame, item);
    if (slot) equip(frame, slot, item.id);
  };
  const move = (payload: DragPayload, bag: number) => {
    if (payload.kind !== 'item') return;
    const it = profile?.items.find((i) => i.id === payload.item);
    if (!it) return;
    if (it.bag == null) {
      // dragged out of the paper-doll: unequip (the server puts it in the first free cell)
      for (const [f, l] of Object.entries(profile!.loadouts))
        for (const [slot, id] of Object.entries(l ?? {}))
          if (id === it.id) equip(f as never, slot as never, null);
      profile!.charms.forEach((c, n) => c === it.id && equip(frame, `charm${n}` as never, null));
      return;
    }
    session.conn?.moveItem({ item: it.id, bag });
  };

  return (
    <Window
      id="inventory"
      title="Inventory"
      keyHint="I"
      width={468}
      defaultPos={[Math.max(28, window.innerWidth - 500), 28]}
    >
      <div className="inv">
        <div className="rpg-tabs" role="tablist">
          {FILTERS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={filter === id}
              className={filter === id ? 'on' : ''}
              onClick={() => setFilter(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="bag">
          {cells.map((item, n) => (
            <ItemCell
              key={n}
              item={item}
              ghost="generic"
              owner="inventory"
              dim={!!item && !pred(item)}
              selected={!!item && item.id === sel}
              draggable
              onMiss={hideTip}
              accept={(p) => p.kind === 'item'}
              onDrop={(p) => move(p, n)}
              onClick={() => item && profile && open(profile, item)}
              onContextMenu={(e) => {
                e.preventDefault();
                if (item && profile) equipItem(profile, item);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && item && profile) open(profile, item);
              }}
              aria-label={item ? (ITEMS[item.def]?.name ?? item.def) : `Empty cell ${n + 1}`}
            />
          ))}
        </div>

        <div className="inv-sel">
          {selected && profile ? (
            <>
              <span className="nm">
                <b className={`rt-${selected.rarity ?? 'standard'}`}>{ITEMS[selected.def]?.name}</b>
                {selected.upgrade > 0 && ` +${selected.upgrade}`}
              </span>
              {slotFor(frame, selected.def) && (
                <button
                  type="button"
                  className="rpg-btn"
                  onClick={() => equipItem(profile, selected)}
                >
                  Equip
                </button>
              )}
              {inCity() && sellPrice(selected) > 0 && (
                <button
                  type="button"
                  className={`rpg-btn ${confirm === 'sell' ? 'danger' : ''}`}
                  onClick={() => {
                    if (confirm !== 'sell') return setConfirm('sell');
                    session.conn?.sell({ item: selected.id });
                    setConfirm(null);
                    setSel(null);
                  }}
                >
                  {confirm === 'sell'
                    ? `Confirm: sell for ${fmt(sellPrice(selected))}${selected.upgrade ? ', Upgrades not refunded' : ''}`
                    : `Sell ${fmt(sellPrice(selected))}`}
                </button>
              )}
              <button
                type="button"
                className={`rpg-btn ${confirm === 'discard' ? 'danger' : 'ghost'}`}
                onClick={() => {
                  if (confirm !== 'discard') return setConfirm('discard');
                  session.conn?.discard({ item: selected.id });
                  setConfirm(null);
                  setSel(null);
                }}
              >
                {confirm === 'discard' ? 'Confirm: destroy, no refund' : 'Discard'}
              </button>
            </>
          ) : (
            <span className="hint">
              Click an item for actions · right-click equips · drag to move
            </span>
          )}
        </div>

        <footer className="rpg-foot">
          {profile && <Wallet wallet={profile.wallet} />}
          <span className="cells">
            <b>{used}</b> / {BAG_SIZE}
          </span>
          <button
            type="button"
            className="rpg-btn"
            onClick={() =>
              profile && sortMoves(profile.items).forEach((m) => session.conn?.moveItem(m))
            }
          >
            <UiGlyph name="sort" /> Sort
          </button>
        </footer>
        <TipLayer owner="inventory" />
        <ModPickerHost owner="inventory" />
      </div>
    </Window>
  );
}
