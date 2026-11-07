import { Window } from './Window';

/** Character window (P): paper-doll, Frame tabs, Charms, stat sheet. Placeholder until session C. */
export function Character() {
  return (
    <Window id="character" title="Character" keyHint="P" width={716} defaultPos={[28, 28]}>
      <div className="rpg-content">
        <div className="rpg-empty">Character</div>
      </div>
    </Window>
  );
}
