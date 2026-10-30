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
  type NationId,
  type ShipState,
  type SimEvent,
  type SkillId,
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
export interface ChatLine {
  id: number;
  text: string;
  kind: 'chat' | 'sys';
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
  /** Siege hint: Bulwark grounded, or airborne below hover speed. */
  canSiege: boolean;
  locked: boolean;
  respawnIn: number;
  rollCd: number;
  ammo1: number;
  ammo2: number;
  ammoMax1: number;
  ammoMax2: number;
  weapon1: string;
  weapon2: string;
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
}

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
  canSiege: false,
  locked: false,
  respawnIn: 0,
  rollCd: 0,
  ammo1: 0,
  ammo2: 0,
  ammoMax1: 1,
  ammoMax2: 1,
  weapon1: '',
  weapon2: '',
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
}));

export const isGrounded = (s: ShipState): boolean => s.grounded === true;

let nextId = 1;
const KILLFEED_MS = 6000;
/** Airborne Siege hint threshold (m/s): "slow/hovering". */
const HOVER_SPEED = 20;

export function addChatLine(text: string, kind: ChatLine['kind']): void {
  useHud.setState((s) => ({ chat: [...s.chat.slice(-7), { id: nextId++, text, kind }] }));
}

export function addConsoleLine(text: string): void {
  useHud.setState((s) => ({ consoleLines: [...s.consoleLines.slice(-60), text] }));
  addChatLine(text, 'sys');
}

const _d = new Vector3();

/** Route sim events the HUD cares about (killfeed, hit markers, damage numbers, impacts, deck). */
export function handleHudEvent(ev: SimEvent): void {
  const ownId = world.ownId;
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
    const own = world.ownId ? world.ships.get(world.ownId) : undefined;
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
        canSiege: def.canHover && own.alive && (grounded || own.speed < HOVER_SPEED),
        locked,
        respawnIn: own.alive ? 0 : Math.min(RESPAWN_SEC, Math.max(0, (own.respawnAtTick - tick) / TICK_HZ)),
        rollCd: Math.min(1, own.rollCooldownTicks / Math.max(1, def.rollCooldownSec * TICK_HZ)),
        ammo1: own.ammo1,
        ammo2: own.ammo2,
        ammoMax1: def.ammo1Max,
        ammoMax2: def.ammo2Max,
        weapon1: WEAPONS[def.primary]?.name ?? '',
        weapon2: WEAPONS[def.secondary]?.name ?? '',
        docked: own.docked,
        resupply: Math.min(1, (own.ammo1 / def.ammo1Max + own.ammo2 / def.ammo2Max) / 2),
        hotbar,
        cooldownFrac: cd.map((c, i) => Math.min(1, c / total[i]!)),
        cooldownSec: cd.map((c) => c / TICK_HZ),
      });
    }
    useHud.setState(patch);
  }, 100);
  return () => clearInterval(timer);
}

