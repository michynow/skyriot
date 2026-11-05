import { useEffect, useRef } from 'react';
import {
  AIM_ASSIST,
  FRAMES,
  SIEGE,
  SIEGE_AIR,
  WEAPONS,
  bombingSecondary,
  sampleHeight,
  type Heightfield,
  type ShipState,
  type WeaponDef,
} from '@skyriot/shared';
import { world } from '../state/world';
import { inputState } from '../input/input';
import { isFlying, isGrounded, ownShip, targetView } from './hudStore';
import { project } from './view';
import { TargetWindow } from './TargetWindow';

const MARKERS = 40;
/** Text labels (name + distance) at once; everything else is a bare marker. */
const MAX_ENEMY_LABELS = 5;
const MAX_ALLY_LABELS = 2;
const LABEL_ENEMY_M = 450;
const LABEL_ALLY_M = 180;
const LABEL_CONE_COS = Math.cos((9 * Math.PI) / 180);
const LADDER = 8;
const NOSE_DISTANCE = 500;
export const NATION_COLOR = { concord: '#f2c24b', vex: '#ff5a3c' } as const;
const ENEMY = '#ff4d4d';
const ALLY = '#ffffff';
const RING_LEN = 2 * Math.PI * 34;
const p = { x: 0, y: 0 };

function place(el: HTMLElement | null, x: number, y: number, show: boolean) {
  if (!el) return;
  el.style.display = show ? 'block' : 'none';
  if (show) el.style.transform = `translate(${x}px,${y}px)`;
}
function setText(el: HTMLElement | null, text: string) {
  if (el && el.textContent !== text) el.textContent = text;
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

/** Distance along a ray to the heightfield (coarse march + bisection), or null if none within maxD. */
function terrainHit(hf: Heightfield, o: number[], d: number[], maxD: number): number | null {
  const step = 25;
  let prev = 0;
  for (let t = step; t <= maxD; t += step) {
    if (o[1]! + d[1]! * t < sampleHeight(hf, o[0]! + d[0]! * t, o[2]! + d[2]! * t)) {
      let lo = prev;
      let hi = t;
      for (let i = 0; i < 6; i++) {
        const m = (lo + hi) / 2;
        if (o[1]! + d[1]! * m < sampleHeight(hf, o[0]! + d[0]! * m, o[2]! + d[2]! * m)) hi = m;
        else lo = m;
      }
      return hi;
    }
    prev = t;
  }
  return null;
}

const weapon = (id: string): WeaponDef | undefined => WEAPONS[id];

/** Per-frame HUD layer: cursor + range feedback, nose reticle, lead, single Target marker, name tags. */
export function Reticles() {
  const cursorEl = useRef<HTMLDivElement>(null);
  const crDist = useRef<HTMLSpanElement>(null);
  const crTag = useRef<HTMLSpanElement>(null);
  const crMax = useRef<HTMLSpanElement>(null);
  const noseEl = useRef<HTMLDivElement>(null);
  const aimEl = useRef<HTMLDivElement>(null);
  const leadEl = useRef<HTMLDivElement>(null);
  const targetEl = useRef<HTMLDivElement>(null);
  const targetLabel = useRef<HTMLSpanElement>(null);
  const targetState = useRef<HTMLSpanElement>(null);
  const candEl = useRef<HTMLDivElement>(null);
  const edgeEl = useRef<HTMLDivElement>(null);
  const edgeArrow = useRef<HTMLElement>(null);
  const edgeText = useRef<HTMLSpanElement>(null);
  const leadLink = useRef<HTMLDivElement>(null);
  const turnEl = useRef<HTMLDivElement>(null);
  const gunnerEl = useRef<HTMLDivElement>(null);
  const gunTag = useRef<HTMLDivElement>(null);
  const ringEl = useRef<SVGCircleElement>(null);
  const ladderEls = useRef<(HTMLDivElement | null)[]>([]);
  const markerEls = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    let raf = 0;
    let gunLockWas: string | null = null;
    let gunLostUntil = 0;
    const labelCache: string[] = [];
    const labelX: number[] = [];
    const labelY: number[] = [];

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const W = window.innerWidth;
      const H = window.innerHeight;
      const own = ownShip();
      // The crosshair is fixed at screen centre (the Ship's nose); the aim point moves freely and the Ship follows.
      const cx = W / 2;
      const cy = H / 2;
      const aimPt = aimEl.current;
      if (aimPt) {
        aimPt.style.display = own && isFlying(own) && !world.freeLook ? 'block' : 'none';
        aimPt.style.transform = `translate(${cx + (world.cursor.x * W) / 2}px,${cy - (world.cursor.y * H) / 2}px)`;
      }
      if (!own || !isFlying(own)) {
        place(cursorEl.current, cx, cy, false);
        place(noseEl.current, 0, 0, false);
        place(leadEl.current, 0, 0, false);
        place(leadLink.current, 0, 0, false);
        place(targetEl.current, 0, 0, false);
        place(candEl.current, 0, 0, false);
        place(edgeEl.current, 0, 0, false);
        place(gunnerEl.current, 0, 0, false);
        markerEls.current.forEach((m) => place(m, 0, 0, false));
        return;
      }
      const def = FRAMES[own.frame];
      const sieged = own.sieged;
      const siegeMul = sieged ? (isGrounded(own) ? SIEGE : SIEGE_AIR) : null;
      const rangeMul = siegeMul?.rangeMul ?? 1;
      const coneMul = sieged && !isGrounded(own) ? SIEGE_AIR.lockConeMul : 1;
      const primary = weapon(def.primary);
      const sec0 = weapon(def.secondary);
      const secondary = sec0 && bombingSecondary(sec0, own.toggles.bombing);
      const primRange = (primary?.rangeM ?? 0) * rangeMul;
      const secRange = (secondary?.rangeM ?? 0) * rangeMul;
      const radar = def.radarRangeM;

      const [qx, qy, qz, qw] = own.rot;
      const fx = -2 * (qx * qz + qw * qy);
      const fy = -2 * (qy * qz - qw * qx);
      const fz = -(1 - 2 * (qx * qx + qy * qy));

      // Visible others + their distances.
      const others: { s: ShipState; d: number }[] = [];
      for (const s of world.ships.values()) {
        if (s.id === own.id || !s.alive) continue;
        const d = Math.hypot(s.pos[0] - own.pos[0], s.pos[1] - own.pos[1], s.pos[2] - own.pos[2]);
        if (d <= radar) others.push({ s, d });
      }
      others.sort((a, b) => a.d - b.d);

      // Target (single; picked by hover/Shift in input.ts).
      const target = targetView(inputState.targetId);
      const rel = target
        ? [target.pos[0] - own.pos[0], target.pos[1] - own.pos[1], target.pos[2] - own.pos[2]]
        : null;
      const targetD = rel ? Math.hypot(rel[0]!, rel[1]!, rel[2]!) : Infinity;

      // What's under the aim: nearest enemy near the aim ray, else terrain hit.
      const aim: [number, number, number] = [fx, fy, fz]; // range cues use the nose/centre, not the cursor
      let underD: number | null = null;
      let underEnemy = false;
      for (const o of others) {
        if (o.s.nation === own.nation) continue;
        const rx = o.s.pos[0] - own.pos[0];
        const ry = o.s.pos[1] - own.pos[1];
        const rz = o.s.pos[2] - own.pos[2];
        const t = rx * aim[0] + ry * aim[1] + rz * aim[2];
        if (t <= 0) continue;
        const perp = Math.sqrt(Math.max(0, o.d * o.d - t * t));
        if (
          perp < Math.max(FRAMES[o.s.frame].radius * 2.5, t * Math.tan(AIM_ASSIST.coneRad)) &&
          (underD === null || t < underD)
        ) {
          underD = t;
          underEnemy = true;
        }
      }
      if (underD === null && world.heightfield)
        underD = terrainHit(world.heightfield, own.pos, aim, 3500);

      // Only when the aim actually covers something in range: an enemy inside the aim-assist cone, or terrain.
      const inRange = underD !== null && underD <= primRange;
      // Lock advice. The cone is measured from the Ship's nose, not the cursor.
      let secInRange = false;
      let lockRange = false;
      if (rel && secondary && secondary.lockTimeSec > 0 && targetD <= secRange) {
        secInRange = true;
        const cos = (rel[0]! * fx + rel[1]! * fy + rel[2]! * fz) / (targetD || 1);
        lockRange = Math.acos(Math.min(1, Math.max(-1, cos))) < secondary.lockConeRad * coneMul;
      }
      if (target && own.lockTarget === target.id) lockRange = lockRange || own.canLock;
      // Aim assist: Target inside the cone around the aim direction and in Primary range.
      let assist = false;
      if (rel && targetD <= primRange) {
        const cos = (rel[0]! * aim[0] + rel[1]! * aim[1] + rel[2]! * aim[2]) / (targetD || 1);
        assist = Math.acos(Math.min(1, Math.max(-1, cos))) < AIM_ASSIST.coneRad;
      }
      // ADV lock is server-validated: instant, no acquire time.
      const locked = !!target && own.lockTarget === target.id;

      const cur = cursorEl.current;
      place(cur, cx, cy, !sieged);
      if (cur) {
        cur.classList.toggle('inrange', inRange);
        cur.classList.toggle('lockrange', lockRange);
        cur.classList.toggle('assist', assist);
      }
      const distText = underD === null ? '' : `${Math.round(underD)} m`;
      setText(crDist.current, distText);
      setText(crTag.current, locked ? 'LOCKED — FIRE' : inRange ? 'IN RANGE' : '');
      setText(crMax.current, `R ${Math.round(primRange)}`);

      // Nose reticle (where the guns point).
      const noseOk = project(
        own.pos[0] + fx * NOSE_DISTANCE,
        own.pos[1] + fy * NOSE_DISTANCE,
        own.pos[2] + fz * NOSE_DISTANCE,
        p,
      );
      place(noseEl.current, p.x, p.y, false && noseOk);

      // Ship markers, decluttered: text (name + distance) only for the few that matter — enemies close by or near
      // the aim, allies very close — capped and never overlapping; the rest are bare dots fading with distance.
      let enemyLabels = 0;
      let allyLabels = 0;
      let placed = 0;
      for (let i = 0; i < MARKERS; i++) {
        const el = markerEls.current[i] ?? null;
        const o = others[i];
        if (!o || !el || o.s.id === target?.id) {
          place(el, 0, 0, false);
          continue;
        }
        const on = project(o.s.pos[0], o.s.pos[1] + 6, o.s.pos[2], p);
        place(el, p.x, p.y, on);
        if (!on) continue;
        const enemy = o.s.nation !== own.nation;
        const cos =
          ((o.s.pos[0] - own.pos[0]) * aim[0] +
            (o.s.pos[1] - own.pos[1]) * aim[1] +
            (o.s.pos[2] - own.pos[2]) * aim[2]) /
          (o.d || 1);
        let text = enemy
          ? (o.d < LABEL_ENEMY_M || cos > LABEL_CONE_COS) && enemyLabels < MAX_ENEMY_LABELS
          : o.d < LABEL_ALLY_M && allyLabels < MAX_ALLY_LABELS;
        if (text) {
          for (let j = 0; j < placed; j++) {
            if (Math.abs(labelX[j]! - p.x) < 110 && Math.abs(labelY[j]! - p.y) < 22) {
              text = false;
              break;
            }
          }
        }
        if (text) {
          labelX[placed] = p.x;
          labelY[placed] = p.y;
          placed++;
          if (enemy) enemyLabels++;
          else allyLabels++;
        }
        const far = o.d / radar;
        el.style.opacity = String(enemy ? Math.max(0.4, 1.05 - far) : Math.max(0.25, 0.75 - far));
        if (el.dataset.e !== (enemy ? '1' : '0')) el.dataset.e = enemy ? '1' : '0';
        if (el.dataset.t !== (text ? '1' : '0')) el.dataset.t = text ? '1' : '0';
        const label = text ? `${o.s.name} · ${Math.round(o.d / 10) * 10}m` : '';
        if (labelCache[i] !== label) {
          labelCache[i] = label;
          (el.lastElementChild as HTMLElement).textContent = label;
        }
      }

      // Candidate bracket: a valid enemy under the crosshair/cursor that is not the Target.
      const cand = targetView(inputState.candidateId);
      place(candEl.current, 0, 0, false);
      if (cand && project(cand.pos[0], cand.pos[1], cand.pos[2], p))
        place(candEl.current, p.x, p.y, true);

      // Range ladder + gunner info for first-person Siege.
      const gun = gunnerEl.current;
      place(gun, cx, cy, sieged);
      // Siege gun lock (server-validated): GUN LOCK while held, LOCK LOST briefly when the sim drops it.
      if (own.siegeLock) gunLockWas = own.siegeLock;
      else if (gunLockWas) {
        if (sieged && world.ships.get(gunLockWas)?.alive) gunLostUntil = now + 1500;
        gunLockWas = null;
      }
      if (ringEl.current)
        ringEl.current.style.strokeDashoffset = own.siegeLock ? '0' : String(RING_LEN);
      setText(gunTag.current, own.siegeLock ? 'GUN LOCK' : now < gunLostUntil ? 'LOCK LOST' : '');
      gunTag.current?.classList.toggle('lost', !own.siegeLock);
      if (sieged) {
        const hl = Math.hypot(fx, fz) || 1;
        const hf = world.heightfield;
        const maxR = secRange || primRange;
        let lastY = -1e9; // rungs bunch up toward the horizon: drop any that would overprint the one before
        for (let i = 0; i < LADDER; i++) {
          const el = ladderEls.current[i] ?? null;
          const r = ((i + 1) / LADDER) * maxR;
          const wx = own.pos[0] + (fx / hl) * r;
          const wz = own.pos[2] + (fz / hl) * r;
          const wy = hf ? sampleHeight(hf, wx, wz) : own.pos[1];
          const ok = project(wx, wy, wz, p);
          if (el) {
            const show = ok && Math.abs(p.y - lastY) > 14;
            el.style.display = show ? 'block' : 'none';
            if (show) {
              el.style.transform = `translate(0px,${p.y - cy}px)`;
              lastY = p.y;
            }
            setText(el.firstElementChild as HTMLElement, String(Math.round(r)));
          }
        }
      }

      // Target marker, lead indicator, lock progress.
      if (!target || !rel) {
        place(leadEl.current, 0, 0, false);
        place(leadLink.current, 0, 0, false);
        place(targetEl.current, 0, 0, false);
        place(edgeEl.current, 0, 0, false);
        return;
      }
      const t = primary ? leadTime(rel, target.vel, primary.speed) : 0;
      const onLead = project(
        target.pos[0] + target.vel[0] * t,
        target.pos[1] + target.vel[1] * t,
        target.pos[2] + target.vel[2] * t,
        p,
      );
      const showLead = onLead && targetD <= primRange;
      const leadX = p.x;
      const leadY = p.y;
      place(leadEl.current, leadX, leadY, showLead);
      leadEl.current?.classList.toggle('assist', assist);
      const onTarget = project(target.pos[0], target.pos[1], target.pos[2], p);
      const onScreen = onTarget && p.x > 0 && p.x < W && p.y > 0 && p.y < H;
      place(targetEl.current, p.x, p.y, onScreen);
      // Dashed tether from the Target to its lead pip so the two read as one.
      const link = leadLink.current;
      if (link) {
        const len = Math.hypot(leadX - p.x, leadY - p.y);
        link.style.display = showLead && onScreen && len > 24 ? 'block' : 'none';
        link.style.width = `${len}px`;
        link.style.transform = `translate(${p.x}px,${p.y}px) rotate(${(Math.atan2(leadY - p.y, leadX - p.x) * 180) / Math.PI}deg)`;
      }
      const far = targetD > Math.max(primRange, secRange);
      const label = `${target.name} · ${Math.round(targetD)}m`;
      setText(targetLabel.current, label);
      const tgt = targetEl.current;
      if (tgt) {
        tgt.dataset.locked = locked ? '1' : '0';
        tgt.dataset.assist = assist ? '1' : '0';
        tgt.dataset.far = far ? '1' : '0';
        tgt.dataset.canlock = lockRange || locked ? '1' : '0';
        // Brackets snap tight round the Target when the ADV lock holds.
        tgt.style.setProperty('--k', locked ? '1' : '1.5');
      }
      setText(
        targetState.current,
        locked
          ? 'LOCKED · FIRE RMB'
          : far
            ? `${Math.round(targetD)} m`
            : secInRange
              ? 'TURN TO LOCK'
              : '',
      );
      // Off screen: arrow on the screen edge toward the Target, with name and distance.
      const edge = edgeEl.current;
      if (edge) {
        edge.style.display = onScreen ? 'none' : 'block';
        if (!onScreen) {
          // Behind the camera the projection mirrors; flip it so the arrow points the way to turn.
          let dx = p.x - cx;
          let dy = p.y - cy;
          if (!onTarget) {
            dx = -dx;
            dy = -dy;
          }
          const k = Math.min(
            (cx - 60) / (Math.abs(dx) || 1e-6),
            (cy - 60) / (Math.abs(dy) || 1e-6),
          );
          edge.style.transform = `translate(${cx + dx * k}px,${cy + dy * k}px)`;
          edge.dataset.far = far ? '1' : '0';
          edge.dataset.locked = locked ? '1' : '0';
          if (edgeArrow.current)
            edgeArrow.current.style.transform = `rotate(${(Math.atan2(dy, dx) * 180) / Math.PI + 90}deg)`;
          setText(edgeText.current, label);
        }
      }
      // "turn to lock": in range but outside the nose cone -> chevron pointing from the nose toward the Target.
      const tl = turnEl.current;
      if (tl) {
        const show = secInRange && !lockRange && onScreen;
        tl.style.display = show ? 'block' : 'none';
        if (show)
          tl.style.transform = `translate(${cx}px,${cy}px) rotate(${(Math.atan2(p.y - cy, p.x - cx) * 180) / Math.PI + 90}deg)`;
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="hud-layer">
      {Array.from({ length: MARKERS }, (_, i) => (
        <div
          key={i}
          className="mk"
          ref={(el) => void (markerEls.current[i] = el)}
          style={{ display: 'none' }}
        >
          <i />
          <span />
        </div>
      ))}
      <div className="tgt" ref={targetEl} style={{ display: 'none' }}>
        <svg viewBox="-40 -40 80 80">
          <path className="tgt-dm" d="M0 -30L30 0 0 30 -30 0z" />
          <path
            className="tgt-br"
            d="M-7 -23L0 -30 7 -23M23 -7L30 0 23 7M7 23L0 30 -7 23M-23 7L-30 0 -23 -7"
          />
          <path className="tgt-diamond" d="M0 -9L9 0 0 9 -9 0z" />
          <path className="tgt-tri l" d="M-58 -9L-42 0 -58 9z" />
          <path className="tgt-tri r" d="M58 -9L42 0 58 9z" />
        </svg>
        <span className="tgt-name" ref={targetLabel} />
        <span className="tgt-state" ref={targetState} />
      </div>
      <TargetWindow />
      <div className="cand" ref={candEl} style={{ display: 'none' }}>
        <svg viewBox="-30 -30 60 60">
          <path d="M-18 -10V-18H-10M10 -18H18V-10M18 10V18H10M-10 18H-18V10" />
        </svg>
      </div>
      <div className="tgt-edge" ref={edgeEl} style={{ display: 'none' }}>
        <i ref={edgeArrow} />
        <span ref={edgeText} />
      </div>
      <div className="lead-link" ref={leadLink} style={{ display: 'none' }} />
      <div className="lead" ref={leadEl} style={{ display: 'none' }} />
      <div className="nose" ref={noseEl} style={{ display: 'none' }} />
      <div className="aim-pt" ref={aimEl} style={{ display: 'none' }} />
      <div className="cursor" ref={cursorEl}>
        <span className="cr-dist" ref={crDist} />
        <span className="cr-tag" ref={crTag} />
        <span className="cr-max" ref={crMax} />
      </div>
      <div className="turnlock" ref={turnEl} style={{ display: 'none' }}>
        <i />
        <span>TURN TO LOCK</span>
      </div>
      <div className="gunner" ref={gunnerEl} style={{ display: 'none' }}>
        <svg width="90" height="90" viewBox="-45 -45 90 90">
          <circle r="34" className="g-track" />
          <circle
            ref={ringEl}
            r="34"
            className="g-lock"
            strokeDasharray={RING_LEN}
            strokeDashoffset={RING_LEN}
            transform="rotate(-90)"
          />
          <path d="M-44 0h24M20 0h24M0 -44v24M0 20v24" className="g-cross" />
        </svg>
        <div className="g-tag" ref={gunTag} />
        <div className="ladder">
          {Array.from({ length: LADDER }, (_, i) => (
            <div key={i} ref={(el) => void (ladderEls.current[i] = el)} className="rung">
              <span />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
