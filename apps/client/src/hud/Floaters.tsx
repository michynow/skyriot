import { useEffect, useRef } from 'react';
import type { Vec3 } from '@skyriot/shared';
import { projectPinned } from './view';

type Kind = 'shield' | 'hp' | 'defl' | 'struct' | 'absorb';
interface Floater {
  pos: Vec3;
  text: string;
  kind: Kind;
  born: number;
  /** Victim key: rapid hits on the same victim merge into one growing number. */
  key: string;
  sum: number;
  /** Screen jitter so stacked numbers don't overlap. */
  jx: number;
}
const POOL = 24;
const LIFE_MS = 1200;
/** Hits on the same victim within this window add up in one number. */
const MERGE_MS = 350;
/** Hits worth at least this much (missiles, bombs) get the big size. */
const BIG_DAMAGE = 200;
/** Numbers for off-screen victims: inset from the edge (px) and shrunk. */
const PIN_MARGIN = 120;
const PIN_SCALE = 0.55;
const live: Floater[] = [];
const p = { x: 0, y: 0 };

/** Floating damage number at a world position (hits the own Ship deals). Pass `damage` to merge rapid hits. */
export function pushFloater(pos: Vec3, text: string, kind: Kind, key = '', damage = 0): void {
  const now = performance.now();
  let last: Floater | undefined;
  for (let i = live.length - 1; i >= 0 && key; i--)
    if (live[i]!.key === key && live[i]!.kind === kind) {
      last = live[i];
      break;
    }
  if (last && damage > 0 && now - last.born < MERGE_MS) {
    last.sum += damage;
    last.text = String(Math.round(last.sum));
    last.pos = [...pos];
    last.born = now;
    return;
  }
  live.push({
    pos: [...pos],
    text,
    kind,
    born: now,
    key,
    sum: damage,
    jx: (Math.random() - 0.5) * 40,
  });
  if (live.length > POOL) live.shift();
}

export function Floaters() {
  const els = useRef<(HTMLDivElement | null)[]>([]);
  useEffect(() => {
    let raf = 0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      while (live.length && now - live[0]!.born > LIFE_MS) live.shift();
      for (let i = 0; i < POOL; i++) {
        const el = els.current[i];
        const f = live[i];
        if (!el) continue;
        // Off-screen victims: the number sticks to the screen edge in their direction, smaller.
        const at = f ? projectPinned(f.pos[0], f.pos[1], f.pos[2], p, PIN_MARGIN) : 0;
        if (!f || !at) {
          el.style.display = 'none';
          continue;
        }
        const age = (now - f.born) / LIFE_MS;
        el.style.display = 'block';
        if (el.textContent !== f.text) el.textContent = f.text;
        el.className = `fl ${f.kind}${f.sum >= BIG_DAMAGE ? ' big' : ''}`;
        el.style.opacity = String(1 - age * age);
        // Pop in large, settle, then float up.
        const pop = 1 + Math.max(0, 1 - age / 0.12) * 0.8;
        // Bigger hits (and merged streaks) read bigger.
        const size = 0.7 + Math.min(1, f.sum / BIG_DAMAGE) * 0.6;
        el.style.transform = `translate(${p.x + f.jx}px,${p.y - age * 90}px) scale(${pop * (f.kind === 'defl' || f.kind === 'absorb' ? 1 : size) * (at === 2 ? PIN_SCALE : 1)})${at === 2 ? ' translate(-50%,-50%)' : ''}`;
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div className="hud-layer">
      {Array.from({ length: POOL }, (_, i) => (
        <div key={i} ref={(el) => void (els.current[i] = el)} style={{ display: 'none' }} />
      ))}
    </div>
  );
}
