import { useEffect, useRef } from 'react';
import { FRAMES, SKILLS } from '@skyriot/shared';
import { useShallow } from 'zustand/react/shallow';
import { session } from '../net/session';
import { inputState, setTyping } from '../input/input';
import { addChatLine, startHudFeed, useHud } from './hudStore';
import { Floaters } from './Floaters';
import { SkillIcon } from './icons';
import { Radar } from './Radar';
import { NATION_COLOR, Reticles } from './Reticles';
import './hud.css';

const ARC = 0.75; // 270-degree gauges

function Arc({ r, pct, cls, width = 9 }: { r: number; pct: number; cls: string; width?: number }) {
  const v = Math.max(0, Math.min(1, pct)) * ARC * 100;
  return (
    <>
      <circle r={r} pathLength={100} className="arc-bg" strokeWidth={width} strokeDasharray={`${ARC * 100} 100`} transform="rotate(135)" />
      <circle r={r} pathLength={100} className={`arc ${cls}`} strokeWidth={width} strokeDasharray={`${v} 100`} transform="rotate(135)" />
    </>
  );
}

/** Concentric gauge: shield outside, HP inside, fuel innermost; numbers in the middle. */
function Gauge() {
  const g = useHud(
    useShallow((h) => ({ hp: h.hp, maxHp: h.maxHp, shield: h.shield, maxShield: h.maxShield, fuel: h.fuel, taken: h.taken, impact: h.impactText, nonce: h.impactNonce })),
  );
  return (
    <div className="gauge">
      <svg viewBox="-100 -100 200 200">
        <Arc r={88} pct={g.shield / Math.max(1, g.maxShield)} cls="sh" />
        <Arc r={74} pct={g.hp / Math.max(1, g.maxHp)} cls={g.hp / g.maxHp < 0.3 ? 'hp low' : 'hp'} />
        <Arc r={62} pct={g.fuel} cls="fu" width={5} />
      </svg>
      <div className="g-num">
        <b className="hp">{Math.round(g.hp)}</b>
        <span className="sh">{Math.round(g.shield)}</span>
      </div>
      <div className="g-lbl">
        <i className="sh">SHIELD</i>
        <i className="hp">HULL</i>
        <i className="fu">FUEL</i>
      </div>
      {g.taken.map((t) => (
        <div key={t.id} className="taken" style={{ left: `calc(50% + ${t.x}px)` }}>
          {t.text}
        </div>
      ))}
      {g.nonce > 0 && (
        <div key={g.nonce} className="impact">
          {g.impact}
        </div>
      )}
    </div>
  );
}

function Ammo({ side }: { side: 1 | 2 }) {
  const a = useHud(
    useShallow((h) =>
      side === 1
        ? { n: h.ammo1, max: h.ammoMax1, name: h.weapon1, key: 'LMB' }
        : { n: h.ammo2, max: h.ammoMax2, name: h.weapon2, key: 'RMB' },
    ),
  );
  const low = a.n / Math.max(1, a.max) < 0.2;
  return (
    <div className={`ammo a${side} ${low ? 'low' : ''}`}>
      <small>
        {a.key} · {a.name}
      </small>
      <b>
        {Math.round(a.n)}
        <em>/{a.max}</em>
      </b>
      {a.n <= 0 && <span className="resup">RESUPPLY AT LAUNCH DECK</span>}
    </div>
  );
}

function Status() {
  const s = useHud(
    useShallow((h) => ({ frame: h.frame, name: h.name, nation: h.nation, speed: h.speed, altitude: h.altitude, rollCd: h.rollCd, grounded: h.grounded })),
  );
  return (
    <div className="status" style={{ ['--c' as string]: s.nation ? NATION_COLOR[s.nation] : '#fff' }}>
      <div className="st-head">
        {s.frame ? FRAMES[s.frame].name.toUpperCase() : '—'} <small>{s.name}</small>
      </div>
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
      {s.grounded && <div className="grounded">GROUNDED</div>}
    </div>
  );
}

function Hotbar() {
  const { hotbar, frac, sec } = useHud(useShallow((h) => ({ hotbar: h.hotbar, frac: h.cooldownFrac, sec: h.cooldownSec })));
  return (
    <div className="hotbar">
      {hotbar.map((id, i) => {
        const skill = id ? SKILLS[id] : undefined;
        const cd = frac[i] ?? 0;
        return (
          <div key={i} className={`slot ${skill ? '' : 'empty'} ${skill?.kind ?? ''} ${cd > 0 ? 'cooling' : ''}`} title={skill ? `${skill.name}: ${skill.description}` : ''}>
            {id && <SkillIcon id={id} />}
            <span className="slot-k">{(i + 1) % 10}</span>
            <div className="slot-cd" style={{ ['--p' as string]: `${cd * 360}deg` }} />
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
  const h = useHud(
    useShallow((x) => ({
      locked: x.locked, alive: x.alive, respawnIn: x.respawnIn, sieged: x.sieged, grounded: x.grounded, canSiege: x.canSiege,
      flashes: x.damageFlashes, hitNonce: x.hitNonce, hitDeflected: x.hitDeflected, ping: x.pingMs, frame: x.frame,
      docked: x.docked, resupply: x.resupply, resupplied: x.resupplied, crashed: x.crashed,
    })),
  );
  const fullyStocked = h.resupplied || h.resupply >= 0.999;
  return (
    <>
      {h.locked && h.alive && <div className="warn-lock">MISSILE LOCK</div>}
      {h.sieged && (
        <div className="siege">
          {h.grounded ? 'SIEGE (GROUND) ×1.5 DMG · RANGE ×1.4' : 'SIEGE (AIR) ×1.15 DMG · RANGE ×1.15 · LOCK CONE ×1.4'}
        </div>
      )}
      {h.canSiege && !h.sieged && <div className="siege off">SHIFT: SIEGE</div>}
      {h.flashes.map((f) => (
        <div key={f.id} className="dmg" style={{ transform: `rotate(${f.angleDeg}deg)` }}>
          <i />
        </div>
      ))}
      {h.hitNonce > 0 && <div key={h.hitNonce} className={`hitmark ${h.hitDeflected ? 'defl' : ''}`} />}
      {h.docked && h.alive && (
        <div className="dock">
          {fullyStocked ? (
            <b className="ready">PRESS R TO LAUNCH</b>
          ) : (
            <>
              <b>DOCKED — RESUPPLYING…</b>
              <div className="dock-bar">
                <div style={{ width: `${h.resupply * 100}%` }} />
              </div>
            </>
          )}
        </div>
      )}
      {!h.alive && (
        <div className="respawn">
          <h2>SHIP DESTROYED</h2>
          {h.crashed && <p className="crash">Crashed into terrain</p>}
          <p>Redeploying in {h.respawnIn.toFixed(1)}s</p>
        </div>
      )}
      <div className="ping">{h.ping} ms</div>
    </>
  );
}

export function Hud() {
  useEffect(() => startHudFeed(), []);
  return (
    <div className="hud">
      <Reticles />
      <Warnings />
      <Floaters />
      <Status />
      <Gauge />
      <Ammo side={1} />
      <Ammo side={2} />
      <Hotbar />
      <Killfeed />
      <Chat />
      <Radar />
    </div>
  );
}
