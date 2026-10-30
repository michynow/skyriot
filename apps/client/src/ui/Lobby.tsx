import { createRef, useRef, useState, type RefObject } from 'react';
import {
  FRAMES,
  RUSTWATER_CANYONS,
  WEAPONS,
  type FrameId,
  type JoinOptions,
  type NationId,
} from '@skyriot/shared';
import { initAudio, music, playSfx } from '../audio/engine';
import { Controls } from './Controls';
import { HangarCanvas, ShipStage } from './FramePreview';
import './lobby.css';

const KEY = 'skyriot.lobby';
const NATIONS: Record<NationId, { name: string; motto: string; blurb: string }> = {
  concord: {
    name: 'Aurelian Concord',
    motto: 'Order above the clouds',
    blurb:
      'Gilded wings, disciplined wings. The Concord holds the high ground and never forgets a debt.',
  },
  vex: {
    name: 'Vex Freehold',
    motto: 'Nobody owns the sky',
    blurb: 'Scrapyard crowns and burning thrusters. The Freehold takes what it can fly away with.',
  },
};
const FRAME_IDS = Object.keys(FRAMES) as FrameId[];

const maxOf = (pick: (f: (typeof FRAMES)[FrameId]) => number) =>
  Math.max(...Object.values(FRAMES).map(pick));

function load(): { nation: NationId; frame: FrameId; name: string } {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    return {
      nation: v.nation === 'vex' ? 'vex' : 'concord',
      frame: v.frame in FRAMES ? v.frame : 'wasp',
      name: typeof v.name === 'string' ? v.name.slice(0, 16) : '',
    };
  } catch {
    return { nation: 'concord', frame: 'wasp', name: '' };
  }
}

function Emblem({ nation }: { nation: NationId }) {
  return (
    <svg className="lb-emblem" viewBox="0 0 64 64" aria-hidden>
      {nation === 'concord' ? (
        <>
          <path d="M32 6 L58 24 L32 18 L6 24 Z" />
          <path d="M32 22 L50 34 L32 58 L14 34 Z" opacity=".55" />
          <circle cx="32" cy="36" r="5" />
        </>
      ) : (
        <>
          <path d="M8 46 L16 18 L26 34 L32 8 L38 34 L48 18 L56 46 Z" />
          <path d="M14 50 H50 L46 58 H18 Z" opacity=".55" />
        </>
      )}
    </svg>
  );
}

function Stat({ label, value, max }: { label: string; value: number; max: number }) {
  return (
    <div className="lb-stat">
      <span>{label}</span>
      <div>
        <i style={{ width: `${(value / max) * 100}%` }} />
      </div>
      <b>{Math.round(value)}</b>
    </div>
  );
}

export function Lobby({ onLaunch }: { onLaunch(options: JoinOptions): void }) {
  const [sel, setSel] = useState(load);
  const stage = useRef<HTMLDivElement>(null);
  const thumbs = useRef(
    Object.fromEntries(FRAME_IDS.map((id) => [id, createRef<HTMLDivElement>()])) as Record<
      FrameId,
      RefObject<HTMLDivElement | null>
    >,
  );
  const set = (p: Partial<typeof sel>) => {
    setSel((s) => ({ ...s, ...p }));
    if (p.nation) music.setNation(p.nation);
  };
  const frame = FRAMES[sel.frame];

  const launch = () => {
    initAudio();
    playSfx('ui-click');
    const name = sel.name.trim() || `Pilot${Math.floor(Math.random() * 900 + 100)}`;
    try {
      localStorage.setItem(KEY, JSON.stringify({ ...sel, name: sel.name.trim() }));
    } catch {
      /* ignore */
    }
    onLaunch({ mapId: RUSTWATER_CANYONS.id, nation: sel.nation, frame: sel.frame, name });
  };

  return (
    <div
      className={`lobby ${sel.nation}`}
      onPointerDown={(e) => {
        // First press in the hangar unlocks audio and starts the calm theme.
        initAudio();
        music.setMode('lobby');
        music.setNation(sel.nation);
        if ((e.target as HTMLElement).closest('button')) playSfx('ui-click');
      }}
      onPointerOver={(e) => {
        const b = (e.target as HTMLElement).closest('button');
        if (b && b !== e.relatedTarget && !b.contains(e.relatedTarget as Node)) playSfx('ui-hover');
      }}
    >
      <div className="lb-grid" />
      <div className="lb-glow" />
      <HangarCanvas>
        <ShipStage frame={sel.frame} nation={sel.nation} track={stage} />
        {FRAME_IDS.map((id) => (
          <ShipStage
            key={id}
            frame={id}
            nation={sel.nation}
            track={thumbs.current[id]}
            speed={0.5}
          />
        ))}
      </HangarCanvas>

      <header className="lb-head">
        <h1>
          SKY<span>RIOT</span>
        </h1>
        <p>Hangar — {RUSTWATER_CANYONS.name}</p>
      </header>

      <aside className="lb-rail">
        <h2>Nation</h2>
        <div className="lb-nations">
          {(Object.keys(NATIONS) as NationId[]).map((id) => (
            <button
              key={id}
              className={`lb-nation ${id} ${sel.nation === id ? 'on' : ''}`}
              onClick={() => set({ nation: id })}
            >
              <Emblem nation={id} />
              <span>
                <strong>{NATIONS[id].name}</strong>
                <em>{NATIONS[id].motto}</em>
              </span>
            </button>
          ))}
        </div>
        <p className="lb-blurb">{NATIONS[sel.nation].blurb}</p>

        <h2>Frame</h2>
        <div className="lb-frames">
          {FRAME_IDS.map((id) => (
            <button
              key={id}
              className={`lb-frame ${sel.frame === id ? 'on' : ''}`}
              onClick={() => set({ frame: id })}
            >
              <div className="lb-thumb" ref={thumbs.current[id]} />
              <span>
                <strong>{FRAMES[id].name}</strong>
                <em>{FRAMES[id].role}</em>
              </span>
            </button>
          ))}
        </div>
      </aside>

      <section className="lb-stage" key={sel.frame}>
        <div className="lb-view" ref={stage} />
        <div className="lb-sheet">
          <h3>{frame.name}</h3>
          <p>{frame.role}</p>
          <div className="lb-stats">
            <Stat label="Armor" value={frame.maxHp} max={maxOf((x) => x.maxHp)} />
            <Stat label="Shield" value={frame.maxShield} max={maxOf((x) => x.maxShield)} />
            <Stat label="Speed" value={frame.maxSpeed} max={maxOf((x) => x.maxSpeed)} />
            <Stat
              label="Agility"
              value={frame.turnRate * 100}
              max={maxOf((x) => x.turnRate) * 100}
            />
          </div>
          <dl className="lb-wpn">
            <dt>Primary</dt>
            <dd>{WEAPONS[frame.primary]?.name}</dd>
            <dt>Secondary</dt>
            <dd>{WEAPONS[frame.secondary]?.name}</dd>
            {frame.canHover && (
              <>
                <dt>Special</dt>
                <dd>Siege Mode</dd>
              </>
            )}
          </dl>
        </div>
      </section>

      <footer className="lb-foot">
        <details className="lb-controls">
          <summary>Controls</summary>
          <Controls frame={sel.frame} compact />
        </details>
        <label className="lb-callsign">
          <span>Callsign</span>
          <input
            value={sel.name}
            maxLength={16}
            placeholder="Pilot name"
            onChange={(e) => set({ name: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && launch()}
          />
        </label>
        <button className="lb-launch" onClick={launch}>
          Launch
        </button>
      </footer>
    </div>
  );
}
