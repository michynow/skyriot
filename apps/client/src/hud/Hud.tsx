import { Fragment, useEffect, useRef, useState } from 'react';
import { ENGINES, FRAMES, HOTBAR_BAR_SLOTS, MAPS, SKILLS, WEAPONS } from '@skyriot/shared';
import { useShallow } from 'zustand/react/shallow';
import { session } from '../net/session';
import { inputState, setTyping } from '../input/input';
import { addChatLine, startHudFeed, useHud } from './hudStore';
import { Floaters } from './Floaters';
import { useSettings } from '../ui/settings';
import { IconDefs, SkillIcon } from './icons';
import { Incoming } from './Incoming';
import { ThreatRing } from './ThreatRing';
import { Radar } from './Radar';
import { NATION_COLOR, Reticles } from './Reticles';
import { EscMenu, openEscMenu } from '../ui/EscMenu';
import { FlightTapes } from './FlightTapes';
import { Launch } from './Launch';
import { BattleBanner, BattleEnd, Objectives, StructureMarkers } from './Objectives';
import { world } from '../state/world';
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

/** Half ring from the bottom up one side: left = hull, right = shield (mirrored). */
function Half({ r, pct, cls, side }: { r: number; pct: number; cls: string; side: 1 | -1 }) {
  const v = Math.max(0, Math.min(1, pct)) * 49;
  const tf = side === 1 ? 'rotate(90)' : 'scale(-1,1) rotate(90)';
  return (
    <>
      <circle
        r={r}
        pathLength={100}
        className="arc-bg"
        strokeWidth={13}
        strokeDasharray="49 100"
        transform={tf}
      />
      <circle
        r={r}
        pathLength={100}
        className={`arc ${cls}`}
        strokeWidth={13}
        strokeDasharray={`${v} 100`}
        transform={tf}
      />
    </>
  );
}

/** Tick on the 270-degree speed ring at fraction `f` of boost speed. */
function Tick({ f, r }: { f: number; r: number }) {
  const a = ((135 + f * 270) * Math.PI) / 180;
  const c = Math.cos(a),
    s = Math.sin(a);
  return (
    <line className="g-tick" x1={c * (r - 6)} y1={s * (r - 6)} x2={c * (r + 6)} y2={s * (r + 6)} />
  );
}

/**
 * Status dial: hull (left half, red) and shield (right half, blue) around a speed ring that spans the engine's
 * envelope (ticks at min and max, past max = boost), fuel innermost; speed readout in the middle.
 */
function Gauge() {
  const g = useHud(
    useShallow((h) => ({
      frame: h.frame,
      hp: h.hp,
      maxHp: h.maxHp,
      shield: h.shield,
      maxShield: h.maxShield,
      fuel: h.fuel,
      speed: h.speed,
      halted: h.halted,
      taken: h.taken,
      impact: h.impactText,
      nonce: h.impactNonce,
    })),
  );
  const fd = g.frame ? FRAMES[g.frame] : null;
  const top = fd?.boostSpeed ?? 1;
  const boosting = !!fd && g.speed > fd.maxSpeed * 1.02;
  const reverse = g.speed < -1;
  return (
    <div className="gauge">
      <svg viewBox="-100 -100 200 200">
        <Half
          r={86}
          pct={g.hp / Math.max(1, g.maxHp)}
          cls={g.hp / g.maxHp < 0.3 ? 'hp low' : 'hp'}
          side={1}
        />
        <Half r={86} pct={g.shield / Math.max(1, g.maxShield)} cls="sh" side={-1} />
        <Arc
          r={64}
          pct={Math.abs(g.speed) / top}
          cls={boosting ? 'spd boost' : reverse ? 'spd rev' : 'spd'}
          width={7}
        />
        {fd && <Tick f={fd.minSpeed / top} r={64} />}
        {fd && <Tick f={fd.maxSpeed / top} r={64} />}
        <Arc r={52} pct={g.fuel} cls={g.fuel < 0.2 ? 'fu low' : 'fu'} width={4} />
      </svg>
      <div className="g-num">
        <small className="g-cap">
          {g.halted ? 'HALTED' : reverse ? 'REVERSE' : boosting ? 'BOOST' : 'SPEED'}
        </small>
        <b className={boosting ? 'boost' : ''}>{Math.abs(Math.round(g.speed))}</b>
        <div className="g-pair">
          <span className="hp">{Math.round(g.hp)}</span>
          <span className="sh">{Math.round(g.shield)}</span>
        </div>
      </div>
      <div className="g-lbl">
        <i className="hp">HULL</i>
        <i className="fu">FUEL {Math.round(g.fuel * 100)}%</i>
        <i className="sh">SHIELD</i>
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

const BAR_NAMES = ['Core', 'Kit', 'Utility'];

function Hotbar() {
  const { all, bar, frac, sec, toggles, fx } = useHud(
    useShallow((h) => ({
      all: h.hotbar,
      bar: h.hotbarBar,
      frac: h.cooldownFrac,
      sec: h.cooldownSec,
      toggles: h.toggles,
      fx: h.skillFx,
    })),
  );
  const [tip, setTip] = useState<{ i: number; left: number } | null>(null);
  // Slots are flattened bars; i below is the absolute slot, i - first the key on this bar.
  const first = bar * HOTBAR_BAR_SLOTS;
  const hotbar = all.slice(first, first + HOTBAR_BAR_SLOTS);
  const tipSkill = tip ? SKILLS[all[tip.i] ?? ''] : undefined;
  return (
    <div className="hotbar" data-ui>
      <div className="hotbar-tabs">
        {Array.from({ length: Math.ceil(all.length / HOTBAR_BAR_SLOTS) }, (_, b) => (
          <span key={b} className={b === bar ? 'on' : ''}>
            F{b + 1} {BAR_NAMES[b]}
          </span>
        ))}
        <kbd>C</kbd>
      </div>
      {hotbar.map((id, k) => {
        const i = first + k;
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
            data-slot={i}
            className={`slot ${skill ? '' : 'empty'} ${skill?.kind ?? ''} ${cd > 0 ? 'cooling' : ''} ${on ? 'on' : ''} ${punched ? 'punch' : ''}`}
            onMouseEnter={(e) =>
              skill &&
              !document.pointerLockElement &&
              setTip({ i, left: e.currentTarget.offsetLeft + e.currentTarget.offsetWidth / 2 })
            }
            onMouseLeave={() => setTip(null)}
          >
            {id && <SkillIcon id={id} />}
            <span className="slot-k">{(k + 1) % 10}</span>
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
    const slot = document
      .querySelector(`.hotbar .slot[data-slot="${fx.slot}"]`)
      ?.getBoundingClientRect();
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
        <div key={k.id} className={k.mine ? 'mine' : undefined}>
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

const STREAK_WORD = ['', '', 'DOUBLE', 'TRIPLE', 'QUAD'];

/** Kill confirmation under the crosshair, plus the kill hit marker; remounts (restarts its fade) per kill. */
function KillConfirm() {
  const k = useHud((h) => h.killConfirm);
  if (!k) return null;
  const word = k.streak > 1 ? (STREAK_WORD[k.streak] ?? `${k.streak}× CHAIN`) : '';
  return (
    <Fragment key={k.nonce}>
      <div className="hitmark kill" />
      <div className="kill-confirm">
        {word && <i>{word}</i>}
        <b>DESTROYED</b>
        <span>
          {k.victim}
          {k.reward && <em> {k.reward}</em>}
        </span>
      </div>
    </Fragment>
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
      launchPhase: x.launchPhase,
      incomingDist: x.incomingDist,
      halted: x.halted,
      haltPrompt: x.haltPrompt,
      rollDeniedSec: x.rollDeniedSec,
      overDeck: x.overDeck,
    })),
  );
  // In the hangar / tunnel the Ship is hidden: no lock, bounds or dock warnings apply.
  const flying = h.alive && (h.launchPhase === 'none' || h.launchPhase === 'catapult');
  const fullyStocked = h.resupplied || h.resupply >= 0.999;
  return (
    <>
      {flying && h.incomingDist >= 0 && <div className="alarm missile" />}
      {flying && h.locked && h.incomingDist < 0 && <div className="alarm lock" />}
      {h.locked && flying && h.incomingDist < 0 && (
        <div className="warn-lock">LOCKED ON — EVADE</div>
      )}
      {h.haltPrompt && !h.halted && flying && (
        <div className="halt-ask">
          HALT IN PLACE? <kbd>B</kbd> / <kbd>Y</kbd> confirm
        </div>
      )}
      {h.halted && flying && <Loadout />}
      {h.rollDeniedSec > 0 && flying && (
        <div className="roll-denied">ROLL RECHARGING {h.rollDeniedSec.toFixed(1)}s</div>
      )}
      {h.overDeck && flying && !h.docked && (
        <div className="deck-hint">
          HOLD <kbd>S</kbd> TO LAND
        </div>
      )}
      {h.outOfBounds && flying && (
        <div className="oob">
          {world.map?.city ? 'LEAVING CITY AIRSPACE' : 'RETURN TO COMBAT AREA'}
        </div>
      )}
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
      {h.docked && flying && (
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
    </>
  );
}

/** Halted mid-air: read-only Loadout (engine, weapons, hotbar). Swapping parts arrives with inventory (M2). */
function Loadout() {
  const frame = useHud((h) => h.frame);
  if (!frame) return null;
  const fd = FRAMES[frame];
  const engine = ENGINES[fd.engine];
  const weapons = [WEAPONS[fd.primary], WEAPONS[fd.secondary]];
  return (
    <div className="loadout" data-ui>
      <h3>
        {fd.name.toUpperCase()} <small>LOADOUT · HALTED</small>
      </h3>
      <section>
        <h4>ENGINE — {engine?.name}</h4>
        <p>
          Speed {fd.minSpeed}–{fd.maxSpeed} m/s · Boost {fd.boostSpeed} · Accel {fd.accel} · Turn{' '}
          {fd.turnRate.toFixed(2)} rad/s
        </p>
      </section>
      <section>
        <h4>WEAPONS</h4>
        {weapons.map(
          (w, i) =>
            w && (
              <p key={w.id}>
                <b>{i === 0 ? 'LMB' : 'RMB'}</b> {w.name} · {w.damage} dmg · {w.rangeM} m ·{' '}
                {i === 0 ? fd.ammo1Max : fd.ammo2Max} rds
              </p>
            ),
        )}
      </section>
      <section className="lo-skills">
        {fd.hotbar.map(
          (id, i) =>
            id && (
              <div key={i} title={SKILLS[id]?.description}>
                <SkillIcon id={id} />
                <small>
                  F{Math.floor(i / HOTBAR_BAR_SLOTS) + 1}·{((i % HOTBAR_BAR_SLOTS) + 1) % 10}{' '}
                  {SKILLS[id]?.name}
                </small>
              </div>
            ),
        )}
      </section>
      <footer>
        <kbd>B</kbd> or <kbd>W</kbd> to resume · <kbd>ESC</kbd> › HANGAR to change parts
      </footer>
    </div>
  );
}

const TIPS_KEY = 'skyriot.tips';
const TIPS_FLIGHTS = 3;
const TIPS_MS = 15000;

/** Key card for a new Pilot's first few flights; fades out after a while in the air. */
function FlightTips() {
  const flying = useHud(
    (x) => !!x.frame && x.alive && (x.launchPhase === 'none' || x.launchPhase === 'catapult'),
  );
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!flying) return;
    // Wait out the brief 'none' phase a Ship shows on join before the Launch Queue picks it up.
    const start = setTimeout(() => {
      let seen = TIPS_FLIGHTS;
      try {
        seen = Number(localStorage.getItem(TIPS_KEY)) || 0;
        localStorage.setItem(TIPS_KEY, String(seen + 1));
      } catch {
        /* storage unavailable: skip tips */
      }
      if (seen < TIPS_FLIGHTS) setShow(true);
    }, 1500);
    const end = setTimeout(() => setShow(false), TIPS_MS);
    return () => {
      clearTimeout(start);
      clearTimeout(end);
      setShow(false);
    };
  }, [flying]);
  if (!show) return null;
  return (
    <div className="tips">
      <h4>FLIGHT CONTROLS</h4>
      <p>
        <kbd>MOUSE</kbd> steer: the cursor is a stick, centre it to fly straight
      </p>
      <p>
        <kbd>W</kbd> hold for speed · <kbd>SPACE</kbd> boost · <kbd>S</kbd> slow
      </p>
      <p>
        <kbd>LMB</kbd> guns · <kbd>RMB</kbd> missile (locks the enemy in the crosshair)
      </p>
      <p>
        <kbd>A</kbd>
        <kbd>D</kbd> strafe, double-tap to Barrel Roll
      </p>
      <p>
        <kbd>ESC</kbd> menu, controls and Hangar
      </p>
    </div>
  );
}

/** Cities have no Battle panel: say where we are and where the shop is instead. */
function CityBanner() {
  const city = world.map?.city ? world.map : null;
  if (!city) return null;
  const gate = city.gates?.[0];
  return (
    <div className="city-banner">
      <b>{city.name.toUpperCase()} · SAFE ZONE</b>
      <span>
        Shop and Loadout: <kbd>ESC</kbd> › HANGAR
        {gate && ` · fly through the Gate to return to ${MAPS[gate.to]?.name ?? gate.to}`}
      </span>
    </div>
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
      <ThreatRing />
      <StructureMarkers />
      <FlightTapes />
      <Warnings />
      <Floaters />
      <Status />
      {world.map?.city ? <CityBanner /> : <Objectives />}
      <FlightTips />
      <BattleBanner />
      <Launch />
      <BattleEnd />
      <Gauge />
      <BuffBar />
      <SkillFx />
      <Incoming />
      <Hotbar />
      <Killfeed />
      <KillConfirm />
      <Chat />
      <Radar />
      <EscMenu onLeave={onLeave} />
    </div>
  );
}
