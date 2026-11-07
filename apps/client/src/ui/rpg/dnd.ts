import { useState } from 'react';
import { create } from 'zustand';
import type { ItemId, SkillId } from '@skyriot/shared';

/** What is being dragged. Frozen contract (rpg-ui.md §8): windows, Hotbar and Skill book all speak it. */
export type DragPayload =
  | { kind: 'item'; item: ItemId }
  | { kind: 'skill'; skill: SkillId }
  | { kind: 'hotbar'; slot: number };

const useDragStore = create<{ payload: DragPayload | null }>(() => ({ payload: null }));

let dropped = false;
let onMissed: (() => void) | undefined;

function endDrag() {
  const missed = !dropped && onMissed;
  useDragStore.setState({ payload: null });
  document.body.classList.remove('rpg-dragging');
  onMissed = undefined;
  if (missed) missed();
}

/**
 * Begin a drag (call from the source's pointerdown, or after a small move). The drag ends on the next pointerup:
 * a drop target under the pointer that accepts the payload gets it; otherwise `onMiss` runs (e.g. a hotbar slot
 * dragged off the bar clears itself).
 */
export function startDrag(payload: DragPayload, onMiss?: () => void): void {
  if (useDragStore.getState().payload) endDrag();
  dropped = false;
  onMissed = onMiss;
  useDragStore.setState({ payload });
  document.body.classList.add('rpg-dragging');
  // Window bubble phase: runs after React's handlers (root container), so a target's onPointerUp marks `dropped` first.
  window.addEventListener('pointerup', endDrag, { once: true });
}

/** The payload being dragged right now, or null (re-renders on change). */
export const useDragging = (): DragPayload | null => useDragStore((s) => s.payload);

/**
 * Make an element a drop target: spread `props` on it. `accepts` = a drag is on that this target takes
 * (highlight it), `over` = that drag is hovering it.
 */
export function useDropTarget(
  accept: (p: DragPayload) => boolean,
  onDrop: (p: DragPayload) => void,
): {
  accepts: boolean;
  over: boolean;
  props: { onPointerEnter(): void; onPointerLeave(): void; onPointerUp(): void };
} {
  const payload = useDragging();
  const [hover, setHover] = useState(false);
  const accepts = !!payload && accept(payload);
  return {
    accepts,
    over: accepts && hover,
    props: {
      onPointerEnter: () => setHover(true),
      onPointerLeave: () => setHover(false),
      onPointerUp: () => {
        setHover(false);
        const p = useDragStore.getState().payload;
        if (!p || dropped || !accept(p)) return;
        dropped = true;
        onDrop(p);
      },
    },
  };
}
