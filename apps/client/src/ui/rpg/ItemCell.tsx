import { useRef, type HTMLAttributes } from 'react';
import { CHARMS, ITEMS, type ItemInstance } from '@skyriot/shared';
import { startDrag, useDropTarget, type DragPayload } from './dnd';
import { ItemIcon, SlotGhost, type GhostSlot } from './itemIcons';
import { Slot } from './Slot';
import { tipProps } from './Tooltip';

export interface ItemCellProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onDrop'> {
  item?: ItemInstance;
  ghost: GhostSlot;
  /** Window id that renders the tooltip layer. */
  owner: string;
  /** Item can be dragged out (the drag ends on the next pointerup; `onMiss` runs if no target took it). */
  draggable?: boolean;
  onMiss?: () => void;
  /** Drop target: what it accepts, and what to do with it. */
  accept?: (p: DragPayload) => boolean;
  onDrop?: (p: DragPayload) => void;
  dim?: boolean;
  selected?: boolean;
}

/** An item (or empty slot ghost) in a Slot: tooltip on hover, drag source and/or drop target. */
export function ItemCell({
  item,
  ghost,
  owner,
  draggable,
  onMiss,
  accept,
  onDrop,
  dim,
  selected,
  className = '',
  ...rest
}: ItemCellProps) {
  const drop = useDropTarget(accept ?? (() => false), onDrop ?? (() => undefined));
  const down = useRef<[number, number] | null>(null);
  const tip = tipProps(item, owner);
  const charm = item && CHARMS[item.def];
  const pct = charm && item.msLeft != null ? Math.max(0, Math.min(1, item.msLeft / (charm.hours * 3600e3))) : null;
  return (
    <Slot
      rarity={item?.rarity}
      upgrade={item?.upgrade}
      count={item?.kind === 'consumable' ? (item.count ?? 1) : undefined}
      ghost={<SlotGhost slot={ghost} />}
      drop={drop.over}
      className={`${className} ${dim ? 'dim' : ''} ${selected ? 'sel' : ''} ${drop.accepts ? 'accepts' : ''}`}
      role="button"
      tabIndex={item || onDrop ? 0 : -1}
      {...rest}
      onPointerEnter={(e) => {
        tip.onPointerEnter(e);
        drop.props.onPointerEnter();
      }}
      onPointerDown={(e) => {
        rest.onPointerDown?.(e);
        if (draggable && item && e.button === 0) down.current = [e.clientX, e.clientY];
      }}
      onPointerMove={(e) => {
        tip.onPointerMove(e);
        const d = down.current;
        if (!d || !item) return;
        if (Math.hypot(e.clientX - d[0], e.clientY - d[1]) > 5) {
          down.current = null;
          startDrag({ kind: 'item', item: item.id }, onMiss);
        }
      }}
      onPointerUp={(e) => {
        down.current = null;
        drop.props.onPointerUp();
        rest.onPointerUp?.(e);
      }}
      onPointerLeave={(e) => {
        drop.props.onPointerLeave();
        tip.onPointerLeave();
        rest.onPointerLeave?.(e);
      }}
    >
      {item && (
        <>
          <ItemIcon def={item.def} tier={itemTier(item)} />
          {pct != null && <i className="rpg-timer" style={{ width: `${pct * 100}%` }} />}
        </>
      )}
    </Slot>
  );
}

const itemTier = (i: ItemInstance) => ITEMS[i.def]?.tier ?? 1;
