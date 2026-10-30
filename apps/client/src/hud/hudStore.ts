import { create } from 'zustand';
import { Vector3 } from 'three';
import {
  FRAMES,
  RESPAWN_SEC,
  SKILLS,
  TICK_HZ,
  WEAPONS,
  sampleHeight,
  type FrameId,
  type LaunchPhase,
  type NationId,
  type ShipState,
  type SimEvent,
  type SkillId,
  type StructureState,
} from '@skyriot/shared';
import { world } from '../state/world';
import { session } from '../net/session';
import { view } from './view';
import { pushFloater } from './Floaters';

export interface KillEntry {
  id: number;
  killer: string;
  killerNation: NationId | null;
  victim: string;
  victimNation: NationId | null;
  at: number;
}
export interface DamageFlash {
  id: number;
  angleDeg: number;
}
export interface TakenNumber {
  id: number;
  text: string;
  x: number;
}
export interface BuffView {
  skill: SkillId;
  ally: boolean;
  left: number;
  total: number;
}
export interface ChatLine {
  id: number;
  text: string;
  kind: 'chat' | 'sys';
}
/** One Base as the objectives panel shows it. */
export interface BaseView {
  shield: boolean;
  stations: boolean[];
  coreHp: number;
  coreMax: number;
  turretsAlive: number;
  turretsTotal: number;
}
export interface Banner {
  nonce: number;
  text: string;
  sub: string;
  kind: 'good' | 'bad' | 'neutral';
}

export interface HudState {
  status: 'connecting' | 'playing' | 'error';
  error: string;
  frame: FrameId | null;
  nation: NationId | null;
  name: string;
  alive: boolean;
  hp: number;
  maxHp: number;
  shield: number;
  maxShield: number;
  fuel: number;
  speed: number;
  altitude: number;
  sieged: boolean;
  grounded: boolean;
  outOfBounds: boolean;
  locked: boolean;
  respawnIn: number;
  rollCd: number;
  ammo1: number;
  ammo2: number;
  ammoMax1: number;
  ammoMax2: number;
  weapon1: string;
  weapon2: string;
  weaponId1: string;
  weaponId2: string;
  evadedNonce: number;
  buffs: BuffView[];
  toggles: Record<string, string>;
  skillFx: { nonce: number; slot: number; skill: SkillId } | null;
  docked: boolean;
  /** 0..1 resupply fill (average of both ammo counters) while docked. */
  resupply: number;
  resupplied: boolean;
  crashed: boolean;
  impactText: string;
  impactNonce: number;
  hotbar: (SkillId | null)[];
  /** 0..1 remaining fraction per slot, plus seconds. */
  cooldownFrac: number[];
  cooldownSec: number[];
  killfeed: KillEntry[];
  damageFlashes: DamageFlash[];
  taken: TakenNumber[];
  hitNonce: number;
  hitDeflected: boolean;
  pingMs: number;
  chat: ChatLine[];
  chatOpen: boolean;
  consoleLines: string[];
  stalled: boolean;
  launchPhase: LaunchPhase;
  queuePos: number;
  tunnel: number;
  launchSec: number;
  /** Names of the Ships ahead of us in the Launch Queue. */
  queueAhead: string[];
  launchFlashNonce: number;
  /** performance.now() of our last death; the hangar overlay fades in from the death tint. */
  diedAtMs: number;
  battlePhase: 'battle' | 'ended';
  winner: NationId | null;
  restartIn: number;
  bases: Record<NationId, BaseView>;
  objective: string;
  /** Transient defensive warning (our structure under fire) shown in place of the objective. */
  defenseWarn: string;
  banner: Banner | null;
}

const EMPTY_BASE: BaseView = { shield: true, stations: [true, true], coreHp: 1, coreMax: 1, turretsAlive: 0, turretsTotal: 0 };

export const useHud = create<HudState>(() => ({
  status: 'connecting',
  error: '',
  frame: null,
  nation: null,
  name: '',
  alive: true,
  hp: 0,
  maxHp: 1,
  shield: 0,
  maxShield: 1,
  fuel: 1,
  speed: 0,
  altitude: 0,
  sieged: false,
  grounded: false,
  outOfBounds: false,
  locked: false,
  respawnIn: 0,
  rollCd: 0,
  ammo1: 0,
  ammo2: 0,
  ammoMax1: 1,
  ammoMax2: 1,
  weapon1: '',
  weapon2: '',
  weaponId1: '',
  weaponId2: '',
  evadedNonce: 0,
  buffs: [],
  toggles: {},
  skillFx: null,
  docked: false,
  resupply: 0,
  resupplied: false,
  crashed: false,
  impactText: '',
  impactNonce: 0,
  hotbar: Array(10).fill(null),
  cooldownFrac: Array(10).fill(0),
  cooldownSec: Array(10).fill(0),
  killfeed: [],
  damageFlashes: [],
  taken: [],
  hitNonce: 0,
  hitDeflected: false,
  pingMs: 0,
  chat: [],
  chatOpen: false,
  consoleLines: [],
  stalled: false,
  launchPhase: 'none',
  queuePos: -1,
  tunnel: -1,
  launchSec: 0,
  queueAhead: [],
  launchFlashNonce: 0,
  diedAtMs: -Infinity,
  battlePhase: 'battle',
  winner: null,
  restartIn: 0,
  bases: { concord: EMPTY_BASE, vex: EMPTY_BASE },
  objective: '',
  defenseWarn: '',
  banner: null,
}));

export const isGrounded = (s: ShipState): boolean => s.grounded === true;
/** Flying (or being catapulted): reticles, tapes and markers make sense. Hangar/tunnel phases hide them. */
export const isFlying = (s: ShipState): boolean =>
  s.alive && (s.launchPhase === 'none' || s.launchPhase === 'catapult');

/** Dev-only seam: the HUD mock (dev/hudMock.ts) installs an override of the own Ship and world. */
export const devHooks: { ownShip: ((own: ShipState) => ShipState) | null } = { ownShip: null };

/** The own Ship as the HUD should see it. Every HUD reader goes through here. */
export function ownShip(): ShipState | undefined {
  const own = world.ownId ? world.ships.get(world.ownId) : undefined;
  return import.meta.env.DEV && own && devHooks.ownShip ? devHooks.ownShip(own) : own;
}

export const NATION_NAME: Record<NationId, string> = { concord: 'Aurelian Concord', vex: 'Vex Freehold' };
export const enemyOf = (n: NationId): NationId => (n === 'concord' ? 'vex' : 'concord');

/**
 * Homing missiles aimed at the own Ship, derived from projectileSpawned events (until the server sends an
 * explicit `incoming` field). Distance is estimated along the straight spawn->own line at missile speed.
 */
export interface IncomingMissile {
  id: number;
  origin: [number, number, number];
  speed: number;
  bornMs: number;
}
export const incoming = new Map<number, IncomingMissile>();

let nextId = 1;
const KILLFEED_MS = 6000;
/** Airborne Siege hint threshold (m/s): "slow/hovering". */
// Must match HOVER_MAX_SPEED in packages/shared/src/sim/constants.ts (airborne siege threshold).
const HOVER_SPEED = 15;

export function addChatLine(text: string, kind: ChatLine['kind']): void {
  useHud.setState((s) => ({ chat: [...s.chat.slice(-7), { id: nextId++, text, kind }] }));
}

export function addConsoleLine(text: string): void {
  useHud.setState((s) => ({ consoleLines: [...s.consoleLines.slice(-60), text] }));
  addChatLine(text, 'sys');
}

const _d = new Vector3();
const STRUCTURE_NAME = { core: 'Core', shieldStation: 'Shield Station', turret: 'Turret' } as const;
let defenseTimer: ReturnType<typeof setTimeout> | undefined;

export function showBanner(text: string, sub: string, kind: Banner['kind']): void {
  useHud.setState((s) => ({ banner: { nonce: (s.banner?.nonce ?? 0) + 1, text, sub, kind } }));
}

/** Both Bases from the latest snapshot; with no structures sent yet everything counts as intact. */
function baseViews(): Record<NationId, BaseView> {
  const out = { concord: { ...EMPTY_BASE }, vex: { ...EMPTY_BASE } };
  const bases = world.map?.bases;
  for (const n of ['concord', 'vex'] as const) {
    const def = bases?.[n];
    out[n].stations = def ? def.shieldStations.map(() => true) : [true, true];
    out[n].turretsTotal = out[n].turretsAlive = def?.turrets.length ?? 0;
  }
  if (world.structures.size === 0) return out;
  const stationIdx: Record<NationId, number> = { concord: 0, vex: 0 };
  for (const n of ['concord', 'vex'] as const) {
    out[n].turretsAlive = 0;
    out[n].stations = [];
  }
  const sorted = [...world.structures.values()].sort((a, b) => (a.id < b.id ? -1 : 1));
  for (const st of sorted) {
    const b = out[st.nation];
    if (st.kind === 'core') {
      b.coreHp = st.hp;
      b.coreMax = st.maxHp;
    } else if (st.kind === 'shieldStation') b.stations[stationIdx[st.nation]++] = st.alive;
    else if (st.alive) b.turretsAlive++;
  }
  for (const n of ['concord', 'vex'] as const)
    out[n].shield = world.match ? world.match.shielded[n] : out[n].stations.some(Boolean);
  return out;
}

function objectiveLine(me: NationId, bases: Record<NationId, BaseView>): string {
  const ours = bases[me];
  const theirs = bases[enemyOf(me)];
  if (!theirs.shield && !ours.shield) return 'Both Cores exposed — strike first!';
  if (!theirs.shield) return 'Enemy Core exposed — attack!';
  if (!ours.shield) return 'Our shield is down — defend the Core!';
  if (ours.stations.some((s) => !s)) return 'One Shield Station lost — hold the other!';
  return 'Destroy the enemy Shield Stations';
}

export const structureName = (st: StructureState): string => STRUCTURE_NAME[st.kind];

/** Route sim events the HUD cares about (killfeed, hit markers, damage numbers, impacts, deck). */
export function handleHudEvent(ev: SimEvent): void {
  const ownId = world.ownId;
  if (ev.type === 'projectileSpawned') {
    if (ev.kind === 'missile' && ev.target === ownId) {
      incoming.set(ev.id, { id: ev.id, origin: [...ev.origin], speed: ev.speed, bornMs: performance.now() });
    }
    return;
  }
  if (ev.type === 'projectileExpired') {
    incoming.delete(ev.id);
    return;
  }
  if (ev.type === 'missileEvaded') {
    incoming.delete(ev.id);
    if (ev.victim === ownId) useHud.setState((st) => ({ evadedNonce: st.evadedNonce + 1 }));
    return;
  }
  if (ev.type === 'skillUsed' && ev.id === ownId) {
    useHud.setState((st) => ({ skillFx: { nonce: (st.skillFx?.nonce ?? 0) + 1, slot: ev.slot, skill: ev.skill } }));
    return;
  }
  if (ev.type === 'hit') incoming.delete(ev.projectile);
  if (ev.type === 'hit') {
    if (ev.attacker === ownId) {
      useHud.setState((s) => ({ hitNonce: s.hitNonce + 1, hitDeflected: ev.deflected }));
      const victim = world.ships.get(ev.victim);
      // Shield-vs-HP is inferred from the victim's last known shield (snapshot lag makes this approximate).
      pushFloater(ev.pos, ev.deflected ? 'DEFLECT' : String(Math.round(ev.damage)), ev.deflected ? 'defl' : (victim?.shield ?? 0) > 1 ? 'shield' : 'hp');
    }
    if (ev.victim === ownId) {
      const attacker = world.ships.get(ev.attacker);
      const own = ownId ? world.ships.get(ownId) : undefined;
      let angleDeg = 0;
      if (attacker && own && view.camera) {
        _d.set(attacker.pos[0] - own.pos[0], attacker.pos[1] - own.pos[1], attacker.pos[2] - own.pos[2]);
        _d.transformDirection(view.camera.matrixWorldInverse);
        angleDeg = (Math.atan2(_d.x, _d.y) * 180) / Math.PI;
      }
      const id = nextId++;
      const text = ev.deflected ? 'DEFLECT' : `-${Math.round(ev.damage)}`;
      useHud.setState((s) => ({
        damageFlashes: [...s.damageFlashes.slice(-5), { id, angleDeg }],
        taken: [...s.taken.slice(-5), { id, text, x: Math.round((Math.random() - 0.5) * 60) }],
      }));
      setTimeout(
        () => useHud.setState((s) => ({ damageFlashes: s.damageFlashes.filter((f) => f.id !== id), taken: s.taken.filter((t) => t.id !== id) })),
        1100,
      );
    }
  } else if (ev.type === 'shipDestroyed') {
    const v = world.ships.get(ev.victim);
    const k = ev.killer ? world.ships.get(ev.killer) : undefined;
    const entry: KillEntry = {
      id: nextId++,
      killer: k?.name ?? (ev.killer ? 'Unknown' : 'The ground'),
      killerNation: k?.nation ?? null,
      victim: v?.name ?? 'Unknown',
      victimNation: v?.nation ?? null,
      at: performance.now(),
    };
    useHud.setState((s) => ({ killfeed: [...s.killfeed.slice(-4), entry] }));
    if (ev.victim === ownId) useHud.setState({ diedAtMs: performance.now() });
  } else if (ev.type === 'structureDestroyed') {
    const st = world.structures.get(ev.structure);
    const k = ev.killer ? world.ships.get(ev.killer) : undefined;
    const me = ownShip()?.nation;
    if (st && k) {
      const entry: KillEntry = {
        id: nextId++,
        killer: k.name,
        killerNation: k.nation,
        victim: STRUCTURE_NAME[st.kind],
        victimNation: st.nation,
        at: performance.now(),
      };
      useHud.setState((s) => ({ killfeed: [...s.killfeed.slice(-4), entry] }));
    }
    if (st?.kind === 'shieldStation' && me) {
      const ours = st.nation === me;
      const left = [...world.structures.values()].filter((x) => x.kind === 'shieldStation' && x.nation === st.nation && x.alive && x.id !== st.id).length;
      showBanner(ours ? 'SHIELD STATION LOST' : 'SHIELD STATION DESTROYED', left > 0 ? `${left} remaining` : ours ? 'Our Core is exposed' : 'Enemy Core exposed', ours ? 'bad' : 'good');
    }
  } else if (ev.type === 'shieldDown') {
    const me = ownShip()?.nation;
    if (me) {
      const ours = ev.nation === me;
      showBanner(ours ? 'SHIELD DOWN' : 'ENEMY SHIELD DOWN', ours ? 'Defend the Core!' : 'Core exposed — attack!', ours ? 'bad' : 'good');
    }
  } else if (ev.type === 'structureHit' && !ev.shielded) {
    const st = world.structures.get(ev.structure);
    const me = ownShip()?.nation;
    if (st && st.nation === me) {
      useHud.setState({ defenseWarn: `${STRUCTURE_NAME[st.kind]} under attack` });
      clearTimeout(defenseTimer);
      defenseTimer = setTimeout(() => useHud.setState({ defenseWarn: '' }), 4000);
    }
  } else if (ev.type === 'matchStarted') {
    showBanner('BATTLE BEGINS', 'Destroy the enemy Shield Stations', 'neutral');
  } else if (ev.type === 'catapult' && ev.id === ownId) {
    useHud.setState((s) => ({ launchFlashNonce: s.launchFlashNonce + 1 }));
  } else if (ev.type === 'terrainImpact' && ev.id === ownId) {
    if (ev.bounced) {
      world.shake = 1;
      useHud.setState((s) => ({ impactText: `HULL IMPACT −${Math.round(ev.damage)}`, impactNonce: s.impactNonce + 1 }));
    } else useHud.setState({ crashed: true });
  } else if (ev.type === 'docked' && ev.id === ownId) useHud.setState({ resupplied: false });
  else if (ev.type === 'resupplied' && ev.id === ownId) useHud.setState({ resupplied: true });
  else if (ev.type === 'shipRespawned' && ev.id === ownId) useHud.setState({ crashed: false });
}

/** ~10 Hz copy of world -> HUD store. Returns stop(). */
export function startHudFeed(): () => void {
  const timer = setInterval(() => {
    const now = performance.now();
    const own = ownShip();
    const patch: Partial<HudState> = { pingMs: Math.round(session.conn?.rtt ?? 0) };
    const feed = useHud.getState().killfeed;
    if (feed.some((k) => now - k.at > KILLFEED_MS)) patch.killfeed = feed.filter((k) => now - k.at <= KILLFEED_MS);
    if (own) {
      const def = FRAMES[own.frame];
      const hotbar = def.hotbar;
      const total = hotbar.map((id) => (id ? Math.max(1, (SKILLS[id]?.cooldownSec ?? 1) * TICK_HZ) : 1));
      const cd = hotbar.map((_, i) => Math.max(0, own.cooldowns[i] ?? 0));
      const hf = world.heightfield;
      let locked = false;
      for (const s of world.ships.values()) if (s.alive && s.lockTarget === own.id) locked = true;
      const tick = session.interp?.latestTick(now) ?? own.respawnAtTick;
      const grounded = isGrounded(own);
      Object.assign(patch, {
        frame: own.frame,
        nation: own.nation,
        name: own.name,
        alive: own.alive,
        hp: own.hp,
        maxHp: own.maxHp,
        shield: own.shield,
        maxShield: own.maxShield,
        fuel: own.fuel,
        speed: own.speed,
        altitude: hf ? own.pos[1] - sampleHeight(hf, own.pos[0], own.pos[2]) : own.pos[1],
        sieged: own.sieged,
        grounded,
        outOfBounds: own.outOfBounds,
        locked,
        respawnIn: own.alive ? 0 : Math.min(RESPAWN_SEC, Math.max(0, (own.respawnAtTick - tick) / TICK_HZ)),
        rollCd: Math.min(1, own.rollCooldownTicks / Math.max(1, def.rollCooldownSec * TICK_HZ)),
        ammo1: own.ammo1,
        ammo2: own.ammo2,
        ammoMax1: def.ammo1Max,
        ammoMax2: def.ammo2Max,
        weapon1: WEAPONS[def.primary]?.name ?? '',
        weapon2: WEAPONS[def.secondary]?.name ?? '',
        weaponId1: def.primary,
        weaponId2: def.secondary,
        docked: own.docked,
        resupply: Math.min(1, (own.ammo1 / def.ammo1Max + own.ammo2 / def.ammo2Max) / 2),
        buffs: own.buffs.map((b) => ({
          skill: b.skill,
          ally: b.source !== own.id,
          left: b.ticksLeft / TICK_HZ,
          total: Math.max(1, SKILLS[b.skill]?.durationSec ?? 1),
        })),
        toggles: own.toggles,
        hotbar,
        cooldownFrac: cd.map((c, i) => Math.min(1, c / total[i]!)),
        cooldownSec: cd.map((c) => c / TICK_HZ),
        stalled: own.stalled === true && own.alive,
        launchPhase: own.launchPhase ?? 'none',
        queuePos: own.queuePos ?? -1,
        tunnel: own.tunnel ?? -1,
        launchSec: (own.launchTicks ?? 0) / TICK_HZ,
      });
      const queue = world.match?.queues[own.nation] ?? [];
      const ahead = queue.slice(0, Math.max(0, queue.indexOf(own.id))).map((id) => world.ships.get(id)?.name ?? 'Pilot');
      const prev = useHud.getState();
      if (ahead.length !== prev.queueAhead.length || ahead.some((n, i) => n !== prev.queueAhead[i])) patch.queueAhead = ahead;
      const bases = baseViews();
      const m = world.match;
      // Structures change rarely; only re-render the objectives panel when something actually did.
      if (JSON.stringify(bases) !== JSON.stringify(prev.bases)) patch.bases = bases;
      patch.battlePhase = m?.phase ?? 'battle';
      patch.winner = m?.winner ?? null;
      patch.restartIn = m?.phase === 'ended' ? Math.max(0, (m.restartAtTick - tick) / TICK_HZ) : 0;
      patch.objective = objectiveLine(own.nation, bases);
    }
    useHud.setState(patch);
  }, 100);
  return () => clearInterval(timer);
}


// Dev-only handle for poking the HUD from the console (e.g. __hud.setState({ skillFx: ... })).
if (import.meta.env.DEV) (window as unknown as { __hud: typeof useHud }).__hud = useHud;
