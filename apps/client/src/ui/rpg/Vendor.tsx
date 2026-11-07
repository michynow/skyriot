import { useEffect, useState } from 'react';
import {
  BAG_SIZE,
  FRAMES,
  ITEMS,
  MAX_UPGRADE,
  SHOP,
  upgradeCost,
  type ItemInstance,
} from '@skyriot/shared';
import { UiGlyph } from '../../hud/icons';
import { session } from '../../net/session';
import { ItemCell } from './ItemCell';
import { sellPrice, useRpgProfile, useShownFrame } from './rpgData';
import { TipLayer } from './Tooltip';
import { fmt, itemLines, slotFor, withUnit } from './statSheet';
import { Wallet } from './Wallet';
import { Window } from './Window';
import { openWindow } from './windows';
import './rpg.css';

type Tab = 'buy' | 'sell' | 'work';
const KINDS = ['weapon', 'engine', 'armor', 'radar', 'charm', 'cosmetic', 'consumable'];
const UPGRADABLE = ['weapon', 'engine', 'armor', 'radar'];

const synth = (def: string): ItemInstance => ({
  id: `shop:${def}`,
  def,
  kind: ITEMS[def]!.kind,
  upgrade: 0,
});

const SLOT_NAME: Record<string, string> = {
  primary: 'Primary',
  secondary: 'Secondary',
  engine: 'Engine',
  armor: 'Armor',
  radar: 'Radar',
  cosmetic: 'Cosmetic',
  charm: 'Charm',
};

/** Vendor window (V, Cities): Buy · Sell · Workshop. The Inventory opens beside it. */
/** Defined at module level: an inline component remounts each render and swallows clicks. */
const Row = ({
  item,
  children,
  sub,
}: {
  item: ItemInstance;
  sub: string;
  children: React.ReactNode;
}) => (
  <li className="v-row">
    <ItemCell item={item} ghost="generic" owner="vendor" />
    <div className="txt">
      <b className={`rt-${item.rarity ?? 'standard'}`}>
        {ITEMS[item.def]?.name}
        {item.upgrade > 0 && ` +${item.upgrade}`}
      </b>
      <span>{sub}</span>
    </div>
    {children}
  </li>
);

export function Vendor() {
  const profile = useRpgProfile();
  const frame = useShownFrame();
  const [tab, setTab] = useState<Tab>('buy');
  const [fits, setFits] = useState(true);
  const [pick, setPick] = useState<string | null>(null);
  useEffect(() => openWindow('inventory'), []);

  const bagFull = (profile?.items.filter((i) => i.bag != null).length ?? 0) >= BAG_SIZE;
  const credits = profile?.wallet.credits ?? 0;

  const buyList = SHOP.filter(
    (e) => !fits || ['consumable', 'cosmetic', 'charm'].includes(e.kind) || slotFor(frame, e.def),
  ).sort((a, b) => KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind) || a.tier - b.tier);
  const sellList = (profile?.items ?? []).filter((i) => i.bag != null && sellPrice(i) > 0);
  const workList = (profile?.items ?? []).filter((i) => UPGRADABLE.includes(i.kind));
  const chosen = workList.find((i) => i.id === pick) ?? workList[0];

  const headline = (item: ItemInstance) => {
    const l = itemLines(item).find((r) => ['dps', 'dmg', 'max', 'hp', 'range'].includes(r.key));
    return l ? `${l.label} ${withUnit(l)}` : '';
  };

  return (
    <Window id="vendor" title="Vendor" keyHint="V" width={520} defaultPos={[120, 60]}>
      <div className="vnd">
        <div className="rpg-tabs" role="tablist">
          {(
            [
              ['buy', 'Buy'],
              ['sell', 'Sell'],
              ['work', 'Workshop'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              className={tab === id ? 'on' : ''}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
          {tab === 'buy' && (
            <label className="chk">
              <input type="checkbox" checked={fits} onChange={(e) => setFits(e.target.checked)} />{' '}
              Fits the {FRAMES[frame].name}
            </label>
          )}
        </div>

        {tab === 'buy' && (
          <ul className="v-list">
            {bagFull && <li className="v-note">Bag is full: sell or discard something first.</li>}
            {buyList.map((e) => {
              const item = synth(e.def);
              const slot = slotFor(frame, e.def);
              return (
                <Row
                  key={e.def}
                  item={item}
                  sub={`${slot ? SLOT_NAME[slot] : e.kind} · Tier ${e.tier} · ${headline(item)}`.replace(
                    / · $/,
                    '',
                  )}
                >
                  <button
                    type="button"
                    className="rpg-btn price"
                    disabled={credits < e.credits || bagFull}
                    onClick={() => session.conn?.buy({ def: e.def })}
                  >
                    <UiGlyph name="credits" /> {fmt(e.credits)}
                  </button>
                </Row>
              );
            })}
          </ul>
        )}

        {tab === 'sell' && (
          <ul className="v-list">
            {sellList.length === 0 && <li className="v-note">Nothing in the Bag to sell.</li>}
            {sellList.map((i) => (
              <Row
                key={i.id}
                item={i}
                sub={`Tier ${ITEMS[i.def]?.tier}${i.upgrade ? ' · Upgrades not refunded' : ''}`}
              >
                <button
                  type="button"
                  className="rpg-btn price"
                  onClick={() => session.conn?.sell({ item: i.id })}
                >
                  <UiGlyph name="credits" /> {fmt(sellPrice(i))}
                </button>
              </Row>
            ))}
          </ul>
        )}

        {tab === 'work' && (
          <div className="work">
            <ul className="v-list short">
              {workList.map((i) => (
                <li key={i.id}>
                  <button
                    type="button"
                    className={`v-pick ${chosen?.id === i.id ? 'on' : ''}`}
                    onClick={() => setPick(i.id)}
                  >
                    <b className={`rt-${i.rarity ?? 'standard'}`}>{ITEMS[i.def]?.name}</b>
                    <span>+{i.upgrade}</span>
                  </button>
                </li>
              ))}
            </ul>
            {chosen &&
              profile &&
              (() => {
                const next = chosen.upgrade + 1;
                const maxed = chosen.upgrade >= MAX_UPGRADE;
                const cost = upgradeCost(ITEMS[chosen.def]?.tier ?? 1, next);
                const afford =
                  profile.wallet.credits >= cost.credits && profile.wallet.scrap >= cost.scrap;
                const after = itemLines({ def: chosen.def, upgrade: next });
                const now = itemLines(chosen);
                return (
                  <div className="ladder">
                    <h3 className="rpg-h">
                      {ITEMS[chosen.def]?.name} +{chosen.upgrade}
                    </h3>
                    <div className="steps" aria-label="Upgrade ladder">
                      {Array.from({ length: MAX_UPGRADE }, (_, k) => (
                        <i
                          key={k}
                          className={
                            k < chosen.upgrade ? 'done' : k === chosen.upgrade ? 'next' : ''
                          }
                        >
                          {k + 1}
                        </i>
                      ))}
                    </div>
                    {!maxed &&
                      now.map((l, k) => {
                        const a = after[k]!;
                        return (
                          <div className="st-row" key={l.key}>
                            <span>{l.label}</span>
                            <b>
                              {withUnit(l)} → <em className="up">{withUnit(a)}</em>
                            </b>
                          </div>
                        );
                      })}
                    <button
                      type="button"
                      className="rpg-btn wide"
                      disabled={maxed || !afford}
                      onClick={() => session.conn?.upgrade({ item: chosen.id })}
                    >
                      {maxed
                        ? 'Maxed at +10'
                        : `Upgrade to +${next} · ${fmt(cost.credits)} Credits + ${fmt(cost.scrap)} Scrap`}
                    </button>
                    {!maxed && !afford && <p className="v-note">Not enough Credits or Scrap.</p>}
                  </div>
                );
              })()}
          </div>
        )}

        <footer className="rpg-foot">{profile && <Wallet wallet={profile.wallet} />}</footer>
        <TipLayer owner="vendor" />
      </div>
    </Window>
  );
}
