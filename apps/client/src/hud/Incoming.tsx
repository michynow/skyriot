import { useEffect, useRef } from 'react';
import { incomingThreats } from './incomingMissiles';
import { project } from './view';

const ROLL_HINT_M = 90;
const MAX_ARROWS = 4;
const p = { x: 0, y: 0 };

/** Per-frame incoming-missile warning: nearest distance / time to impact, roll hint, red edge arrows (nearest 4). */
export function Incoming() {
  const box = useRef<HTMLDivElement>(null);
  const txt = useRef<HTMLDivElement>(null);
  const hint = useRef<HTMLDivElement>(null);
  const arrows = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    let raf = 0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const el = box.current;
      if (!el) return;
      const list = incomingThreats(now);
      const best = list[0];
      el.style.display = best ? 'block' : 'none';
      if (best) {
        const text = `MISSILE ×${list.length}  ${Math.round(best.d)} m · ${best.t.toFixed(1)} s`;
        if (txt.current && txt.current.textContent !== text) txt.current.textContent = text;
        if (hint.current) hint.current.style.display = best.d <= ROLL_HINT_M ? 'block' : 'none';
      }
      const W = window.innerWidth;
      const H = window.innerHeight;
      arrows.current.forEach((a, i) => {
        const m = list[i];
        if (!a) return;
        if (!m) {
          a.style.display = 'none';
          return;
        }
        // Arrow on the missile if on screen, else clamped to the screen edge.
        const ok = project(m.x, m.y, m.z, p);
        let dx = p.x - W / 2;
        let dy = p.y - H / 2;
        if (!ok) {
          dx = -dx;
          dy = -dy;
        }
        const edge = Math.min(
          (W / 2 - 60) / Math.abs(dx || 1e-6),
          (H / 2 - 60) / Math.abs(dy || 1e-6),
        );
        const k = ok && edge > 1 ? 1 : edge;
        a.style.display = 'block';
        a.style.transform = `translate(${W / 2 + dx * k}px,${H / 2 + dy * k}px) rotate(${(Math.atan2(dy, dx) * 180) / Math.PI + 90}deg)`;
      });
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <>
      <div className="incoming" ref={box} style={{ display: 'none' }}>
        <div ref={txt} />
        <div className="roll-hint" ref={hint}>
          ROLL! (A/D ×2)
        </div>
      </div>
      {Array.from({ length: MAX_ARROWS }, (_, i) => (
        <div
          key={i}
          className="inc-arrow"
          ref={(e) => {
            arrows.current[i] = e;
          }}
          style={{ display: 'none' }}
        />
      ))}
    </>
  );
}
