import { useEffect, useRef, useState } from 'react';
import { FRAMES, SKILLS } from '@skyriot/shared';
import { useShallow } from 'zustand/react/shallow';
import { session } from '../net/session';
import { inputState, setTyping } from '../input/input';
import { addChatLine, startHudFeed, useHud } from './hudStore';
import { Floaters } from './Floaters';
import { useSettings } from '../ui/settings';
import { IconDefs, SkillIcon } from './icons';
import { Incoming } from './Incoming';
import { Radar } from './Radar';
import { NATION_COLOR, Reticles } from './Reticles';
import { EscMenu, openEscMenu } from '../ui/EscMenu';
import './hud.css';

const ARC = 0.75; // 270-degree gauges

function Arc({ r, pct, cls, width = 9 }: { r: number; pct: number; cls: string; width?: number }) {
  const v = Math.max(0, Math.min(1, pct)) * ARC * 100;
  return (
    <>
      <circle
        r={r}
        pathLength={100}
        className="arc-bg"
        strokeWidth={width}
        strokeDasharray={`${ARC * 100} 100`}
        transform="rotate(135)"
      />
      <circle
        r={r}
        pathLength={100}
        className={`arc ${cls}`}
        strokeWidth={width}
        strokeDasharray={`${v} 100`}
        transform="rotate(135)"
      />
    </>
  );
}

/** Concentric gauge: shield outside, HP inside, fuel innermost; numbers in the middle. */
function Gauge() {
  const g = useHud(
    useShallow((h) => ({
      hp: h.hp,
      maxHp: h.maxHp,
      shield: h.shield,
      maxShield: h.maxShield,
      fuel: h.fuel,
      taken: h.taken,
      impact: h.impactText,
      nonce: h.impactNonce,
    })),
  );
  return (
    <div className="gauge">
      <svg viewBox="-100 -100 200 200">
        <Arc r={88} pct={g.shield / Math.max(1, g.maxShield)} cls="sh" />
        <Arc
          r={74}
          pct={g.hp / Math.max(1, g.maxHp)}
          cls={g.hp / g.maxHp < 0.3 ? 'hp low' : 'hp'}
        />
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

function Status() {
  const s = useHud(
    useShallow((h) => ({
      frame: h.frame,
      name: h.name,
      nation: h.nation,
      speed: h.speed,
      altitude: h.altitude,
      rollCd: h.rollCd,
      grounded: h.grounded,
    })),
  );
  return (
    <div
      className="status"
      style={{ ['--c' as string]: s.nation ? NATION_COLOR[s.nation] : '#fff' }}
    >
      <div className="st-head">
        {s.frame ? FRAMES[s.frame].name.toUpperCase() : '—'} <small>{s.name}</small>
      </div>
      <div className="readouts">
        <div className="ro">
          <small>SPEED</small>
          <b>{Math.round(s.speed)}</b>
          <em>m/s</em>
        </div>
        <div className="ro">
          <small>ALT</small>
          <b>{Math.round(s.altitude)}</b>
          <em>m</em>
        </div>
        <div
          className={`roll ${s.rollCd <= 0 ? 'ready' : ''}`}
          title="Barrel roll: double-tap A / D"
        >
          <div className="roll-bar">
            <i style={{ width: `${(1 - s.rollCd) * 100}%` }} />
          </div>
          <small>{s.rollCd <= 0 ? 'ROLL READY' : 'ROLL'}</small>
        </div>
      </div>
      {s.grounded && <div className="grounded">GROUNDED</div>}
    </div>
  );
}

const mmss = (sec: number) =>
  `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;

function Hotbar() {
  const { hotbar, frac, sec, toggles, fx } = useHud(
    useShallow((h) => ({
      hotbar: h.hotbar,
      frac: h.cooldownFrac,
      sec: h.cooldownSec,
      toggles: h.toggles,
      fx: h.skillFx,
    })),
  );
  const [tip, setTip] = useState<{ i: number; left: number } | null>(null);
  const tipSkill = tip ? SKILLS[hotbar[tip.i] ?? ''] : undefined;
  return (
    <div className="hotbar" data-ui>
      {hotbar.map((id, i) => {
        const skill = id ? SKILLS[id] : undefined;
        const cd = frac[i] ?? 0;
        const on =
          !!skill &&
          skill.kind === 'toggle' &&
          !!skill.toggleGroup &&
          toggles[skill.toggleGroup] === id;
        const punched = fx?.slot === i;
        return (
          <div
            key={`${i}-${punched ? fx!.nonce : 0}`}
            className={`slot ${skill ? '' : 'empty'} ${skill?.kind ?? ''} ${cd > 0 ? 'cooling' : ''} ${on ? 'on' : ''} ${punched ? 'punch' : ''}`}
            onMouseEnter={(e) =>
              skill &&
              !document.pointerLockElement &&
              setTip({ i, left: e.currentTarget.offsetLeft + e.currentTarget.offsetWidth / 2 })
            }
            onMouseLeave={() => setTip(null)}
          >
            {id && <SkillIcon id={id} />}
            <span className="slot-k">{(i + 1) % 10}</span>
            {on && <span className="slot-on">ON</span>}
            <div className="slot-cd" style={{ ['--p' as string]: `${cd * 360}deg` }} />
            {(sec[i] ?? 0) > 0.05 && <span className="slot-t">{(sec[i] ?? 0).toFixed(1)}</span>}
          </div>
        );
      })}
      {tip && tipSkill && (
        <div className="tooltip" style={{ left: tip.left }}>
          <b>{tipSkill.name}</b>
          <p>{tipSkill.description}</p>
          <small>
            {tipSkill.durationSec > 0 && `Duration ${mmss(tipSkill.durationSec)}  ·  `}Cooldown{' '}
            {mmss(tipSkill.cooldownSec)}
          </small>
        </div>
      )}
    </div>
  );
}

/** Active buffs under the top-left gauge: icon, timer bar, m:ss, ally marker; pulses under 10 s. */
function BuffBar() {
  const buffs = useHud((h) => h.buffs);
  return (
    <div className="buffbar">
      {buffs.map((b, i) => (
        <div
          key={`${b.skill}${i}`}
          className={`buff ${b.left < 10 ? 'expiring' : ''}`}
          title={SKILLS[b.skill]?.name}
        >
          <SkillIcon id={b.skill} />
          {b.ally && <i className="buff-ally" />}
          <div className="buff-t">
            <div style={{ width: `${Math.min(100, (b.left / b.total) * 100)}%` }} />
          </div>
          <small>{mmss(b.left)}</small>
        </div>
      ))}
    </div>
  );
}

/** Activation feedback: centred name banner plus the icon flying from its slot to the buff bar. */
function SkillFx() {
  const fx = useHud((h) => h.skillFx);
  const [fly, setFly] = useState<{ nonce: number; skill: string; x: number; y: number } | null>(
    null,
  );
  useEffect(() => {
    if (!fx) return;
    const slot = document.querySelectorAll('.hotbar .slot')[fx.slot]?.getBoundingClientRect();
    if (slot)
      setFly({
        nonce: fx.nonce,
        skill: fx.skill,
        x: slot.left + slot.width / 2,
        y: slot.top + slot.height / 2,
      });
  }, [fx]);
  if (!fx) return null;
  return (
    <>
      <div key={`b${fx.nonce}`} className="skill-banner">
        {SKILLS[fx.skill]?.name.toUpperCase()}
      </div>
      {fly && fly.nonce === fx.nonce && (
        <div
          key={`f${fly.nonce}`}
          className="skill-fly"
          style={{
            left: fly.x,
            top: fly.y,
            ['--dx' as string]: `${70 - fly.x}px`,
            ['--dy' as string]: `${250 - fly.y}px`,
          }}
        >
          <SkillIcon id={fly.skill} />
        </div>
      )}
    </>
  );
}

function Killfeed() {
  const feed = useHud((h) => h.killfeed);
  return (
    <div className="killfeed">
      {feed.map((k) => (
        <div key={k.id}>
          <b style={{ color: k.killerNation ? NATION_COLOR[k.killerNation] : '#ccc' }}>
            {k.killer}
          </b>
          <span> ✦ </span>
          <b style={{ color: k.victimNation ? NATION_COLOR[k.victimNation] : '#ccc' }}>
            {k.victim}
          </b>
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
                if (!text.startsWith('/'))
                  addChatLine(`${useHud.getState().name}: ${text}`, 'chat');
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
      locked: x.locked,
      alive: x.alive,
      respawnIn: x.respawnIn,
      sieged: x.sieged,
      grounded: x.grounded,
      evadedNonce: x.evadedNonce,
      outOfBounds: x.outOfBounds,
      flashes: x.damageFlashes,
      hitNonce: x.hitNonce,
      hitDeflected: x.hitDeflected,
      frame: x.frame,
      docked: x.docked,
      resupply: x.resupply,
      resupplied: x.resupplied,
      crashed: x.crashed,
    })),
  );
  const fullyStocked = h.resupplied || h.resupply >= 0.999;
  return (
    <>
      {h.locked && h.alive && <div className="warn-lock">MISSILE LOCK</div>}
      {h.outOfBounds && h.alive && <div className="oob">RETURN TO COMBAT AREA</div>}
      {h.evadedNonce > 0 && (
        <div key={h.evadedNonce} className="evaded">
          EVADED
        </div>
      )}
      {h.sieged && (
        <div className="siege">
          {h.grounded
            ? 'SIEGE (GROUND) ×1.5 DMG · RANGE ×1.4'
            : 'SIEGE (AIR) ×1.15 DMG · RANGE ×1.15 · LOCK CONE ×1.4'}
        </div>
      )}
      {h.flashes.map((f) => (
        <div key={f.id} className="dmg" style={{ transform: `rotate(${f.angleDeg}deg)` }}>
          <i />
        </div>
      ))}
      {h.hitNonce > 0 && (
        <div key={h.hitNonce} className={`hitmark ${h.hitDeflected ? 'defl' : ''}`} />
      )}
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
    </>
  );
}

function TopBar() {
  const muted = useSettings((s) => s.muted);
  const ping = useHud((h) => h.pingMs);
  return (
    <div className="topbar" data-ui>
      <span className="ping">{ping} ms</span>
      {muted && <span className="muted">MUTED</span>}
      <button onClick={openEscMenu}>
        MENU <kbd>ESC</kbd>
      </button>
    </div>
  );
}

export function Hud({ onLeave }: { onLeave(): void }) {
  useEffect(() => {
    const fit = () => {
      const scale = Math.max(
        0.55,
        Math.min(1, window.innerHeight / 1000, window.innerWidth / 1700),
      );
      document.documentElement.style.setProperty('--hud-scale', String(scale));
    };
    fit();
    window.addEventListener('resize', fit);
    const stop = startHudFeed();
    return () => {
      window.removeEventListener('resize', fit);
      stop();
    };
  }, []);
  return (
    <div className="hud">
      <IconDefs />
      <TopBar />
      <Reticles />
      <Warnings />
      <Floaters />
      <Status />
      <Gauge />
      <BuffBar />
      <SkillFx />
      <Incoming />
      <Hotbar />
      <Killfeed />
      <Chat />
      <Radar />
      <EscMenu onLeave={onLeave} />
    </div>
  );
}
