import { useState } from 'react';
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
  const set = (p: Partial<typeof sel>) => {
    setSel((s) => ({ ...s, ...p }));
    if (p.nation) music.setNation(p.nation);
  };

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

      <header className="lb-head">
        <div>
          <h1>
            SKY<span>RIOT</span>
          </h1>
          <p>
            HANGAR <i>/</i> {RUSTWATER_CANYONS.name}
          </p>
        </div>
        <div className="lb-brief">
          <span>DEPLOYMENT</span>
          <strong>{NATIONS[sel.nation].name}</strong>
          <span>
            {FRAMES[sel.frame].name} · {FRAMES[sel.frame].role}
          </span>
        </div>
      </header>

      <section className="lb-nations">
        <h2 className="lb-h">
          <b>01</b> Nation
        </h2>
        <div className="lb-row">
          {(Object.keys(NATIONS) as NationId[]).map((id) => (
            <button
              key={id}
              className={`lb-nation ${id} ${sel.nation === id ? 'on' : ''}`}
              onClick={() => set({ nation: id })}
            >
              <Emblem nation={id} />
              <div>
                <em>{NATIONS[id].motto}</em>
                <strong>{NATIONS[id].name}</strong>
                <span>{NATIONS[id].blurb}</span>
              </div>
              <small>{sel.nation === id ? 'ENLISTED' : 'ENLIST'}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="lb-frames">
        <h2 className="lb-h">
          <b>02</b> Frame
        </h2>
        <div className="lb-row">
          {Object.values(FRAMES).map((f) => (
            <button
              key={f.id}
              className={`lb-frame ${sel.frame === f.id ? 'on' : ''}`}
              data-mark={f.name[0]}
              onClick={() => set({ frame: f.id })}
            >
              <div className="lb-frame-head">
                <h3>{f.name}</h3>
                <small>{f.role}</small>
              </div>
              <div className="lb-stats">
                <Stat label="ARMOR" value={f.maxHp} max={maxOf((x) => x.maxHp)} />
                <Stat label="SHIELD" value={f.maxShield} max={maxOf((x) => x.maxShield)} />
                <Stat label="SPEED" value={f.maxSpeed} max={maxOf((x) => x.maxSpeed)} />
                <Stat
                  label="AGILITY"
                  value={f.turnRate * 100}
                  max={maxOf((x) => x.turnRate) * 100}
                />
              </div>
              <dl className="lb-wpn">
                <dt>Primary</dt>
                <dd>{WEAPONS[f.primary]?.name}</dd>
                <dt>Secondary</dt>
                <dd>{WEAPONS[f.secondary]?.name}</dd>
                {f.canHover && (
                  <>
                    <dt>Special</dt>
                    <dd>Siege Mode</dd>
                  </>
                )}
              </dl>
              <i className="lb-check" />
            </button>
          ))}
        </div>
      </section>

      <footer className="lb-foot">
        <details className="lb-controls">
          <summary>Controls</summary>
          <Controls frame={sel.frame} compact />
        </details>
        <div className="lb-launchbar">
          <label>
            <span>
              <b>03</b> Callsign
            </span>
            <input
              value={sel.name}
              maxLength={16}
              placeholder="Pilot name"
              onChange={(e) => set({ name: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && launch()}
            />
          </label>
          <button className="lb-launch" onClick={launch}>
            LAUNCH
          </button>
        </div>
      </footer>
    </div>
  );
}
