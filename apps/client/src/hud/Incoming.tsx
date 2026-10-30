import { useEffect, useRef } from 'react';
import { world } from '../state/world';
import { incoming } from './hudStore';
import { project } from './view';

const ROLL_HINT_M = 90;
const p = { x: 0, y: 0 };

/** Per-frame incoming-missile warning: distance, time to impact, edge/screen direction arrow, roll hint. */
export function Incoming() {
  const box = useRef<HTMLDivElement>(null);
  const txt = useRef<HTMLDivElement>(null);
  const hint = useRef<HTMLDivElement>(null);
  const arrow = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const own = world.ownId ? world.ships.get(world.ownId) : undefined;
      let best: { d: number; t: number; x: number; y: number; z: number } | null = null;
      if (own?.alive) {
        for (const [id, m] of incoming) {
          const age = (now - m.bornMs) / 1000;
          if (age > 12) {
            incoming.delete(id);
            continue;
          }
          const ox = m.origin[0] - own.pos[0];
          const oy = m.origin[1] - own.pos[1];
          const oz = m.origin[2] - own.pos[2];
          const total = Math.hypot(ox, oy, oz) || 1;
          const d = Math.max(0, total - m.speed * age);
          if (!best || d < best.d) {
            const k = d / total;
            best = { d, t: d / Math.max(1, m.speed), x: own.pos[0] + ox * k, y: own.pos[1] + oy * k, z: own.pos[2] + oz * k };
          }
        }
      }
      // Server-computed distance / time-to-impact win over the client estimate.
      if (best && own && own.incomingDist >= 0) {
        best.d = own.incomingDist;
        best.t = own.incomingTti;
      } else if (own?.alive && own.incomingDist >= 0 && !best) {
        best = { d: own.incomingDist, t: own.incomingTti, x: own.pos[0], y: own.pos[1], z: own.pos[2] };
      }
      const el = box.current;
      if (!el) return;
      if (!best || !own) {
        el.style.display = 'none';
        if (arrow.current) arrow.current.style.display = 'none';
        return;
      }
      el.style.display = 'block';
      const text = `MISSILE  ${Math.round(best.d)} m · ${best.t.toFixed(1)} s`;
      if (txt.current && txt.current.textContent !== text) txt.current.textContent = text;
      if (hint.current) hint.current.style.display = best.d <= ROLL_HINT_M ? 'block' : 'none';

      // Arrow toward the missile: on the missile if visible, else clamped to the screen edge.
      const W = window.innerWidth;
      const H = window.innerHeight;
      const ok = project(best.x, best.y, best.z, p);
      let dx = p.x - W / 2;
      let dy = p.y - H / 2;
      if (!ok) {
        dx = -dx;
        dy = -dy;
      }
      const edge = Math.min((W / 2 - 60) / Math.abs(dx || 1e-6), (H / 2 - 60) / Math.abs(dy || 1e-6));
      const ax = W / 2 + dx * (ok && edge > 1 ? 1 : edge);
      const ay = H / 2 + dy * (ok && edge > 1 ? 1 : edge);
      const a = arrow.current;
      if (a) {
        a.style.display = 'block';
        a.style.transform = `translate(${ax}px,${ay}px) rotate(${(Math.atan2(dy, dx) * 180) / Math.PI + 90}deg)`;
      }
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
      <div className="inc-arrow" ref={arrow} style={{ display: 'none' }} />
    </>
  );
}
