import { useEffect, useRef } from 'react';
import { FRAMES, WEAPONS, type ShipState } from '@skyriot/shared';
import { world } from '../state/world';
import { inputState } from '../input/input';
import { project } from './view';

const MARKERS = 40;
const NOSE_DISTANCE = 500;
export const NATION_COLOR = { concord: '#f2c24b', vex: '#ff5a3c' } as const;
const p = { x: 0, y: 0 };

function place(el: HTMLElement | null, x: number, y: number, show: boolean) {
  if (!el) return;
  el.style.display = show ? 'block' : 'none';
  if (show) el.style.transform = `translate(${x}px,${y}px)`;
}

/** First-order intercept: smallest t > 0 with |r + v t| = s t. */
function leadTime(r: number[], v: number[], s: number): number {
  const a = v[0]! ** 2 + v[1]! ** 2 + v[2]! ** 2 - s * s;
  const b = 2 * (r[0]! * v[0]! + r[1]! * v[1]! + r[2]! * v[2]!);
  const c = r[0]! ** 2 + r[1]! ** 2 + r[2]! ** 2;
  if (Math.abs(a) < 1e-6) return b < 0 ? -c / b : 0;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return 0;
  const sq = Math.sqrt(disc);
  const t1 = (-b - sq) / (2 * a);
  const t2 = (-b + sq) / (2 * a);
  const t = Math.min(t1 > 0 ? t1 : Infinity, t2 > 0 ? t2 : Infinity);
  return Number.isFinite(t) ? Math.min(t, 3) : 0;
}

/** Per-frame HUD layer: cursor, nose reticle, lead marker, target bracket, ship markers. DOM refs only. */
export function Reticles() {
  const root = useRef<HTMLDivElement>(null);
  const cursorEl = useRef<HTMLDivElement>(null);
  const noseEl = useRef<HTMLDivElement>(null);
  const leadEl = useRef<HTMLDivElement>(null);
  const targetEl = useRef<HTMLDivElement>(null);
  const lockBar = useRef<HTMLDivElement>(null);
  const markerEls = useRef<(HTMLDivElement | null)[]>([]);
  const labelEls = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let lockProgress = 0;
    let lockFor: string | null = null;
    const labelCache: string[] = [];

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const W = window.innerWidth;
      const H = window.innerHeight;
      const own = world.ownId ? world.ships.get(world.ownId) : undefined;
      place(cursorEl.current, (world.cursor.x * 0.5 + 0.5) * W, (-world.cursor.y * 0.5 + 0.5) * H, true);
      if (!own || !own.alive) {
        place(noseEl.current, 0, 0, false);
        place(leadEl.current, 0, 0, false);
        place(targetEl.current, 0, 0, false);
        markerEls.current.forEach((m) => place(m, 0, 0, false));
        return;
      }
      const [qx, qy, qz, qw] = own.rot;
      const fx = -2 * (qx * qz + qw * qy);
      const fy = -2 * (qy * qz - qw * qx);
      const fz = -(1 - 2 * (qx * qx + qy * qy));
      const ok = project(
        own.pos[0] + fx * NOSE_DISTANCE,
        own.pos[1] + fy * NOSE_DISTANCE,
        own.pos[2] + fz * NOSE_DISTANCE,
        p,
      );
      place(noseEl.current, p.x, p.y, ok);

      // Ship markers: nearest N others.
      const others: { s: ShipState; d: number }[] = [];
      for (const s of world.ships.values()) {
        if (s.id === own.id || !s.alive) continue;
        others.push({ s, d: Math.hypot(s.pos[0] - own.pos[0], s.pos[1] - own.pos[1], s.pos[2] - own.pos[2]) });
      }
      others.sort((a, b) => a.d - b.d);
      for (let i = 0; i < MARKERS; i++) {
        const el = markerEls.current[i] ?? null;
        const o = others[i];
        if (!o || !el) {
          place(el, 0, 0, false);
          continue;
        }
        const on = project(o.s.pos[0], o.s.pos[1], o.s.pos[2], p);
        place(el, p.x, p.y, on);
        if (!on) continue;
        const enemy = o.s.nation !== own.nation;
        const color = NATION_COLOR[o.s.nation];
        el.style.setProperty('--c', color);
        el.dataset.enemy = enemy ? '1' : '0';
        el.dataset.target = o.s.id === inputState.targetId ? '1' : '0';
        const label = `${o.s.name} ${Math.round(o.d / 10) * 10}m`;
        if (labelCache[i] !== label) {
          labelCache[i] = label;
          const span = labelEls.current[i];
          if (span) span.textContent = label;
        }
      }

      // Target: lead indicator + lock progress.
      let target = inputState.targetId ? world.ships.get(inputState.targetId) : undefined;
      if (target && (!target.alive || target.nation === own.nation)) {
        inputState.targetId = null;
        target = undefined;
      }
      if (!target) {
        place(leadEl.current, 0, 0, false);
        place(targetEl.current, 0, 0, false);
        lockProgress = 0;
        return;
      }
      const def = FRAMES[own.frame];
      const primary = WEAPONS[def.primary];
      const secondary = WEAPONS[def.secondary];
      const rel = [target.pos[0] - own.pos[0], target.pos[1] - own.pos[1], target.pos[2] - own.pos[2]];
      const t = primary ? leadTime(rel, target.vel, primary.speed) : 0;
      const onLead = project(
        target.pos[0] + target.vel[0] * t,
        target.pos[1] + target.vel[1] * t,
        target.pos[2] + target.vel[2] * t,
        p,
      );
      place(leadEl.current, p.x, p.y, onLead);
      const onTarget = project(target.pos[0], target.pos[1], target.pos[2], p);
      place(targetEl.current, p.x, p.y, onTarget);

      // Lock progress is a client estimate: time spent with the target inside the missile cone.
      if (lockFor !== target.id) {
        lockFor = target.id;
        lockProgress = 0;
      }
      if (secondary && secondary.kind === 'missile' && secondary.lockTimeSec > 0) {
        const len = Math.hypot(rel[0]!, rel[1]!, rel[2]!) || 1;
        const cos = (rel[0]! * fx + rel[1]! * fy + rel[2]! * fz) / len;
        const inCone = Math.acos(Math.min(1, Math.max(-1, cos))) < secondary.lockConeRad;
        lockProgress = Math.min(1, Math.max(0, lockProgress + (inCone ? dt : -dt * 2) / secondary.lockTimeSec));
        if (own.lockTarget === target.id) lockProgress = 1;
      } else lockProgress = 0;
      if (lockBar.current) lockBar.current.style.width = `${lockProgress * 100}%`;
      if (targetEl.current) targetEl.current.dataset.locked = lockProgress >= 1 ? '1' : '0';
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div ref={root} className="hud-layer">
      {Array.from({ length: MARKERS }, (_, i) => (
        <div key={i} className="mk" ref={(el) => void (markerEls.current[i] = el)} style={{ display: 'none' }}>
          <div className="mk-box" />
          <span className="mk-label" ref={(el) => void (labelEls.current[i] = el)} />
        </div>
      ))}
      <div className="target-br" ref={targetEl} style={{ display: 'none' }}>
        <div className="tb" />
        <div className="lockbar">
          <div ref={lockBar} />
        </div>
      </div>
      <div className="lead" ref={leadEl} style={{ display: 'none' }} />
      <div className="nose" ref={noseEl} style={{ display: 'none' }} />
      <div className="cursor" ref={cursorEl} />
    </div>
  );
}
