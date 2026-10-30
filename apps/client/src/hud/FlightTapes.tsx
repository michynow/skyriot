import { useEffect, useRef } from 'react';
import { FRAMES, sampleHeight } from '@skyriot/shared';
import { world } from '../state/world';
import { isFlying, ownShip } from './hudStore';

const TAPE_W = 96;
const TAPE_H = 300;
const HEADING_W = 360;
const HEADING_H = 40;
const CYAN = '#7fe7ff';
const INK = '#e8f4ff';
const RED = '#ff4d4d';
const AMBER = '#ffd24a';
const DIM = 'rgba(127,231,255,0.45)';
const HATCH = 'rgba(255,77,77,0.55)';

function setup(c: HTMLCanvasElement, w: number, h: number) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  c.width = w * dpr;
  c.height = h * dpr;
  const g = c.getContext('2d')!;
  g.scale(dpr, dpr);
  return g;
}

/** Translucent backing strip so the tape reads over bright terrain; side = which edge faces the centre. */
function backing(g: CanvasRenderingContext2D, w: number, h: number, side: 'left' | 'right') {
  const grad = g.createLinearGradient(side === 'right' ? 0 : w, 0, side === 'right' ? w : 0, 0);
  grad.addColorStop(0, 'rgba(6,18,31,0)');
  grad.addColorStop(1, 'rgba(6,18,31,0.75)');
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
}

function hatch(g: CanvasRenderingContext2D, x: number, y0: number, y1: number, w: number) {
  if (y1 <= y0) return;
  g.save();
  g.beginPath();
  g.rect(x, y0, w, y1 - y0);
  g.clip();
  g.strokeStyle = HATCH;
  g.lineWidth = 2;
  g.beginPath();
  for (let y = y0 - w; y < y1 + w; y += 7) {
    g.moveTo(x, y);
    g.lineTo(x + w, y + w);
  }
  g.stroke();
  g.restore();
}

/** Current-value box with a pointer toward the screen centre. */
function readout(
  g: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  w: number,
  side: 'left' | 'right',
  color: string,
  fill: string,
) {
  const h = 30;
  const tip = 9;
  g.beginPath();
  if (side === 'right') {
    g.moveTo(x, y - h / 2);
    g.lineTo(x + w - tip, y - h / 2);
    g.lineTo(x + w, y);
    g.lineTo(x + w - tip, y + h / 2);
    g.lineTo(x, y + h / 2);
  } else {
    g.moveTo(x + w, y - h / 2);
    g.lineTo(x + tip, y - h / 2);
    g.lineTo(x, y);
    g.lineTo(x + tip, y + h / 2);
    g.lineTo(x + w, y + h / 2);
  }
  g.closePath();
  g.fillStyle = fill;
  g.fill();
  g.strokeStyle = color;
  g.lineWidth = 1.5;
  g.stroke();
  g.fillStyle = color;
  g.font = '800 19px Orbitron, sans-serif';
  g.textBaseline = 'middle';
  g.textAlign = 'center';
  g.fillText(text, x + w / 2 + (side === 'right' ? -tip / 2 : tip / 2), y + 1);
}

/**
 * Vertical tape: `value` sits at the centre line, `perUnit` px per unit, ticks every `minor` with a label every
 * `major`. `zoneBelow` hatches everything under that value (stall speed / the ground).
 */
function tape(
  g: CanvasRenderingContext2D,
  side: 'left' | 'right',
  value: number,
  perUnit: number,
  minor: number,
  major: number,
  zoneBelow: number | null,
  floor: number | null,
) {
  const w = TAPE_W;
  const h = TAPE_H;
  const cy = h / 2;
  const axisX = side === 'right' ? w - 1 : 1;
  const dir = side === 'right' ? -1 : 1;
  g.clearRect(0, 0, w, h);
  backing(g, w, h, side);
  const yOf = (v: number) => cy - (v - value) * perUnit;
  if (zoneBelow !== null) {
    const top = Math.max(0, yOf(zoneBelow));
    const bottom = floor === null ? h : Math.min(h, yOf(floor));
    hatch(g, side === 'right' ? w - 22 : 0, top, bottom, 22);
  }
  g.strokeStyle = DIM;
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(axisX, 0);
  g.lineTo(axisX, h);
  g.stroke();
  const span = h / perUnit / 2;
  const first = Math.floor((value - span) / minor) * minor;
  g.font = '700 13px Rajdhani, sans-serif';
  g.textBaseline = 'middle';
  g.textAlign = side === 'right' ? 'right' : 'left';
  for (let v = first; v <= value + span; v += minor) {
    if (floor !== null && v < floor) continue;
    const y = yOf(v);
    if (y < 4 || y > h - 4) continue;
    const isMajor = Math.abs(v / major - Math.round(v / major)) < 1e-6;
    g.strokeStyle = isMajor ? CYAN : DIM;
    g.beginPath();
    g.moveTo(axisX, y);
    g.lineTo(axisX + dir * (isMajor ? 14 : 7), y);
    g.stroke();
    if (isMajor && Math.abs(y - cy) > 20) {
      g.fillStyle = INK;
      g.fillText(String(Math.round(v)), axisX + dir * 20, y);
    }
  }
}

function headingScale(g: CanvasRenderingContext2D, headingDeg: number) {
  const w = HEADING_W;
  const h = HEADING_H;
  g.clearRect(0, 0, w, h);
  const grad = g.createLinearGradient(0, 0, w, 0);
  grad.addColorStop(0, 'rgba(6,18,31,0)');
  grad.addColorStop(0.5, 'rgba(6,18,31,0.7)');
  grad.addColorStop(1, 'rgba(6,18,31,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
  const perDeg = w / 90;
  const cx = w / 2;
  g.font = '700 12px Rajdhani, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'top';
  const first = Math.floor((headingDeg - 45) / 5) * 5;
  for (let d = first; d <= headingDeg + 45; d += 5) {
    const x = cx + (d - headingDeg) * perDeg;
    if (x < 6 || x > w - 6) continue;
    const norm = ((d % 360) + 360) % 360;
    const major = norm % 30 === 0;
    g.strokeStyle = major ? CYAN : DIM;
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(x, h - 1);
    g.lineTo(x, h - (major ? 12 : norm % 10 === 0 ? 8 : 5));
    g.stroke();
    if (major && Math.abs(x - cx) > 26) {
      const cardinal = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' }[norm];
      g.fillStyle = cardinal ? CYAN : INK;
      g.fillText(cardinal ?? String(norm / 10).padStart(2, '0'), x, 4);
    }
  }
  // Heading box, centred, pointing down at the scale.
  const bw = 46;
  const bh = 22;
  g.beginPath();
  g.moveTo(cx - bw / 2, 2);
  g.lineTo(cx + bw / 2, 2);
  g.lineTo(cx + bw / 2, 2 + bh);
  g.lineTo(cx + 6, 2 + bh);
  g.lineTo(cx, 2 + bh + 6);
  g.lineTo(cx - 6, 2 + bh);
  g.lineTo(cx - bw / 2, 2 + bh);
  g.closePath();
  g.fillStyle = 'rgba(6,18,31,0.9)';
  g.fill();
  g.strokeStyle = CYAN;
  g.lineWidth = 1.5;
  g.stroke();
  g.fillStyle = INK;
  g.font = '800 14px Orbitron, sans-serif';
  g.textBaseline = 'middle';
  g.fillText(
    String(Math.round(((headingDeg % 360) + 360) % 360)).padStart(3, '0'),
    cx,
    2 + bh / 2 + 1,
  );
}

/**
 * Fighter-style flight instruments: speed tape (left, stall zone hatched red), radar-altitude tape (right, AGL,
 * ground hatched), vertical-speed chevron, heading scale with pitch readout, and the STALL warning.
 */
export function FlightTapes() {
  const speedEl = useRef<HTMLCanvasElement>(null);
  const altEl = useRef<HTMLCanvasElement>(null);
  const hdgEl = useRef<HTMLCanvasElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const stallEl = useRef<HTMLDivElement>(null);
  const pitchEl = useRef<HTMLSpanElement>(null);
  const vsEl = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const gs = setup(speedEl.current!, TAPE_W, TAPE_H);
    const ga = setup(altEl.current!, TAPE_W, TAPE_H);
    const gh = setup(hdgEl.current!, HEADING_W, HEADING_H);
    let raf = 0;
    let lastStall = false;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const own = ownShip();
      const show = !!own && isFlying(own) && !own.sieged;
      if (wrap.current) wrap.current.style.display = show ? 'block' : 'none';
      if (!own || !show) {
        if (stallEl.current) stallEl.current.style.display = 'none';
        return;
      }
      const def = FRAMES[own.frame];
      const env = world.map?.env;
      const stallSpeed = env?.stallSpeed ?? 0;
      const hf = world.heightfield;
      const agl = hf ? own.pos[1] - sampleHeight(hf, own.pos[0], own.pos[2]) : own.pos[1];
      const stalled = own.stalled === true;

      // Speed: 2.4 px per m/s, so the stall band and the Frame's top speed are both usually in view.
      tape(gs, 'right', own.speed, 2.4, 10, 20, stallSpeed > 0 ? stallSpeed : null, 0);
      if (def.maxSpeed) {
        const y = TAPE_H / 2 - (def.maxSpeed - own.speed) * 2.4;
        if (y > 0 && y < TAPE_H) {
          gs.strokeStyle = AMBER;
          gs.lineWidth = 2;
          gs.beginPath();
          gs.moveTo(TAPE_W - 24, y);
          gs.lineTo(TAPE_W - 1, y);
          gs.stroke();
        }
      }
      const slow = stallSpeed > 0 && own.speed < stallSpeed * 1.25;
      readout(
        gs,
        String(Math.round(own.speed)),
        10,
        TAPE_H / 2,
        TAPE_W - 10,
        'right',
        stalled ? RED : slow ? AMBER : INK,
        stalled ? 'rgba(90,10,10,0.92)' : 'rgba(6,18,31,0.92)',
      );

      // Altitude AGL: 1 px per metre; the ground is the hatched floor.
      const low = agl < 60 && own.vel[1] < -5;
      tape(ga, 'left', agl, 1, 25, 50, 0, 0);
      readout(
        ga,
        String(Math.max(0, Math.round(agl))),
        0,
        TAPE_H / 2,
        TAPE_W - 10,
        'left',
        low ? RED : INK,
        low ? 'rgba(90,10,10,0.92)' : 'rgba(6,18,31,0.92)',
      );

      const [qx, qy, qz, qw] = own.rot;
      const fx = -2 * (qx * qz + qw * qy);
      const fy = -2 * (qy * qz - qw * qx);
      const fz = -(1 - 2 * (qx * qx + qy * qy));
      const heading = (Math.atan2(fx, -fz) * 180) / Math.PI;
      headingScale(gh, heading);
      const pitch = Math.round((Math.asin(Math.max(-1, Math.min(1, fy))) * 180) / Math.PI);
      const pitchText = `${pitch > 0 ? '+' : ''}${pitch}°`;
      if (pitchEl.current && pitchEl.current.textContent !== pitchText)
        pitchEl.current.textContent = pitchText;
      const vs = Math.round(own.vel[1]);
      const vsText = vs === 0 ? '—' : `${vs > 0 ? '▲' : '▼'} ${Math.abs(vs)}`;
      if (vsEl.current) {
        if (vsEl.current.textContent !== vsText) vsEl.current.textContent = vsText;
        vsEl.current.style.color = vs < -25 ? RED : INK;
      }

      if (stalled !== lastStall) {
        lastStall = stalled;
        if (stallEl.current) stallEl.current.style.display = stalled ? 'block' : 'none';
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <>
      <div className="tapes" ref={wrap}>
        <div className="tape tape-spd">
          <small>SPD m/s</small>
          <canvas ref={speedEl} style={{ width: TAPE_W, height: TAPE_H }} />
        </div>
        <div className="tape tape-alt">
          <small>RALT m</small>
          <canvas ref={altEl} style={{ width: TAPE_W, height: TAPE_H }} />
          <span className="vs" ref={vsEl} />
        </div>
        <div className="hdg">
          <canvas ref={hdgEl} style={{ width: HEADING_W, height: HEADING_H }} />
          <span className="pitch">
            PITCH <b ref={pitchEl} />
          </span>
        </div>
      </div>
      <div className="stall" ref={stallEl} style={{ display: 'none' }}>
        STALL
        <small>NOSE DOWN · FULL THROTTLE</small>
      </div>
    </>
  );
}
