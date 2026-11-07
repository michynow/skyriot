import { create } from 'zustand';
import { inputState } from '../../input/input';
import { world } from '../../state/world';

/** Every RPG window. Order of `stack` = z-order (last = top). */
export type WindowId = 'character' | 'inventory' | 'skillbook' | 'vendor';

interface WindowsState {
  /** Open windows, bottom to top. */
  stack: WindowId[];
  /** Any window open (input frees the mouse and holds the stick while true). */
  anyOpen: boolean;
}

export const useWindows = create<WindowsState>(() => ({ stack: [], anyOpen: false }));

const setStack = (stack: WindowId[]) => useWindows.setState({ stack, anyOpen: stack.length > 0 });
const without = (id: WindowId) => useWindows.getState().stack.filter((w) => w !== id);

export const isWindowOpen = (id: WindowId): boolean => useWindows.getState().stack.includes(id);

/** Open (or raise) a window. Frees the mouse so the window can be used. */
export function openWindow(id: WindowId): void {
  setStack([...without(id), id]);
  if (document.pointerLockElement) document.exitPointerLock();
}

export function closeWindow(id: WindowId): void {
  if (isWindowOpen(id)) setStack(without(id));
}

export function toggleWindow(id: WindowId): void {
  if (isWindowOpen(id)) closeWindow(id);
  else openWindow(id);
}

/** Bring an open window to the top. */
export function focusWindow(id: WindowId): void {
  const { stack } = useWindows.getState();
  if (stack.includes(id) && stack[stack.length - 1] !== id) setStack([...without(id), id]);
}

/** Close the top window; false when none was open. */
export function closeTopWindow(): boolean {
  const { stack } = useWindows.getState();
  if (!stack.length) return false;
  setStack(stack.slice(0, -1));
  return true;
}

export function closeAllWindows(): void {
  setStack([]);
}

/** P Character (Pilot) · I Inventory · K Skill book · V Vendor (Cities only). */
export const WINDOW_KEYS: Record<string, WindowId> = {
  KeyP: 'character',
  KeyI: 'inventory',
  KeyK: 'skillbook',
  KeyV: 'vendor',
};

/** The Vendor only trades where the server allows it (Cities; any map in dev, like `canTrade`). */
export const vendorHere = (): boolean => !!world.map?.city || import.meta.env.DEV;

/**
 * Window hotkeys, and Esc closes the top window before anything else sees it (with none open, the Esc menu
 * opens as before). Capture phase on window, so it runs ahead of the Esc menu's listener. Returns detach.
 */
export function attachWindowKeys(): () => void {
  const onKey = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (e.code === 'Escape') {
      if (closeTopWindow()) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
      return;
    }
    const id = WINDOW_KEYS[e.code];
    // inputState.typing: chat or the Esc menu has the keyboard.
    if (!id || e.repeat || e.ctrlKey || e.metaKey || e.altKey || inputState.typing) return;
    if (id === 'vendor' && !vendorHere()) return;
    toggleWindow(id);
  };
  window.addEventListener('keydown', onKey, { capture: true });
  return () => {
    window.removeEventListener('keydown', onKey, { capture: true });
    closeAllWindows();
  };
}
