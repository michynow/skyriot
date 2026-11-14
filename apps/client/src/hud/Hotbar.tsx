import { useEffect, useRef, useState } from 'react';
import { FRAMES, HOTBAR_BARS, HOTBAR_BAR_SLOTS, SKILLS, type FrameId } from '@skyriot/shared';
import { useShallow } from 'zustand/react/shallow';
import { useProfile } from '../state/profile';
import { useSettings } from '../ui/settings';
import { startDrag, useDragging, useDropTarget, type DragPayload } from '../ui/rpg/dnd';
import { useWindows } from '../ui/rpg/windows';
import {
  clearSlot,
  consumableCount,
  inKit,
  placeSkill,
  swapSlots,
  useHud,
  useLayouts,
} from './hudStore';
import { SkillIcon } from './icons';

export const mmss = (sec: number) =>
  `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;

/** Key prefix per bar when all bars are shown: Shift fires bar 2, Alt bar 3. */
const BAR_PREFIX = ['', '⇧', '⌥'];

/** The Consumable Skill a Bag stack drags as, or null (not a Consumable, or not in this Frame's kit). */
const stackSkill = (frame: FrameId, item: string) => {
  const def = useProfile.getState().profile?.items.find((i) => i.id === item)?.def;
  return def && SKILLS[def]?.kind === 'consumable' && inKit(frame, def) ? def : null;
};

function HotSlot(props: {
  frame: FrameId;
  i: number;
  k: number;
  prefix: string;
  id: string | null;
  count: number | undefined;
  locked: boolean;
  frac: number;
  sec: number;
  on: boolean;
  /** Not enough SP to cast. */
  nosp: boolean;
  punch: number | null;
  onTip(t: { i: number; left: number } | null): void;
}) {
  const { frame, i, id, locked } = props;
  const skill = id ? SKILLS[id] : undefined;
  const drop = useDropTarget(
    (p) =>
      !locked &&
      (p.kind === 'hotbar' ||
        (p.kind === 'skill' && inKit(frame, p.skill)) ||
        (p.kind === 'item' && !!stackSkill(frame, p.item))),
    (p) => {
      if (p.kind === 'hotbar') {
        if (p.slot !== i) swapSlots(frame, p.slot, i);
      } else if (p.kind === 'skill') placeSkill(frame, i, p.skill);
      else {
        const sk = stackSkill(frame, p.item);
        if (sk) placeSkill(frame, i, sk);
      }
    },
  );
  const empty0 = props.count === 0;
  return (
    <div
      data-slot={i}
      className={`slot ${skill ? '' : 'empty'} ${skill?.kind ?? ''} ${props.frac > 0 ? 'cooling' : ''} ${props.on ? 'on' : ''} ${props.punch !== null ? 'punch' : ''} ${empty0 ? 'spent' : ''} ${props.nosp ? 'nosp' : ''} ${drop.over ? 'drop' : drop.accepts ? 'accepts' : ''}`}
      {...drop.props}
      onPointerDown={(e) => {
        if (e.button !== 0 || locked || !id) return;
        startDrag({ kind: 'hotbar', slot: i }, () => clearSlot(frame, i));
      }}
      onMouseEnter={(e) => {
        drop.props.onPointerEnter();
        if (skill && !document.pointerLockElement)
          props.onTip({
            i,
            left: e.currentTarget.offsetLeft + e.currentTarget.offsetWidth / 2,
          });
      }}
      onMouseLeave={() => props.onTip(null)}
    >
      {id && <SkillIcon id={id} />}
      <span className="slot-k">
        {props.prefix}
        {(props.k + 1) % 10}
      </span>
      {props.on && <span className="slot-on">ON</span>}
      <div className="slot-cd" style={{ ['--p' as string]: `${props.frac * 360}deg` }} />
      {props.sec > 0.05 && <span className="slot-t">{props.sec.toFixed(1)}</span>}
      {props.count !== undefined && skill && <span className="slot-n">{props.count}</span>}
    </div>
  );
}

/** The Hotbar: the Pilot's own layout (3 bars x 10 slots), drag to rearrange, padlock against accidents. */
export function Hotbar() {
  const { frame, bar, frac, sec, toggles, fx, sp } = useHud(
    useShallow((h) => ({
      frame: h.frame,
      bar: h.hotbarBar,
      frac: h.cooldownFrac,
      sec: h.cooldownSec,
      toggles: h.toggles,
      fx: h.skillFx,
      sp: h.sp,
    })),
  );
  const layout = useLayouts((s) => (frame ? s.layouts[frame] : undefined));
  const profile = useProfile((s) => s.profile);
  const showAll = useSettings((s) => s.showAllBars);
  const anyOpen = useWindows((s) => s.anyOpen);
  // Locked in flight, unlocked while a window is open; the padlock overrides until the windows change.
  const [pad, setPad] = useState<boolean | null>(null);
  useEffect(() => setPad(null), [anyOpen]);
  const [tip, setTip] = useState<{ i: number; left: number } | null>(null);
  const dragging = useDragging();
  if (!frame) return null;
  const all = layout ?? FRAMES[frame].hotbar;
  const locked = pad ?? !anyOpen;
  const tipSkill = tip && !dragging ? SKILLS[all[tip.i] ?? ''] : undefined;
  const bars = showAll ? Array.from({ length: HOTBAR_BARS }, (_, b) => HOTBAR_BARS - 1 - b) : [bar];
  return (
    <div className="hotbar" data-ui>
      {!showAll && (
        <div className="hotbar-tabs">
          {Array.from({ length: HOTBAR_BARS }, (_, b) => (
            <span key={b} className={b === bar ? 'on' : ''}>
              F{b + 1}
            </span>
          ))}
          <kbd>TAB</kbd>
        </div>
      )}
      <button
        type="button"
        className={`hotbar-lock ${locked ? 'on' : ''}`}
        title={locked ? 'Hotbar locked: click to rearrange' : 'Hotbar unlocked: click to lock'}
        onClick={() => setPad(!locked)}
      >
        <svg viewBox="0 0 12 14" aria-hidden>
          <path
            d={locked ? 'M3.5 6V4a2.5 2.5 0 015 0v2' : 'M3.5 6V4a2.5 2.5 0 014.8-1'}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <rect x="1.5" y="6" width="9" height="7" fill="currentColor" />
        </svg>
      </button>
      {bars.map((b) => (
        <div className="hotbar-row" key={b}>
          {all.slice(b * HOTBAR_BAR_SLOTS, (b + 1) * HOTBAR_BAR_SLOTS).map((id, k) => {
            const i = b * HOTBAR_BAR_SLOTS + k;
            const skill = id ? SKILLS[id] : undefined;
            const on =
              !!skill &&
              skill.kind === 'toggle' &&
              !!skill.toggleGroup &&
              toggles[skill.toggleGroup] === id;
            const punched = fx?.slot === i;
            return (
              <HotSlot
                key={`${i}-${punched ? fx!.nonce : 0}`}
                frame={frame}
                i={i}
                k={k}
                prefix={showAll ? BAR_PREFIX[b]! : ''}
                id={id}
                count={
                  skill?.kind === 'consumable' ? consumableCount(profile, skill.id) : undefined
                }
                locked={locked}
                frac={frac[i] ?? 0}
                sec={sec[i] ?? 0}
                on={on}
                nosp={!!skill && sp < skill.spCost}
                punch={punched ? fx!.nonce : null}
                onTip={setTip}
              />
            );
          })}
        </div>
      ))}
      {tip && tipSkill && (
        <div className="tooltip" style={{ left: tip.left }}>
          <b>{tipSkill.name}</b>
          <p>{tipSkill.description}</p>
          <small>
            {tipSkill.durationSec > 0 && `Duration ${mmss(tipSkill.durationSec)}  ·  `}Cooldown{' '}
            {mmss(tipSkill.cooldownSec)}
            {tipSkill.spCost > 0 && `  ·  ${tipSkill.spCost} SP`}
          </small>
        </div>
      )}
    </div>
  );
}

/** The dragged Skill's icon following the pointer (the dnd kit has no ghost of its own). */
export function DragGhost() {
  const p: DragPayload | null = useDragging();
  const frame = useHud((h) => h.frame);
  const layout = useLayouts((s) => (frame ? s.layouts[frame] : undefined));
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!p) return;
    const move = (e: PointerEvent) => {
      if (el.current)
        el.current.style.transform = `translate(${e.clientX + 8}px, ${e.clientY + 8}px)`;
    };
    window.addEventListener('pointermove', move);
    return () => window.removeEventListener('pointermove', move);
  }, [p]);
  if (!p || !frame) return null;
  const skill =
    p.kind === 'skill'
      ? p.skill
      : p.kind === 'hotbar'
        ? (layout ?? FRAMES[frame].hotbar)[p.slot]
        : stackSkill(frame, p.item);
  if (!skill) return null;
  return (
    <div ref={el} className="drag-ghost">
      <SkillIcon id={skill} />
    </div>
  );
}
