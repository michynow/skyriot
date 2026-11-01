import { useEffect, useRef } from 'react';
import { world } from '../state/world';
import { isFlying, ownShip } from './hudStore';
import { project } from './view';

const PIPS = 8;
const RING_R = 96;
const p = { x: 0, y: 0 };

/**
 * Ring round the centre crosshair, shown while enemies hold a missile lock on us: one pip per locker, placed on
 * the ring in the screen direction they are coming from (flipped when they are behind the camera).
 */
export function ThreatRing() {
  const box = useRef<HTMLDivElement>(null);
  const pips = useRef<(SVGPathElement | null)[]>([]);

  useEffect(() => {
    let raf = 0;
    const frame = () => {
      raf = requestAnimationFrame(frame);
      const own = ownShip();
      const el = box.current;
      if (!el) return;
      let n = 0;
      if (own && isFlying(own)) {
        const cx = window.innerWidth / 2,
          cy = window.innerHeight / 2;
        for (const s of world.ships.values()) {
          if (n >= PIPS) break;
          if (!s.alive || s.lockTarget !== own.id) continue;
          const on = project(s.pos[0], s.pos[1], s.pos[2], p);
          let dx = p.x - cx,
            dy = p.y - cy;
          if (!on) {
            dx = -dx;
            dy = -dy;
          }
          const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
          const pip = pips.current[n++];
          if (!pip) continue;
          pip.style.display = 'block';
          pip.setAttribute('transform', `rotate(${ang + 90}) translate(0 ${-RING_R})`);
          pip.classList.toggle('msl', own.incomingDist >= 0);
        }
      }
      el.style.display = n > 0 ? 'block' : 'none';
      el.style.transform = `translate(${window.innerWidth / 2}px,${window.innerHeight / 2}px)`;
      for (let i = n; i < PIPS; i++) {
        const pip = pips.current[i];
        if (pip) pip.style.display = 'none';
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="threat" ref={box} style={{ display: 'none' }}>
      <svg viewBox="-120 -120 240 240">
        <circle r={RING_R} />
        {Array.from({ length: PIPS }, (_, i) => (
          <path
            key={i}
            ref={(e) => void (pips.current[i] = e)}
            className="pip"
            d="M0 -10L9 6H-9z"
            style={{ display: 'none' }}
          />
        ))}
      </svg>
    </div>
  );
}
