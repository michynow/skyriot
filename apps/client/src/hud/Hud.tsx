import { useEffect, useRef } from 'react';
import { FRAMES, SKILLS } from '@skyriot/shared';
import { useShallow } from 'zustand/react/shallow';
import { session } from '../net/session';
import { inputState, setTyping } from '../input/input';
import { addChatLine, startHudFeed, useHud } from './hudStore';
import { Minimap } from './Minimap';
import { NATION_COLOR, Reticles } from './Reticles';
import './hud.css';

function Bar({ label, value, max, cls }: { label: string; value: number; max: number; cls: string }) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  return (
    <div className={`bar ${cls}`}>
      <span className="bar-l">{label}</span>
      <div className="bar-t">
        <div className="bar-f" style={{ width: `${pct}%` }} />
      </div>
      <span className="bar-v">{Math.round(value)}</span>
    </div>
  );
}

function Status() {
  const s = useHud(
    useShallow((h) => ({
      frame: h.frame, name: h.name, nation: h.nation, hp: h.hp, maxHp: h.maxHp, shield: h.shield,
      maxShield: h.maxShield, fuel: h.fuel, speed: h.speed, altitude: h.altitude, rollCd: h.rollCd,
    })),
  );
  return (
    <div className="status" style={{ ['--c' as string]: s.nation ? NATION_COLOR[s.nation] : '#fff' }}>
      <div className="st-head">
        {s.frame ? FRAMES[s.frame].name.toUpperCase() : '—'} <small>{s.name}</small>
      </div>
      <Bar label="HP" value={s.hp} max={s.maxHp} cls="hp" />
      <Bar label="SHD" value={s.shield} max={s.maxShield} cls="sh" />
      <Bar label="FUEL" value={s.fuel * 100} max={100} cls="fu" />
      <div className="readouts">
        <div>
          <b>{Math.round(s.speed)}</b> <small>m/s</small>
        </div>
        <div>
          <b>{Math.round(s.altitude)}</b> <small>m AGL</small>
        </div>
        <div className="roll" title="Barrel roll">
          <i style={{ width: `${(1 - s.rollCd) * 100}%` }} /> <small>ROLL</small>
        </div>
      </div>
    </div>
  );
}

function Hotbar() {
  const { hotbar, frac, sec } = useHud(
    useShallow((h) => ({ hotbar: h.hotbar, frac: h.cooldownFrac, sec: h.cooldownSec })),
  );
  return (
    <div className="hotbar">
      {hotbar.map((id, i) => {
        const skill = id ? SKILLS[id] : undefined;
        return (
          <div key={i} className={`slot ${skill ? '' : 'empty'} ${skill?.kind ?? ''}`} title={skill?.description}>
            <span className="slot-k">{(i + 1) % 10}</span>
            <span className="slot-n">{skill?.name ?? ''}</span>
            <div className="slot-cd" style={{ height: `${(frac[i] ?? 0) * 100}%` }} />
            {(sec[i] ?? 0) > 0.05 && <span className="slot-t">{(sec[i] ?? 0).toFixed(1)}</span>}
          </div>
        );
      })}
    </div>
  );
}

function Killfeed() {
  const feed = useHud((h) => h.killfeed);
  return (
    <div className="killfeed">
      {feed.map((k) => (
        <div key={k.id}>
          <b style={{ color: k.killerNation ? NATION_COLOR[k.killerNation] : '#ccc' }}>{k.killer}</b>
          <span> ✦ </span>
          <b style={{ color: k.victimNation ? NATION_COLOR[k.victimNation] : '#ccc' }}>{k.victim}</b>
        </div>
      ))}
    </div>
  );
}

function Chat() {
  const { lines, open } = useHud(useShallow((h) => ({ lines: h.chat, open: h.chatOpen })));
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputState.onOpenChat = () => {
      if (inputState.typing) return;
      useHud.setState({ chatOpen: true });
      setTyping(true);
    };
    return () => {
      inputState.onOpenChat = null;
      setTyping(false);
    };
  }, []);
  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);

  const close = () => {
    useHud.setState({ chatOpen: false });
    setTyping(false);
  };
  return (
    <div className="chat" data-ui>
      {lines.map((l) => (
        <div key={l.id} className={l.kind}>
          {l.text}
        </div>
      ))}
      {open && (
        <input
          ref={input}
          maxLength={200}
          placeholder="Chat, or /god /bots n /timescale x"
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Escape') close();
            if (e.key === 'Enter') {
              const text = e.currentTarget.value.trim();
              if (text) {
                session.conn?.sendChat(text);
                if (!text.startsWith('/')) addChatLine(`${useHud.getState().name}: ${text}`, 'chat');
              }
              close();
            }
          }}
          onBlur={close}
        />
      )}
    </div>
  );
}

function Warnings() {
  const { locked, alive, respawnIn, sieged, flashes, hitNonce, hitDeflected, ping, frame } = useHud(
    useShallow((h) => ({
      locked: h.locked, alive: h.alive, respawnIn: h.respawnIn, sieged: h.sieged, flashes: h.damageFlashes,
      hitNonce: h.hitNonce, hitDeflected: h.hitDeflected, ping: h.pingMs, frame: h.frame,
    })),
  );
  return (
    <>
      {locked && alive && <div className="warn-lock">MISSILE LOCK</div>}
      {sieged && <div className="siege">SIEGE MODE</div>}
      {frame === 'bulwark' && !sieged && alive && <div className="siege off">SPACE: SIEGE</div>}
      {flashes.map((f) => (
        <div key={f.id} className="dmg" style={{ transform: `rotate(${f.angleDeg}deg)` }}>
          <i />
        </div>
      ))}
      {hitNonce > 0 && <div key={hitNonce} className={`hitmark ${hitDeflected ? 'defl' : ''}`} />}
      {!alive && (
        <div className="respawn">
          <h2>SHIP DESTROYED</h2>
          <p>Redeploying in {respawnIn.toFixed(1)}s</p>
        </div>
      )}
      <div className="ping">{ping} ms</div>
    </>
  );
}

export function Hud() {
  useEffect(() => startHudFeed(), []);
  return (
    <div className="hud">
      <Reticles />
      <Warnings />
      <Status />
      <Hotbar />
      <Killfeed />
      <Chat />
      <Minimap />
    </div>
  );
}
