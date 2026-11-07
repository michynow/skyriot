import type { Wallet as W } from '@skyriot/shared';
import { UiGlyph } from '../../hud/icons';
import { fmt } from './statSheet';

/** Credits · Scrap · Glory with their coin glyphs (windows footers). */
export function Wallet({ wallet }: { wallet: W }) {
  return (
    <div className="rpg-wallet">
      {(['credits', 'scrap', 'glory'] as const).map((k) => (
        <span key={k} title={k[0]!.toUpperCase() + k.slice(1)}>
          <UiGlyph name={k} />
          <b>{fmt(wallet[k])}</b>
        </span>
      ))}
    </div>
  );
}
