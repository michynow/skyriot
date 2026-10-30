import { useEffect, useRef } from 'react';
import type { Vec3 } from '@skyriot/shared';
import { project } from './view';

type Kind = 'shield' | 'hp' | 'defl';
interface Floater {
  pos: Vec3;
  text: string;
  kind: Kind;
  born: number;
}
const POOL = 24;
const LIFE_MS = 900;
const live: Floater[] = [];
const p = { x: 0, y: 0 };

/** Floating damage number at a world position (hits the own Ship deals). */
export function pushFloater(pos: Vec3, text: string, kind: Kind): void {
  live.push({ pos: [...pos], text, kind, born: performance.now() });
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
        if (!f || !project(f.pos[0], f.pos[1], f.pos[2], p)) {
          el.style.display = 'none';
          continue;
        }
        const age = (now - f.born) / LIFE_MS;
        el.style.display = 'block';
        if (el.textContent !== f.text) el.textContent = f.text;
        el.className = `fl ${f.kind}`;
        el.style.opacity = String(1 - age * age);
        el.style.transform = `translate(${p.x}px,${p.y - age * 70}px)`;
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
