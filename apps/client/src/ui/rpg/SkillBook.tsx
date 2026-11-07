import { FRAMES, HOTBAR_BAR_SLOTS, SKILLS, type FrameId, type SkillDef } from '@skyriot/shared';
import { mmss } from '../../hud/Hotbar';
import { SkillIcon } from '../../hud/icons';
import { hotbarOf, inKit, placeFirstEmpty, useHud, useLayouts } from '../../hud/hudStore';
import { startDrag } from './dnd';
import { Window } from './Window';

/** Row accent by Skill kind (the category colour of the row's left edge). */
const KIND_COLOR: Record<SkillDef['kind'], string> = {
  skill: '#7fe7ff',
  buff: '#ffd27a',
  toggle: '#b98cff',
  consumable: '#8aff9a',
};

function groups(frame: FrameId) {
  const kit = Object.values(SKILLS).filter((s) => inKit(frame, s.id));
  return [
    {
      title: 'Frame Skills',
      list: kit.filter((s) => s.kind !== 'consumable' && s.frames !== 'all'),
    },
    {
      title: 'Shared Skills',
      list: kit.filter((s) => s.kind !== 'consumable' && s.frames === 'all'),
    },
    { title: 'Consumables', list: kit.filter((s) => s.kind === 'consumable') },
  ].filter((g) => g.list.length);
}

/** "On bar 1·3" marker text for a Skill on the layout, or ''. */
const where = (layout: (string | null)[], id: string) => {
  const i = layout.indexOf(id);
  return i < 0
    ? ''
    : `On bar ${Math.floor(i / HOTBAR_BAR_SLOTS) + 1}·${((i % HOTBAR_BAR_SLOTS) + 1) % 10}`;
};

/** Skill book window (K): the flown Frame's Skill Kit. Drag a row to the Hotbar, or right-click to take the first empty slot. */
export function SkillBook() {
  const flown = useHud((h) => h.frame);
  const frame: FrameId = flown ?? 'wasp';
  const layout = useLayouts((s) => s.layouts[frame]) ?? hotbarOf(frame);
  return (
    <Window
      id="skillbook"
      title={`Skill Book · ${FRAMES[frame].name}`}
      keyHint="K"
      width={420}
      defaultPos={[28, 120]}
    >
      <div className="rpg-content sb">
        {groups(frame).map((g) => (
          <section key={g.title}>
            <h3>{g.title}</h3>
            {g.list.map((s) => (
              <div
                key={s.id}
                className="sb-row"
                style={{ ['--kc' as string]: KIND_COLOR[s.kind] }}
                onPointerDown={(e) => e.button === 0 && startDrag({ kind: 'skill', skill: s.id })}
                onContextMenu={(e) => {
                  e.preventDefault();
                  placeFirstEmpty(frame, s.id);
                }}
              >
                <span className="sb-icon">
                  <SkillIcon id={s.id} />
                </span>
                <div className="sb-text">
                  <b>{s.name}</b>
                  <small>
                    {s.durationSec > 0 && `Duration ${mmss(s.durationSec)} · `}Cooldown{' '}
                    {mmss(s.cooldownSec)}
                  </small>
                  <p>{s.description}</p>
                </div>
                <em>{where(layout, s.id)}</em>
              </div>
            ))}
          </section>
        ))}
      </div>
    </Window>
  );
}
