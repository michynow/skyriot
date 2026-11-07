import { Window } from './Window';

/** Inventory window (I): the 8 × 6 Bag. Placeholder until session C. */
export function Inventory() {
  return (
    <Window
      id="inventory"
      title="Inventory"
      keyHint="I"
      width={468}
      defaultPos={[Math.max(28, window.innerWidth - 500), 28]}
    >
      <div className="rpg-content">
        <div className="rpg-empty">Inventory</div>
      </div>
    </Window>
  );
}
