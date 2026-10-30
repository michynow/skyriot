import { create } from 'zustand';
import {
  FRAMES,
  RESPAWN_SEC,
  SKILLS,
  TICK_HZ,
  sampleHeight,
  type NationId,
  type SimEvent,
  type SkillId,
} from '@skyriot/shared';
import { world } from '../state/world';
import { session } from '../net/session';
import { view } from './view';
import { Vector3 } from 'three';

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
export interface ChatLine {
  id: number;
  text: string;
  kind: 'chat' | 'sys';
}

export interface HudState {
  status: 'connecting' | 'playing' | 'error';
  error: string;
  frame: keyof typeof FRAMES | null;
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
  locked: boolean;
  respawnIn: number;
  rollCd: number;
  hotbar: (SkillId | null)[];
  /** 0..1 remaining fraction per slot, plus seconds. */
  cooldownFrac: number[];
  cooldownSec: number[];
  killfeed: KillEntry[];
  damageFlashes: DamageFlash[];
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
  locked: false,
  respawnIn: 0,
  rollCd: 0,
  hotbar: Array(10).fill(null),
  cooldownFrac: Array(10).fill(0),
  cooldownSec: Array(10).fill(0),
  killfeed: [],
  damageFlashes: [],
  hitNonce: 0,
  hitDeflected: false,
  pingMs: 0,
  chat: [],
  chatOpen: false,
  consoleLines: [],
}));

let nextId = 1;
const KILLFEED_MS = 6000;

export function addChatLine(text: string, kind: ChatLine['kind']): void {
  useHud.setState((s) => ({ chat: [...s.chat.slice(-7), { id: nextId++, text, kind }] }));
}

export function addConsoleLine(text: string): void {
  useHud.setState((s) => ({ consoleLines: [...s.consoleLines.slice(-60), text] }));
  addChatLine(text, 'sys');
}

const _d = new Vector3();

/** Route sim events the HUD cares about (killfeed, hit marker, damage direction). */
export function handleHudEvent(ev: SimEvent): void {
  const ownId = world.ownId;
  if (ev.type === 'hit') {
    if (ev.attacker === ownId) useHud.setState((s) => ({ hitNonce: s.hitNonce + 1, hitDeflected: ev.deflected }));
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
      useHud.setState((s) => ({ damageFlashes: [...s.damageFlashes.slice(-5), { id, angleDeg }] }));
      setTimeout(
        () => useHud.setState((s) => ({ damageFlashes: s.damageFlashes.filter((f) => f.id !== id) })),
        900,
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
  }
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
        locked,
        respawnIn: own.alive ? 0 : Math.min(RESPAWN_SEC, Math.max(0, (own.respawnAtTick - tick) / TICK_HZ)),
        rollCd: Math.min(1, own.rollCooldownTicks / Math.max(1, def.rollCooldownSec * TICK_HZ)),
        hotbar,
        cooldownFrac: cd.map((c, i) => Math.min(1, c / total[i]!)),
        cooldownSec: cd.map((c) => c / TICK_HZ),
      });
    }
    useHud.setState(patch);
  }, 100);
  return () => clearInterval(timer);
}
