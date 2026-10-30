import { useEffect, useRef } from 'react';
import { FRAMES } from '@skyriot/shared';
import { world } from '../state/world';
import { inputState } from '../input/input';
import { NATION_COLOR } from './Reticles';
import { ownShip } from './hudStore';

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

      const own = ownShip();
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

      // Map boundary as a dashed edge, clipped to the radar disc.
      const half = (world.map?.size ?? 0) / 2;
      if (half > 0) {
        g.save();
        g.beginPath();
        g.arc(c, c, R, 0, Math.PI * 2);
        g.clip();
        g.strokeStyle = '#ff4d4d';
        g.lineWidth = 3;
        g.setLineDash([8, 6]);
        g.beginPath();
        [
          [-half, -half],
          [half, -half],
          [half, half],
          [-half, half],
        ].forEach(([wx, wz], i) => {
          const s = toScreen(wx! - own.pos[0], wz! - own.pos[2]);
          if (i === 0) g.moveTo(c + s.x * R, c + s.y * R);
          else g.lineTo(c + s.x * R, c + s.y * R);
        });
        g.closePath();
        g.stroke();
        g.restore();
      }

      /** Icon at a world XZ, clamped to the radar rim as a bearing arrow when out of range. */
      const edgeIcon = (
        wx: number,
        wz: number,
        color: string,
        draw: (x: number, y: number) => void,
      ) => {
        const s = toScreen(wx - own.pos[0], wz - own.pos[2]);
        const len = Math.hypot(s.x, s.y);
        const k = len > 1 ? 1 / len : 1;
        const x = c + s.x * k * R;
        const y = c + s.y * k * R;
        g.fillStyle = color;
        g.strokeStyle = color;
        g.lineWidth = 2;
        if (len <= 1) return draw(x, y);
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
      };
      for (const deck of world.map?.launchDecks?.[own.nation] ?? [])
        edgeIcon(deck.pos[0], deck.pos[2], '#5fe3ff', (x, y) => {
          g.fillRect(x - 5, y - 5, 10, 10);
          g.fillStyle = '#04101a';
          g.fillRect(x - 2, y - 2, 4, 4);
        });
      // Both Cores as nation-coloured hexes (bearing arrows when out of range); live Shield Stations as small squares.
      for (const n of ['concord', 'vex'] as const) {
        const def = world.map?.bases?.[n];
        if (!def) continue;
        const col = NATION_COLOR[n];
        edgeIcon(def.core[0], def.core[2], col, (x, y) => {
          g.beginPath();
          for (let i = 0; i < 6; i++)
            g.lineTo(x + 7 * Math.cos((i * Math.PI) / 3), y + 7 * Math.sin((i * Math.PI) / 3));
          g.closePath();
          g.stroke();
        });
        def.shieldStations.forEach((pos, i) => {
          const live = [...world.structures.values()].find(
            (st) =>
              st.kind === 'shieldStation' &&
              st.nation === n &&
              Math.hypot(st.pos[0] - pos[0], st.pos[2] - pos[2]) < 5,
          );
          if (live && !live.alive) return;
          const s = toScreen(pos[0] - own.pos[0], pos[2] - own.pos[2]);
          if (Math.hypot(s.x, s.y) > 1) return;
          g.fillStyle = col;
          g.fillRect(c + s.x * R - 3, c + s.y * R - 3, 6, 6);
          void i;
        });
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
