import { useRef } from 'react';
import {
  CHARM_SLOT_LEVELS,
  FRAMES,
  ITEMS,
  fitsSlot,
  gearOf,
  type EquipSlot,
  type FrameId,
  type GearSlot,
  type ItemInstance,
} from '@skyriot/shared';
import { NATION_NAME } from '../../hud/hudStore';
import { HangarCanvas, ShipStage } from '../FramePreview';
import type { DragPayload } from './dnd';
import { ItemCell } from './ItemCell';
import { ModPickerHost, openModPicker } from './ModPicker';
import {
  FRAME_TABS,
  equip,
  inCity,
  unlockedCharmSlots,
  useEditFrame,
  useRpgProfile,
  useShownFrame,
} from './rpgData';
import { TipLayer, hideTip } from './Tooltip';
import { charmLines, fmt, statSheet, timeLeft, withUnit } from './statSheet';
import { Wallet } from './Wallet';
import { Window } from './Window';
import './rpg.css';

const LEFT: [GearSlot, string][] = [
  ['armor', 'Armor'],
  ['engine', 'Engine'],
  ['radar', 'Radar'],
];
const RIGHT: [GearSlot, string][] = [
  ['primary', 'Primary · STD'],
  ['secondary', 'Secondary · ADV'],
  ['cosmetic', 'Cosmetic'],
];

/** Character window (P): paper-doll, Frame tabs, Charms, stat sheet. */
export function Character() {
  const profile = useRpgProfile();
  const frame = useShownFrame();
  const stage = useRef<HTMLDivElement>(null);
  if (!profile) {
    return (
      <Window id="character" title="Character" keyHint="P" width={716} defaultPos={[28, 28]}>
        <div className="rpg-content">
          <div className="rpg-empty">No Pilot profile yet</div>
        </div>
      </Window>
    );
  }
  const gear = gearOf(profile, frame);
  const groups = statSheet(frame, gear);
  const byId = (id: string | null | undefined) => profile.items.find((i) => i.id === id);
  const open = (item: ItemInstance) =>
    item.mods?.some((m) => typeof m !== 'string') && openModPicker(item.id, 'character');

  const slotCell = ([slot, label]: [GearSlot, string], side: 'l' | 'r') => {
    const item = gear[slot];
    const stock =
      slot === 'primary' || slot === 'secondary' || slot === 'engine'
        ? ITEMS[FRAMES[frame][slot]]?.name
        : undefined;
    return (
      <div className={`pd-slot ${side}`} key={slot}>
        <span className="cap">{label}</span>
        <ItemCell
          item={item}
          ghost={slot}
          owner="character"
          draggable
          onMiss={hideTip}
          accept={(p: DragPayload) => {
            const it = p.kind === 'item' ? byId(p.item) : undefined;
            return !!it && fitsSlot(frame, slot, it.def);
          }}
          onDrop={(p) => p.kind === 'item' && equip(frame, slot, p.item)}
          onClick={() => item && open(item)}
          onContextMenu={(e) => {
            e.preventDefault();
            if (item) equip(frame, slot, null);
          }}
          aria-label={label}
        />
        <span className={`nm ${item ? `rt-${item.rarity ?? 'standard'}` : 'stock'}`}>
          {item ? ITEMS[item.def]?.name : stock ? `${stock} (stock)` : 'Empty'}
        </span>
      </div>
    );
  };

  return (
    <Window id="character" title={profile.name} keyHint="P" width={716} defaultPos={[28, 28]}>
      <div className="chr">
        <div className="chr-sub">
          <span>{NATION_NAME[profile.nation]}</span>
          {!inCity() && <em>Gear swaps in a City or when Docked · Charms and Cosmetic anywhere</em>}
        </div>
        <div className="rpg-tabs" role="tablist">
          {FRAME_TABS.map((f: FrameId) => (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={f === frame}
              className={f === frame ? 'on' : ''}
              onClick={() => useEditFrame.setState({ frame: f })}
            >
              {FRAMES[f].name}
            </button>
          ))}
        </div>
        <div className="chr-main">
          <div className="chr-left">
            <div className="doll">
              <div className="col">{LEFT.map((s) => slotCell(s, 'l'))}</div>
              <div className="stage" ref={stage}>
                <div className="stage-clip">
                  <HangarCanvas>
                    <ShipStage frame={frame} nation={profile.nation} track={stage} />
                  </HangarCanvas>
                </div>
                <span className="stage-cap">{FRAMES[frame].role}</span>
              </div>
              <div className="col">{RIGHT.map((s) => slotCell(s, 'r'))}</div>
            </div>
            <h3 className="rpg-h">Charms</h3>
            <div className="charms">
              {[0, 1, 2].map((n) => {
                const unlocked = n < unlockedCharmSlots(profile.level);
                const item = byId(profile.charms[n]);
                const slot = `charm${n}` as EquipSlot;
                return (
                  <div className={`charm ${unlocked ? '' : 'locked'}`} key={n}>
                    <ItemCell
                      item={unlocked ? item : undefined}
                      ghost={slot}
                      owner="character"
                      draggable
                      onMiss={hideTip}
                      accept={(p) => {
                        const it = p.kind === 'item' ? byId(p.item) : undefined;
                        return unlocked && !!it && fitsSlot(frame, slot, it.def);
                      }}
                      onDrop={(p) => p.kind === 'item' && equip(frame, slot, p.item)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        if (item) equip(frame, slot, null);
                      }}
                      aria-label={`Charm ${n + 1}`}
                    />
                    <div className="txt">
                      {!unlocked ? (
                        <>
                          <b>Slot {'I'.repeat(n + 1)}</b>
                          <span>Opens at Level {CHARM_SLOT_LEVELS[n]}</span>
                        </>
                      ) : item ? (
                        <>
                          <b>{ITEMS[item.def]?.name.replace(/ \(.*/, '')}</b>
                          <span className="eff">{charmLines(item.def).join(' · ')}</span>
                          <span className="left">
                            {item.msLeft != null
                              ? `${timeLeft(item.msLeft)} left`
                              : 'Starts when equipped'}
                          </span>
                        </>
                      ) : (
                        <>
                          <b>Slot {'I'.repeat(n + 1)}</b>
                          <span>Drag a Charm here</span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <aside className="chr-stats">
            <div className="lvl">
              <span>
                Level <b>{profile.level}</b>
              </span>
              <span className="xp">{fmt(profile.xp)} XP</span>
            </div>
            {groups.map((g) => (
              <section key={g.title}>
                <h3 className="rpg-h">{g.title}</h3>
                {g.rows.map((r) => (
                  <div className="st-row" key={r.key}>
                    <span>{r.label}</span>
                    <b>{withUnit(r)}</b>
                  </div>
                ))}
              </section>
            ))}
          </aside>
        </div>
        <footer className="rpg-foot">
          <Wallet wallet={profile.wallet} />
        </footer>
        <TipLayer owner="character" />
        <ModPickerHost owner="character" />
      </div>
    </Window>
  );
}
