import { useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { NationId } from '@skyriot/shared';
import { world } from '../state/world';
import {
  NATION_NAME,
  enemyOf,
  isFlying,
  ownShip,
  structureName,
  useHud,
  type BaseView,
} from './hudStore';
import { NATION_COLOR } from './Reticles';
import { project } from './view';

function Base({ nation, b, side }: { nation: NationId; b: BaseView; side: 'ours' | 'theirs' }) {
  const corePct = Math.max(0, Math.min(1, b.coreHp / Math.max(1, b.coreMax)));
  return (
    <div className={`base ${side}`} style={{ ['--c' as string]: NATION_COLOR[nation] }}>
      <div className="base-head">
        <b>{NATION_NAME[nation]}</b>
        <span className={`shield ${b.shield ? 'up' : 'down'}`}>
          <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden>
            <path d="M8 1.5 14 4v4c0 3.4-2.6 5.8-6 6.5C4.6 13.8 2 11.4 2 8V4z" />
          </svg>
          {b.shield ? 'SHIELD UP' : 'SHIELD DOWN'}
        </span>
      </div>
      <div className="base-row">
        <span className="pips" title="Shield Stations">
          {b.stations.map((alive, i) => (
            <i key={i} className={alive ? 'on' : ''} />
          ))}
        </span>
        <span
          className={`core ${corePct < 0.3 ? 'low' : ''} ${!b.shield ? 'exposed' : ''}`}
          title="Core HP"
        >
          <i style={{ width: `${corePct * 100}%` }} />
        </span>
        <span className="turrets" title="Turrets left">
          {b.turretsAlive}/{b.turretsTotal}
        </span>
      </div>
    </div>
  );
}

/** Top-centre battle panel: both Bases (shield, Shield Station pips, Core HP, Turrets) and the objective line. */
export function Objectives() {
  const h = useHud(
    useShallow((x) => ({
      nation: x.nation,
      bases: x.bases,
      objective: x.objective,
      warn: x.defenseWarn,
      phase: x.battlePhase,
    })),
  );
  if (!h.nation || h.phase === 'ended') return null;
  const me = h.nation;
  const en = enemyOf(me);
  const attack = !h.bases[en].shield;
  return (
    <div className="objectives">
      <div className="obj-bases">
        <Base nation={me} b={h.bases[me]} side="ours" />
        <div className="obj-vs">VS</div>
        <Base nation={en} b={h.bases[en]} side="theirs" />
      </div>
      <div className={`obj-line ${h.warn ? 'warn' : attack ? 'attack' : ''}`}>
        {h.warn || h.objective}
      </div>
    </div>
  );
}

/** Centre banner for Battle events (shield down, station destroyed, battle begins). */
export function BattleBanner() {
  const banner = useHud((x) => x.banner);
  if (!banner) return null;
  return (
    <div key={banner.nonce} className={`battle-banner ${banner.kind}`}>
      <b>{banner.text}</b>
      <span>{banner.sub}</span>
    </div>
  );
}

export function BattleEnd() {
  const h = useHud(
    useShallow((x) => ({
      phase: x.battlePhase,
      winner: x.winner,
      nation: x.nation,
      restartIn: x.restartIn,
    })),
  );
  if (h.phase !== 'ended' || !h.nation) return null;
  const won = h.winner === h.nation;
  return (
    <div className={`battle-end ${won ? 'won' : 'lost'}`}>
      <h1>{won ? 'VICTORY' : 'DEFEAT'}</h1>
      <p>{won ? 'The enemy Core has fallen.' : 'Our Core has fallen.'}</p>
      <p className="next">
        Next Battle in <b>{Math.ceil(h.restartIn)}</b> s
      </p>
    </div>
  );
}

const MARKERS = 3;
const p = { x: 0, y: 0 };

/**
 * World markers for what the objective line points at: enemy Shield Stations while their shield is up, the enemy
 * Core once it is down. On screen: a thin diamond with name and distance; off screen: a chevron on the edge.
 */
export function StructureMarkers() {
  const els = useRef<(HTMLDivElement | null)[]>([]);
  useEffect(() => {
    let raf = 0;
    const texts: string[] = [];
    const placedX: number[] = [];
    const placedY: number[] = [];
    const frame = () => {
      raf = requestAnimationFrame(frame);
      const own = ownShip();
      let n = 0;
      if (own && isFlying(own) && world.match?.phase !== 'ended') {
        const en = enemyOf(own.nation);
        const shielded = world.match ? world.match.shielded[en] : true;
        const W = window.innerWidth;
        const H = window.innerHeight;
        for (const st of world.structures.values()) {
          if (n >= MARKERS || st.nation !== en || !st.alive) continue;
          if (st.kind === 'turret' || (st.kind === 'core') === shielded) continue;
          const el = els.current[n];
          if (!el) continue;
          const d = Math.hypot(
            st.pos[0] - own.pos[0],
            st.pos[1] - own.pos[1],
            st.pos[2] - own.pos[2],
          );
          const on = project(st.pos[0], st.pos[1] + 30, st.pos[2], p);
          let dx = p.x - W / 2;
          let dy = p.y - H / 2;
          if (!on) {
            dx = -dx;
            dy = -dy;
          }
          // Edge markers stay clear of the objectives/heading block, the hotbar and the side widgets.
          const edge = Math.min(
            (W / 2 - 220) / Math.abs(dx || 1e-6),
            (H / 2 - 190) / Math.abs(dy || 1e-6),
          );
          const offscreen = !on || edge < 1;
          const x = offscreen ? W / 2 + dx * edge : p.x;
          let y = offscreen ? H / 2 + dy * edge : p.y;
          // Two stations in the same direction would land on the same edge spot: stack the second one.
          for (let j = 0; j < n; j++)
            if (Math.abs(placedX[j]! - x) < 130 && Math.abs(placedY[j]! - y) < 34)
              y = placedY[j]! + 34;
          placedX[n] = x;
          placedY[n] = y;
          el.style.display = 'block';
          el.dataset.off = offscreen ? '1' : '0';
          el.style.transform = `translate(${x}px,${y}px)`;
          const chev = el.firstElementChild as HTMLElement;
          chev.style.transform = offscreen
            ? `rotate(${(Math.atan2(dy, dx) * 180) / Math.PI + 90}deg)`
            : 'rotate(45deg)';
          const text = `${structureName(st).toUpperCase()} ${d >= 1000 ? `${(d / 1000).toFixed(1)} km` : `${Math.round(d)} m`}`;
          if (texts[n] !== text) {
            texts[n] = text;
            (el.lastElementChild as HTMLElement).textContent = text;
          }
          n++;
        }
      }
      for (let i = n; i < MARKERS; i++) {
        const el = els.current[i];
        if (el) el.style.display = 'none';
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
          className="smk"
          ref={(el) => void (els.current[i] = el)}
          style={{ display: 'none' }}
        >
          <i />
          <span />
        </div>
      ))}
    </div>
  );
}
