import { ITEMS, SKILLS } from '@skyriot/shared';
import { IconDefs, SkillIcon, UiGlyph, skillTag } from '../hud/icons';
import { ItemIcon, SlotGhost, type GhostSlot } from '../ui/rpg/itemIcons';

const GHOSTS: GhostSlot[] = [
  'primary',
  'secondary',
  'engine',
  'armor',
  'radar',
  'cosmetic',
  'charm0',
  'consumable',
  'generic',
];
const GLYPHS = ['credits', 'scrap', 'glory', 'lock', 'sort', 'close'] as const;
const plate = (px: number) => ({
  width: px,
  height: px,
  background: '#14161a',
  border: '1px solid #3a3f48',
  color: '#6b7380',
  display: 'inline-block',
});

/** DEV contact sheet: every item icon and ghost at 44 px (bag) and 28 px (HUD strip). Open /?dev=icons */
export default function IconSheet() {
  const ids = Object.keys(ITEMS);
  return (
    <div
      style={{
        background: '#0c0d10',
        color: '#ddd',
        font: '12px Barlow, sans-serif',
        padding: 16,
        minHeight: '100vh',
      }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, 132px)', gap: 8 }}>
        {ids.map((id) => (
          <div key={id} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <div style={plate(44)}>
              <ItemIcon def={id} />
            </div>
            <div style={plate(28)}>
              <ItemIcon def={id} />
            </div>
            <span style={{ fontSize: 10, lineHeight: 1.1, wordBreak: 'break-all' }}>{id}</span>
          </div>
        ))}
      </div>
      <h4>Skills</h4>
      <IconDefs />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, 150px)', gap: 8 }}>
        {Object.values(SKILLS).map((s) => (
          <div key={s.id} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <div style={{ width: 58, height: 58, position: 'relative', flex: 'none' }}>
              <SkillIcon id={s.id} />
            </div>
            <div style={{ width: 34, height: 34, position: 'relative', flex: 'none' }}>
              <SkillIcon id={s.id} />
            </div>
            <span style={{ fontSize: 10, lineHeight: 1.1 }}>
              {s.name}
              <br />
              <b>{skillTag(s.id)}</b>
            </span>
          </div>
        ))}
      </div>
      <h4>Ghosts / UI</h4>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {GHOSTS.map((g) => (
          <div key={g} style={plate(44)}>
            <SlotGhost slot={g} />
          </div>
        ))}
        {GHOSTS.map((g) => (
          <div key={`s${g}`} style={plate(28)}>
            <SlotGhost slot={g} />
          </div>
        ))}
        {GLYPHS.map((g) => (
          <div key={g} style={{ width: 44, height: 44 }}>
            <UiGlyph name={g} />
          </div>
        ))}
      </div>
    </div>
  );
}
