import {
  ENGINES,
  FRAMES,
  MAX_UPGRADE,
  SHOP,
  WEAPONS,
  fitsSlot,
  itemTier,
  upgradeCost,
  upgradeMul,
  type FrameId,
  type ItemDefId,
  type ItemInstance,
  type Loadout,
} from '@skyriot/shared';
import { useHud } from '../hud/hudStore';
import { session } from '../net/session';
import { world } from '../state/world';
import { useProfile } from '../state/profile';

const SLOTS = ['primary', 'secondary', 'engine'] as const;

const nameOf = (def: ItemDefId) => WEAPONS[def]?.name ?? ENGINES[def]?.name ?? def;

/** The headline stat with upgrades applied, so a +1 visibly moves the number. */
function statOf(def: ItemDefId, upgrade: number): string {
  const m = upgradeMul(upgrade);
  const w = WEAPONS[def];
  if (w)
    return `${Math.round(w.damage * m)} dmg · ${Math.round((w.damage * m * w.pattern.count) / w.fireIntervalSec)} dps`;
  const e = ENGINES[def];
  return e ? `${Math.round(e.maxSpeed * m)} m/s · boost ${Math.round(e.boostSpeed * m)}` : '';
}

const slotFor = (frame: FrameId, def: ItemDefId) => SLOTS.find((s) => fitsSlot(frame, s, def));

function Item({ item, frame, loadout }: { item: ItemInstance; frame: FrameId; loadout: Loadout }) {
  const wallet = useProfile((s) => s.profile!.wallet);
  const slot = slotFor(frame, item.def);
  const equipped = slot !== undefined && loadout[slot] === item.id;
  const maxed = item.upgrade >= MAX_UPGRADE;
  const cost = upgradeCost(itemTier(item.def), item.upgrade + 1);
  const afford = wallet.credits >= cost.credits && wallet.scrap >= cost.scrap;
  return (
    <div className="hangar-row">
      <span>
        {nameOf(item.def)} <b>+{item.upgrade}</b>
        <em>
          T{itemTier(item.def)} · {statOf(item.def, item.upgrade)}
        </em>
      </span>
      <button
        type="button"
        className="ui-btn"
        disabled={maxed || !afford}
        onClick={() => session.conn?.upgrade({ item: item.id })}
      >
        {maxed ? 'MAX' : `+1 · ${cost.credits}c ${cost.scrap}s`}
      </button>
      {slot ? (
        <button
          type="button"
          className={`ui-btn ${equipped ? 'primary' : ''}`}
          onClick={() => session.conn?.equip({ frame, slot, item: equipped ? null : item.id })}
        >
          {equipped ? 'UNEQUIP' : `EQUIP ${slot.toUpperCase()}`}
        </button>
      ) : (
        <i>other Frame</i>
      )}
    </div>
  );
}

export function Hangar() {
  const profile = useProfile((s) => s.profile);
  const frame = useHud((h) => h.frame);
  if (!profile || !frame) return <p className="hangar-note">No Pilot profile yet.</p>;
  const loadout = profile.loadouts[frame] ?? {};
  const fd = FRAMES[frame];
  // Weapons and engines only: the RPG windows take over everything else.
  const gear = profile.items.filter((i) => i.kind === 'weapon' || i.kind === 'engine');
  const equippedName = (slot: (typeof SLOTS)[number]) => {
    const item = profile.items.find((i) => i.id === loadout[slot]);
    if (item) return `${nameOf(item.def)} +${item.upgrade}`;
    return `${nameOf(slot === 'engine' ? fd.engine : fd[slot])} (stock)`;
  };
  return (
    <>
      <h3>Wallet</h3>
      <div className="hangar-wallet">
        <span>
          <b>{profile.wallet.credits}</b> credits
        </span>
        <span>
          <b>{profile.wallet.scrap}</b> scrap
        </span>
      </div>

      <h3>{fd.name} loadout</h3>
      {SLOTS.map((slot) => (
        <div className="hangar-row" key={slot}>
          <span>
            <em>{slot}</em> {equippedName(slot)}
          </span>
        </div>
      ))}

      <h3>Inventory</h3>
      {gear.length === 0 && <p className="hangar-note">Nothing owned yet.</p>}
      {gear.map((item) => (
        <Item key={item.id} item={item} frame={frame} loadout={loadout} />
      ))}

      <h3>Shop · fits the {fd.name}</h3>
      {!world.map?.city && !import.meta.env.DEV && (
        <p className="hangar-note">
          The shop opens in Cities: fly through a Gate (marked on radar).
        </p>
      )}
      {(world.map?.city || import.meta.env.DEV) &&
        SHOP.filter((e) => slotFor(frame, e.def)).map((e) => (
          <div className="hangar-row" key={e.def}>
            <span>
              {nameOf(e.def)}
              <em>
                T{e.tier} · {slotFor(frame, e.def)} · {statOf(e.def, 0)}
              </em>
            </span>
            <button
              type="button"
              className="ui-btn"
              disabled={profile.wallet.credits < e.credits}
              onClick={() => session.conn?.buy({ def: e.def })}
            >
              BUY · {e.credits}c
            </button>
          </div>
        ))}
    </>
  );
}
