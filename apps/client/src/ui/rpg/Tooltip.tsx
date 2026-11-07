import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { create } from 'zustand';
import {
  FRAMES,
  ITEMS,
  MODS,
  WEAPONS,
  gearOf,
  modValue,
  type FrameId,
  type ItemInstance,
  type ModDef,
  type PilotProfile,
} from '@skyriot/shared';
import { ItemIcon } from './itemIcons';
import { sellPrice, useRpgProfile, useShownFrame } from './rpgData';
import {
  charmLines,
  compare,
  consumableText,
  fmt,
  itemLines,
  slotFor,
  timeLeft,
  withUnit,
} from './statSheet';
import './rpg.css';

// ---------- hover state ----------

interface TipState {
  item: ItemInstance | null;
  at: [number, number];
  owner: string;
}
const useTip = create<TipState>(() => ({ item: null, at: [0, 0], owner: '' }));

/** Spread on anything that shows an item on hover. `owner` = the window that renders the `<TipLayer/>`. */
export function tipProps(item: ItemInstance | undefined, owner: string) {
  return {
    onPointerEnter: (e: PointerEvent) =>
      item && useTip.setState({ item, at: [e.clientX, e.clientY], owner }),
    onPointerMove: (e: PointerEvent) => item && useTip.setState({ at: [e.clientX, e.clientY] }),
    onPointerLeave: () => item && useTip.setState({ item: null }),
  };
}
export const hideTip = () => useTip.setState({ item: null });

/** Renders the hovered item's tooltip (and, with Shift held, the equipped item's beside it). One per window. */
export function TipLayer({ owner }: { owner: string }) {
  const { item, at, owner: o } = useTip();
  const profile = useRpgProfile();
  const frame = useShownFrame();
  const [shift, setShift] = useState(false);
  useEffect(() => {
    const k = (e: KeyboardEvent) => setShift(e.shiftKey);
    window.addEventListener('keydown', k);
    window.addEventListener('keyup', k);
    return () => {
      window.removeEventListener('keydown', k);
      window.removeEventListener('keyup', k);
    };
  }, []);
  // a closed window can't send pointerleave
  useEffect(() => () => hideTip(), []);
  if (!item || o !== owner || !profile) return null;
  const slot = slotFor(frame, item.def);
  const equippedId = slot && slot !== 'charm' ? profile.loadouts[frame]?.[slot] : undefined;
  const equipped =
    equippedId && equippedId !== item.id
      ? profile.items.find((i) => i.id === equippedId)
      : undefined;
  return (
    <>
      <ItemTooltip item={item} at={at} frame={frame} profile={profile} />
      {shift && equipped && (
        <ItemTooltip
          item={equipped}
          at={[at[0] - 300, at[1]]}
          frame={frame}
          profile={profile}
          bare
        />
      )}
    </>
  );
}

// ---------- content ----------

const SLOT_LABEL: Record<string, string> = {
  primary: 'Primary',
  secondary: 'Secondary',
  engine: 'Engine',
  armor: 'Armor',
  radar: 'Radar',
  cosmetic: 'Cosmetic',
  charm: 'Charm',
};
const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);

function modText(m: ModDef, tier: number): string {
  const v = modValue(m, tier);
  const s = m.stat;
  const num =
    s === 'defenceAdd' || s === 'deflectAdd' || s === 'accuracyAdd'
      ? `${Math.round(v * 100)}%`
      : s === 'validAngleAdd'
        ? `${+v.toFixed(1)}°`
        : `${+v.toFixed(1)}`;
  return m.label.replace('{v}', num).replace('+-', '−').replace('%%', '%');
}

/** One Mod line text, `null` when the id is unknown. */
export const modLabel = (id: string, tier: number): string | null =>
  MODS[id] ? modText(MODS[id]!, tier) : null;

function Deltas({
  item,
  frame,
  profile,
  bare,
}: {
  item: ItemInstance;
  frame: FrameId;
  profile: PilotProfile;
  bare?: boolean;
}) {
  const cmp = bare ? null : compare(item, frame, gearOf(profile, frame));
  const rows = itemLines(item);
  if (!rows.length) return null;
  const showVs = !!cmp && cmp.verdict !== 'Equipped';
  const delta = new Map(cmp?.rows.map((r) => [r.line.key, r.delta]));
  return (
    <>
      <div className="rt-rows">
        {showVs && (
          <div className="rt-row head">
            <span />
            <span>This</span>
            <span>vs {cmp.vs.stock ? 'stock' : `equipped`}</span>
          </div>
        )}
        {rows.map((l) => {
          const d = showVs ? delta.get(l.key) : null;
          const good = d != null && Math.abs(d) >= 0.05 && (l.low ? d < 0 : d > 0);
          const flat = d == null || Math.abs(d) < 0.5 * 10 ** -l.dec;
          return (
            <div className="rt-row" key={l.key}>
              <span>{l.label}</span>
              <b>{withUnit(l)}</b>
              {showVs &&
                (flat ? (
                  <span className="rt-d eq">{d == null ? '' : '='}</span>
                ) : (
                  <span className={`rt-d ${good ? 'up' : 'dn'}`}>
                    {d! > 0 ? '+' : '−'}
                    {fmt(Math.abs(d!), l.dec)}
                  </span>
                ))}
            </div>
          );
        })}
      </div>
      {showVs && (
        <div className="rt-verdict">
          <span className={`v-${cmp.verdict.toLowerCase()}`}>{cmp.verdict}</span>
          <em>
            vs {cmp.vs.name}
            {cmp.vs.upgrade > 0 && ` +${cmp.vs.upgrade}`}
            {cmp.vs.stock && ' (stock)'}
          </em>
        </div>
      )}
    </>
  );
}

/** Item tooltip (rpg-ui.md §5 order). Fixed plate near `at`, kept on screen. `bare` = no comparison (Shift view). */
export function ItemTooltip({
  item,
  at,
  frame: frameProp,
  profile: profileProp,
  bare,
}: {
  item: ItemInstance;
  at: [number, number];
  frame?: FrameId;
  profile?: PilotProfile | null;
  bare?: boolean;
}) {
  const shown = useShownFrame();
  const live = useRpgProfile();
  const frame = frameProp ?? shown;
  const profile = profileProp ?? live;
  const def = ITEMS[item.def];
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<[number, number]>([at[0] + 18, at[1] + 18]);
  useLayoutEffect(() => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    let x = at[0] + 18;
    let y = at[1] + 18;
    if (x + r.width > window.innerWidth - 8) x = at[0] - r.width - 18;
    if (y + r.height > window.innerHeight - 8) y = window.innerHeight - r.height - 8;
    setPos([Math.max(8, x), Math.max(8, y)]);
  }, [at, item]);
  if (!def) return null;

  const rarity = item.rarity ?? 'standard';
  const slot = slotFor(frame, item.def);
  const w = WEAPONS[item.def];
  const fd = FRAMES[frame];
  const level = profile?.level ?? 1;
  let fit = '';
  let bad = false;
  if (def.frame && def.frame !== frame) {
    fit = `Fits the ${FRAMES[def.frame].name}, not the ${fd.name}`;
    bad = true;
  } else if (w && !slot) {
    fit = `Fits ${w.kind} slots only`;
    bad = true;
  } else if (w) fit = `Fits ${w.kind} ${SLOT_LABEL[slot!]} slots`;
  else if (def.frame) fit = `Fits the ${FRAMES[def.frame].name}`;
  else if (def.kind === 'charm') fit = 'Pilot-wide · any Frame';
  else if (def.kind === 'cosmetic') fit = 'Visual only · any Frame';
  const lvl = def.levelReq > level;
  const kindLine = [
    w ? (slot ? SLOT_LABEL[slot] : cap(w.kind)) : slot ? SLOT_LABEL[slot] : cap(def.kind),
    w && cap(w.kind),
    `Tier ${def.tier}`,
  ].filter(Boolean);
  const mods = item.mods ?? [];
  const price = sellPrice(item);
  const charm = charmLines(item.def);

  // Portal: a transformed window would make `position: fixed` relative to itself.
  return createPortal(
    <div
      ref={ref}
      className={`rpg-tooltip rpg-ui rt-frame-${rarity}`}
      style={{ left: pos[0], top: pos[1] }}
      role="tooltip"
    >
      <div className="rt-head">
        <div className={`rt-icon r-${rarity}`}>
          <ItemIcon def={item.def} tier={def.tier} />
        </div>
        <div>
          <b className={`rt-name rt-${rarity}`}>
            {def.name}
            {item.upgrade > 0 && <span className="rt-up"> +{item.upgrade}</span>}
          </b>
          <div className="rt-kind">{kindLine.join(' · ')}</div>
          {rarity !== 'standard' && (
            <div className={`rt-rarity rt-${rarity}`}>
              {cap(rarity)}
              {mods.length > 0 && ` · ${mods.length} Mod${mods.length > 1 ? 's' : ''}`}
            </div>
          )}
        </div>
      </div>
      {(fit || lvl) && (
        <div className={`rt-fit ${bad || lvl ? 'bad' : ''}`}>
          {lvl && `Requires Level ${def.levelReq}. `}
          {fit}
        </div>
      )}

      {profile && <Deltas item={item} frame={frame} profile={profile} bare={bare} />}

      {item.kind === 'consumable' && <p className="rt-text">{consumableText(item.def)}</p>}
      {item.kind === 'charm' && (
        <div className="rt-charm">
          {charm.map((c) => (
            <div key={c} className="rt-good">
              {c}
            </div>
          ))}
          <div className="rt-time">
            {item.msLeft != null
              ? `${timeLeft(item.msLeft)} left`
              : `${ITEMS[item.def]!.name.match(/\((\d+ h)\)/)?.[1] ?? ''} once equipped, counts down while you're logged in`}
          </div>
        </div>
      )}

      {mods.length > 0 && (
        <ul className="rt-mods">
          {mods.map((m, i) =>
            typeof m === 'string' ? (
              <li key={i} className={`rt-${rarity}`}>
                <i>◆</i> {modLabel(m, def.tier) ?? m}
              </li>
            ) : (
              <li key={i} className="unchosen">
                <i>◇</i> Unchosen Mod <em>Choose 1 of 3</em>
              </li>
            ),
          )}
        </ul>
      )}
      {def.flavor && <p className="rt-flavor">“{def.flavor}”</p>}
      <div className="rt-foot">
        <span>
          {price > 0 ? (
            <>
              Sells for <b className="coin">{fmt(price)}</b>
            </>
          ) : (
            'Cannot be sold'
          )}
        </span>
        <span className="rt-hint">
          {item.mods?.some((m) => typeof m !== 'string') ? 'Click: choose Mod · ' : ''}Right-click:
          equip
        </span>
      </div>
    </div>,
    document.body,
  );
}
