import { Window } from './Window';

/** Skill book window (K): the Frame's Skill Kit, drag to the Hotbar. Placeholder until session D. */
export function SkillBook() {
  return (
    <Window id="skillbook" title="Skill Book" keyHint="K" width={420} defaultPos={[28, 120]}>
      <div className="rpg-content">
        <div className="rpg-empty">Skill Book</div>
      </div>
    </Window>
  );
}
