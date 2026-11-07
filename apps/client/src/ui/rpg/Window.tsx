import { useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { closeWindow, focusWindow, useWindows, type WindowId } from './windows';

const POS_KEY = (id: WindowId) => `skyriot.window.${id}`;

function loadPos(id: WindowId, fallback: [number, number]): [number, number] {
  try {
    const p = JSON.parse(localStorage.getItem(POS_KEY(id)) ?? 'null') as unknown;
    if (Array.isArray(p) && p.length === 2 && p.every((n) => typeof n === 'number'))
      return p as [number, number];
  } catch {
    // storage blocked or corrupt: use the default
  }
  return fallback;
}

function savePos(id: WindowId, pos: [number, number]) {
  try {
    localStorage.setItem(POS_KEY(id), JSON.stringify(pos));
  } catch {
    // storage blocked: position is session-only
  }
}

/** Keep at least the title bar on screen. */
const clampPos = ([x, y]: [number, number], width: number): [number, number] => [
  Math.min(Math.max(x, 40 - width), window.innerWidth - 80),
  Math.min(Math.max(y, 0), window.innerHeight - 40),
];

export interface WindowProps {
  id: WindowId;
  title: ReactNode;
  /** Key shown in the title bar, e.g. "P". */
  keyHint?: string;
  /** Content width in px (the chrome adds 4). */
  width: number;
  /** Top-left on first open (then remembered per window in localStorage). */
  defaultPos: [number, number];
  children?: ReactNode;
  className?: string;
}

/** Shared RPG window chrome (rpg-ui.md §6): brass rim, chamfered corners, rivets, title bar, ×. Drag by the title. */
export function Window({
  id,
  title,
  keyHint,
  width,
  defaultPos,
  children,
  className = '',
}: WindowProps) {
  const z = useWindows((s) => s.stack.indexOf(id));
  const [pos, setPos] = useState(() => clampPos(loadPos(id, defaultPos), width));
  const drag = useRef<{ dx: number; dy: number } | null>(null);

  const onDown = (e: PointerEvent<HTMLElement>) => {
    if (e.button !== 0 || (e.target as Element).closest('button')) return;
    drag.current = { dx: e.clientX - pos[0], dy: e.clientY - pos[1] };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove = (e: PointerEvent<HTMLElement>) => {
    if (!drag.current) return;
    setPos(clampPos([e.clientX - drag.current.dx, e.clientY - drag.current.dy], width));
  };
  const onUp = () => {
    if (!drag.current) return;
    drag.current = null;
    savePos(id, pos);
  };

  return (
    <section
      className={`rpg-win ${className}`}
      data-ui
      role="dialog"
      aria-label={typeof title === 'string' ? title : id}
      style={{ left: pos[0], top: pos[1], width: width + 4, zIndex: z }}
      onPointerDown={() => focusWindow(id)}
    >
      <div className="rpg-frame">
        <div className="rpg-body">
          <header
            className="rpg-titlebar"
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
          >
            <h2>{title}</h2>
            <span className="rpg-rule" />
            {keyHint && <span className="rpg-keyhint">{keyHint}</span>}
            <button
              type="button"
              className="rpg-x"
              aria-label="Close"
              onClick={() => closeWindow(id)}
            >
              <svg viewBox="0 0 10 10" aria-hidden>
                <path d="M1 1 9 9M9 1 1 9" stroke="currentColor" strokeWidth="1.8" />
              </svg>
            </button>
          </header>
          {children}
          <i className="rpg-rivet tl" />
          <i className="rpg-rivet tr" />
          <i className="rpg-rivet bl" />
          <i className="rpg-rivet br" />
        </div>
      </div>
    </section>
  );
}
