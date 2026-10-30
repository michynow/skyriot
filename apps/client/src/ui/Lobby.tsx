import { useState } from 'react';
import { FRAMES, RUSTWATER_CANYONS, WEAPONS, type FrameId, type JoinOptions, type NationId } from '@skyriot/shared';
import './lobby.css';

const KEY = 'skyriot.lobby';
const NATIONS: Record<NationId, { name: string; motto: string; blurb: string }> = {
  concord: {
    name: 'Aurelian Concord',
    motto: 'Order above the clouds',
    blurb: 'Gilded wings, disciplined wings. The Concord holds the high ground and never forgets a debt.',
  },
  vex: {
    name: 'Vex Freehold',
    motto: 'Nobody owns the sky',
    blurb: 'Scrapyard crowns and burning thrusters. The Freehold takes what it can fly away with.',
  },
};

const maxOf = (pick: (f: (typeof FRAMES)[FrameId]) => number) => Math.max(...Object.values(FRAMES).map(pick));

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

function Stat({ label, value, max }: { label: string; value: number; max: number }) {
  return (
    <div className="lb-stat">
      <span>{label}</span>
      <div>
        <i style={{ width: `${(value / max) * 100}%` }} />
      </div>
    </div>
  );
}

export function Lobby({ onLaunch }: { onLaunch(options: JoinOptions): void }) {
  const [sel, setSel] = useState(load);
  const set = (p: Partial<typeof sel>) => setSel((s) => ({ ...s, ...p }));

  const launch = () => {
    const name = sel.name.trim() || `Pilot${Math.floor(Math.random() * 900 + 100)}`;
    try {
      localStorage.setItem(KEY, JSON.stringify({ ...sel, name: sel.name.trim() }));
    } catch {
      /* ignore */
    }
    onLaunch({ mapId: RUSTWATER_CANYONS.id, nation: sel.nation, frame: sel.frame, name });
  };

  return (
    <div className={`lobby ${sel.nation}`}>
      <div className="lb-grid" />
      <header>
        <h1>SKY<span>RIOT</span></h1>
        <p>HANGAR — {RUSTWATER_CANYONS.name}</p>
      </header>

      <section className="lb-nations">
        {(Object.keys(NATIONS) as NationId[]).map((id) => (
          <button key={id} className={`lb-nation ${id} ${sel.nation === id ? 'on' : ''}`} onClick={() => set({ nation: id })}>
            <em>{NATIONS[id].motto}</em>
            <strong>{NATIONS[id].name}</strong>
            <span>{NATIONS[id].blurb}</span>
          </button>
        ))}
      </section>

      <section className="lb-frames">
        {Object.values(FRAMES).map((f) => (
          <button key={f.id} className={`lb-frame ${sel.frame === f.id ? 'on' : ''}`} onClick={() => set({ frame: f.id })}>
            <h3>{f.name}</h3>
            <small>{f.role}</small>
            <Stat label="ARMOR" value={f.maxHp} max={maxOf((x) => x.maxHp)} />
            <Stat label="SHIELD" value={f.maxShield} max={maxOf((x) => x.maxShield)} />
            <Stat label="SPEED" value={f.maxSpeed} max={maxOf((x) => x.maxSpeed)} />
            <Stat label="AGILITY" value={f.turnRate} max={maxOf((x) => x.turnRate)} />
            <div className="lb-wpn">
              <span>{WEAPONS[f.primary]?.name}</span>
              <span>{WEAPONS[f.secondary]?.name}</span>
              {f.canHover && <span>Siege Mode</span>}
            </div>
          </button>
        ))}
      </section>

      <div className="lb-keys">
        <span><b>MOUSE</b> steer</span><span><b>W/S</b> throttle</span><span><b>A/D</b> strafe · double-tap = roll</span>
        <span><b>Q/E</b> down/up</span><span><b>SPACE</b> boost</span><span><b>SHIFT</b> brake{sel.frame === 'bulwark' ? ' · toggle Siege' : ''}</span>
        <span><b>LMB/RMB</b> fire</span><span><b>1-0</b> hotbar</span><span><b>TAB</b> target</span><span><b>R</b> launch from deck</span>
        {sel.frame === 'bulwark' && <span className="lb-bw"><b>BULWARK</b> hold Shift/Q near ground to land · W/S drive · E/Space lift off · Shift = Siege (first-person gunner)</span>}
      </div>
      <footer>
        <label>
          CALLSIGN
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
      </footer>
    </div>
  );
}
