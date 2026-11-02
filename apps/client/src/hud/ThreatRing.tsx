import { useEffect, useRef } from 'react';
import { world } from '../state/world';
import { inputState } from '../input/input';
import { isFlying, ownShip, targetView } from './hudStore';
import { project } from './view';

const PIPS = 8;
/** Radius of the invisible ring round the centre crosshair that the pointers sit on. */
const RING_R = 96;
/** Off-screen Target label sits this far out from the centre, past its arrow. */
const LABEL_R = RING_R + 38;
/** A Target this close to the screen edge counts as off screen. */
const EDGE_PX = 24;
const p = { x: 0, y: 0 };

/** Screen angle (deg) from the centre toward a world point; flipped when it is behind the camera. */
function bearing(x: number, y: number, z: number, cx: number, cy: number): number {
  const on = project(x, y, z, p);
  const s = on ? 1 : -1;
  return (Math.atan2((p.y - cy) * s, (p.x - cx) * s) * 180) / Math.PI;
}

/**
 * Pointers on an invisible ring round the centre crosshair: a small arrow toward each enemy holding a missile lock
 * on us, and a bigger one toward the Target (labelled with name and distance) while it is off screen.
 */
export function ThreatRing() {
  const box = useRef<HTMLDivElement>(null);
  const pips = useRef<(SVGGElement | null)[]>([]);
  const offEl = useRef<SVGPathElement>(null);
  const labelEl = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    let labelText = '';
    const frame = () => {
      raf = requestAnimationFrame(frame);
      const own = ownShip();
      const el = box.current;
      if (!el) return;
      const W = window.innerWidth,
        H = window.innerHeight;
      const cx = W / 2,
        cy = H / 2;
      let n = 0;
      let off = false;
      if (own && isFlying(own)) {
        for (const s of world.ships.values()) {
          if (n >= PIPS) break;
          if (!s.alive || s.lockTarget !== own.id) continue;
          const pip = pips.current[n++];
          if (!pip) continue;
          const ang = bearing(s.pos[0], s.pos[1], s.pos[2], cx, cy);
          pip.style.display = 'block';
          pip.setAttribute('transform', `rotate(${ang + 90}) translate(0 ${-RING_R})`);
          pip.classList.toggle('msl', own.incomingDist >= 0);
        }
        const t = targetView(inputState.targetId);
        if (t && t.alive) {
          const on = project(t.pos[0], t.pos[1], t.pos[2], p);
          off = !on || p.x < EDGE_PX || p.y < EDGE_PX || p.x > W - EDGE_PX || p.y > H - EDGE_PX;
          if (off) {
            const ang = bearing(t.pos[0], t.pos[1], t.pos[2], cx, cy);
            offEl.current?.setAttribute('transform', `rotate(${ang + 90}) translate(0 ${-RING_R})`);
            const r = (ang * Math.PI) / 180;
            const lbl = labelEl.current;
            if (lbl) {
              lbl.style.left = `${Math.cos(r) * LABEL_R}px`;
              lbl.style.top = `${Math.sin(r) * LABEL_R}px`;
              const d = Math.hypot(
                t.pos[0] - own.pos[0],
                t.pos[1] - own.pos[1],
                t.pos[2] - own.pos[2],
              );
              const text = `${t.name}\n${Math.round(d / 10) * 10} m`;
              if (text !== labelText) {
                labelText = text;
                lbl.innerText = text;
              }
            }
          }
        }
      }
      el.style.display = n > 0 || off ? 'block' : 'none';
      el.style.transform = `translate(${cx}px,${cy}px)`;
      if (offEl.current) offEl.current.style.display = off ? 'block' : 'none';
      if (labelEl.current) labelEl.current.style.display = off ? 'block' : 'none';
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
        <path ref={offEl} className="off" d="M0 -20L16 8H-16z" style={{ display: 'none' }} />
        {Array.from({ length: PIPS }, (_, i) => (
          // The <g> carries the placement: the pip's pulse animation would override a transform on the path itself.
          <g key={i} ref={(e) => void (pips.current[i] = e)} style={{ display: 'none' }}>
            <path className="pip" d="M0 -10L9 6H-9z" />
          </g>
        ))}
      </svg>
      <div className="threat-label" ref={labelEl} style={{ display: 'none' }} />
    </div>
  );
}
