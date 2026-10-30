import { useEffect, useRef } from 'react';
import { FRAMES } from '@skyriot/shared';
import { world } from '../state/world';
import { inputState } from '../input/input';

const SIZE = 220;
const R = SIZE / 2 - 8;
const ABOVE_BELOW_M = 100;

/** Circular heading-up radar covering the Frame's radarRangeM. */
export function Radar() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const g = ref.current!.getContext('2d')!;
    const c = SIZE / 2;
    const tri = (x: number, y: number, up: boolean, size: number) => {
      g.beginPath();
      g.moveTo(x, y + (up ? -size : size));
      g.lineTo(x - size, y + (up ? size : -size));
      g.lineTo(x + size, y + (up ? size : -size));
      g.closePath();
      g.fill();
    };
    const timer = setInterval(() => {
      g.clearRect(0, 0, SIZE, SIZE);
      g.fillStyle = 'rgba(4,14,24,0.78)';
      g.beginPath();
      g.arc(c, c, R, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = 'rgba(127,231,255,0.35)';
      g.lineWidth = 1;
      for (const f of [1 / 3, 2 / 3, 1]) {
        g.beginPath();
        g.arc(c, c, R * f, 0, Math.PI * 2);
        g.stroke();
      }
      g.beginPath();
      g.moveTo(c - R, c);
      g.lineTo(c + R, c);
      g.moveTo(c, c - R);
      g.lineTo(c, c + R);
      g.stroke();

      const own = world.ownId ? world.ships.get(world.ownId) : undefined;
      if (!own) return;
      const range = FRAMES[own.frame].radarRangeM;
      const [qx, qy, qz, qw] = own.rot;
      let fx = -2 * (qx * qz + qw * qy);
      let fz = -(1 - 2 * (qx * qx + qy * qy));
      const fl = Math.hypot(fx, fz) || 1;
      fx /= fl;
      fz /= fl;
      // Heading-up: screen right = (-fz, fx), screen up = forward.
      const toScreen = (dx: number, dz: number) => ({
        x: (dx * -fz + dz * fx) / range,
        y: -(dx * fx + dz * fz) / range,
      });

      // Launch Deck icons for the own nation; bearing arrow at the edge when out of range.
      for (const deck of world.map?.launchDecks?.[own.nation] ?? []) {
        const s = toScreen(deck.pos[0] - own.pos[0], deck.pos[2] - own.pos[2]);
        const len = Math.hypot(s.x, s.y);
        const k = len > 1 ? 1 / len : 1;
        const x = c + s.x * k * R;
        const y = c + s.y * k * R;
        g.fillStyle = '#5fe3ff';
        g.strokeStyle = '#5fe3ff';
        g.lineWidth = 2;
        if (len <= 1) {
          g.fillRect(x - 5, y - 5, 10, 10);
          g.fillStyle = '#04101a';
          g.fillRect(x - 2, y - 2, 4, 4);
        } else {
          g.save();
          g.translate(x, y);
          g.rotate(Math.atan2(s.y, s.x));
          g.beginPath();
          g.moveTo(7, 0);
          g.lineTo(-5, 6);
          g.lineTo(-5, -6);
          g.closePath();
          g.fill();
          g.restore();
        }
      }

      for (const s of world.ships.values()) {
        if (!s.alive || s.id === own.id) continue;
        const rel = toScreen(s.pos[0] - own.pos[0], s.pos[2] - own.pos[2]);
        if (Math.hypot(rel.x, rel.y) > 1) continue;
        const x = c + rel.x * R;
        const y = c + rel.y * R;
        const dy = s.pos[1] - own.pos[1];
        g.fillStyle = s.nation === own.nation ? '#ffffff' : '#ff4d4d';
        if (dy > ABOVE_BELOW_M) tri(x, y, true, 4.5);
        else if (dy < -ABOVE_BELOW_M) tri(x, y, false, 4.5);
        else {
          g.beginPath();
          g.arc(x, y, 3, 0, Math.PI * 2);
          g.fill();
        }
        if (s.id === inputState.targetId) {
          g.strokeStyle = '#ffd24a';
          g.lineWidth = 2;
          g.beginPath();
          g.arc(x, y, 8, 0, Math.PI * 2);
          g.stroke();
        }
      }
      // Own arrow (always up).
      g.fillStyle = '#7fe7ff';
      g.beginPath();
      g.moveTo(c, c - 7);
      g.lineTo(c - 5, c + 5);
      g.lineTo(c, c + 2);
      g.lineTo(c + 5, c + 5);
      g.closePath();
      g.fill();
    }, 50);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="radar">
      <canvas ref={ref} width={SIZE} height={SIZE} />
    </div>
  );
}
