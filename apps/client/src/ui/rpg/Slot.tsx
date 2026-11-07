import type { HTMLAttributes, ReactNode } from 'react';
import type { Rarity } from '@skyriot/shared';

export interface SlotProps extends HTMLAttributes<HTMLDivElement> {
  /** The icon; absent = empty cell showing `ghost`. */
  children?: ReactNode;
  /** Rarity frame colour (filled cells); absent = Standard. */
  rarity?: Rarity;
  /** `+N` badge top-right (hidden at 0). */
  upgrade?: number;
  /** Stack count bottom-right (shown whenever given, 0 included). */
  count?: number;
  /** Empty-slot silhouette (SlotGhost). */
  ghost?: ReactNode;
  /** Greyed icon (e.g. an empty Consumable stack). */
  off?: boolean;
  /** Highlight as a drop target under the pointer. */
  drop?: boolean;
}

/** One inset 52 px cell (bag, paper-doll, vendor): rarity frame, `+N`, count, empty ghost. */
export function Slot({
  children,
  rarity,
  upgrade,
  count,
  ghost,
  off,
  drop,
  className = '',
  ...rest
}: SlotProps) {
  const filled = children != null && children !== false;
  const cls = [
    'rpg-cell',
    filled ? `r-${rarity ?? 'standard'}` : 'empty',
    off && 'off',
    drop && 'drop',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <div className={cls} {...rest}>
      {filled ? children : ghost}
      {filled && !!upgrade && <span className="rpg-up">+{upgrade}</span>}
      {filled && count !== undefined && <span className="rpg-cnt">{count}</span>}
    </div>
  );
}
