import { Window } from './Window';

/** Vendor window (V, Cities): Buy · Sell · Workshop. Placeholder until session C. */
export function Vendor() {
  return (
    <Window id="vendor" title="Vendor" keyHint="V" width={520} defaultPos={[120, 60]}>
      <div className="rpg-content">
        <div className="rpg-empty">Vendor</div>
      </div>
    </Window>
  );
}
