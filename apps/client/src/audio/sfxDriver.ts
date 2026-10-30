import { FRAMES, SKILLS, WEAPONS, type ProjectileKind, type ShipState, type SimEvent, type Vec3 } from '@skyriot/shared';
import { world } from '../state/world';
import { music, playSfx, startLoop, type LoopHandle, type SfxName } from './engine';

const FIRE_SFX: Record<string, SfxName> = {
  'needle-cannon': 'fire-needle',
  'flak-repeater': 'fire-flak',
  'pulse-blaster': 'fire-pulse',
  'twin-autocannon': 'fire-autocannon',
};
const FIRE_CULL_M = 900;
const COMBAT_MEMORY_S = 6;

interface Tracked {
  kind: ProjectileKind;
  origin: Vec3;
  dir: Vec3;
  speed: number;
  born: number;
  loop: LoopHandle | null;
}
const tracked = new Map<number, Tracked>();
let lastCombat = -1e9;
let wasBoosting = false;
let engine: LoopHandle | null = null;
let burner: LoopHandle | null = null;
let lockTone: LoopHandle | null = null;
let nextBeep = 0;
let nextWarn = 0;

const now = () => performance.now() / 1000;
const hash = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
const ownShip = (): ShipState | undefined => (world.ownId ? world.ships.get(world.ownId) : undefined);

function skillSfx(id: string): SfxName {
  const def = SKILLS[id];
  if (!def) return 'skill-generic';
  if (def.kind === 'buff') return 'skill-buff';
  if (def.kind === 'toggle') return 'skill-toggle';
  if (id === 'purge') return 'skill-purge';
  if (def.kind === 'consumable' || id === 'mend-beam' || id === 'aegis-bubble') return 'skill-heal';
  return 'skill-generic';
}

/** Sim events -> sounds. Called from the net layer for every event. */
export function handleAudioEvent(ev: SimEvent): void {
  const own = world.ownId;
  switch (ev.type) {
    case 'projectileSpawned': {
      if (ev.owner === own) lastCombat = now();
      const mine = ev.owner === own;
      if (ev.kind === 'tracer') {
        const name = FIRE_SFX[ev.weapon] ?? 'fire-needle';
        if (mine) playSfx(name, { volume: 0.7 });
        else playSfx(name, { pos: ev.origin, volume: 0.6 });
        break;
      }
      const t: Tracked = { kind: ev.kind, origin: ev.origin, dir: ev.dir, speed: ev.speed, born: now(), loop: null };
      if (ev.kind === 'missile') {
        playSfx('missile-launch', mine ? { volume: 0.8 } : { pos: ev.origin });
        t.loop = startLoop('missile-hiss', ev.origin);
      } else if (ev.kind === 'flare') playSfx('flare-pop', mine ? {} : { pos: ev.origin });
      else playSfx('bomb-whistle', mine ? { volume: 0.7 } : { pos: ev.origin, volume: 0.8 });
      tracked.set(ev.id, t);
      break;
    }
    case 'projectileExpired': {
      const t = tracked.get(ev.id);
      if (t) {
        t.loop?.stop();
        tracked.delete(ev.id);
        if (t.kind !== 'flare') playSfx(t.kind === 'missile' ? 'explosion' : 'boom', { pos: ev.pos, volume: t.kind === 'missile' ? 0.7 : 1 });
      }
      break;
    }
    case 'hit': {
      const t = tracked.get(ev.projectile);
      if (t) {
        t.loop?.stop();
        tracked.delete(ev.projectile);
        playSfx(t.kind === 'missile' ? 'explosion' : 'boom', { pos: ev.pos, volume: 0.9 });
      }
      const victim = world.ships.get(ev.victim);
      const layer: SfxName = ev.deflected ? 'hit-deflect' : (victim?.shield ?? 0) > 1 ? 'hit-shield' : 'hit-hull';
      if (ev.attacker === own) {
        lastCombat = now();
        playSfx('hit-dealt');
        if (ev.deflected) playSfx('hit-deflect', { pos: ev.pos, volume: 0.6 });
      } else if (ev.victim === own) {
        lastCombat = now();
        playSfx(layer, { volume: 1 });
      } else playSfx(layer, { pos: ev.pos, volume: 0.45 });
      break;
    }
    case 'shipDestroyed':
      playSfx('destroyed', ev.victim === own ? { volume: 0.9 } : { pos: ev.pos });
      break;
    case 'skillUsed':
      if (ev.id === own) playSfx(skillSfx(ev.skill), { pitch: 0.85 + (hash(ev.skill) % 7) / 20 });
      break;
    case 'barrelRoll': {
      const s = world.ships.get(ev.id);
      playSfx('roll', ev.id === own ? { volume: 0.8 } : { pos: s?.pos as Vec3 | undefined, volume: 0.6 });
      break;
    }
    case 'terrainImpact':
      if (ev.id === own && ev.bounced) playSfx('impact-bounce');
      else if (ev.id !== own) playSfx('impact-bounce', { pos: ev.pos, volume: 0.6 });
      break;
    case 'docked':
      if (ev.id === own) playSfx('docked');
      break;
    case 'resupplied':
      if (ev.id === own) playSfx('resupplied');
      break;
    case 'launched':
      if (ev.id === own) playSfx('launch');
      break;
    case 'missileEvaded':
      if (ev.victim === own) playSfx('evaded');
      break;
    default:
      break;
  }
}

/** Per-frame: state-driven loops (engine, afterburner, lock, warnings), missile hiss tracking, music intensity. */
export function updateAudio(): void {
  const t = now();
  const own = ownShip();
  const alive = !!own?.alive;

  // Engine hum follows speed.
  if (alive && own) {
    const def = FRAMES[own.frame];
    if (!engine) engine = startLoop('engine');
    const k = Math.min(1.4, own.speed / def.maxSpeed);
    engine?.update({ gain: own.docked ? 0.15 : 0.35 + 0.35 * k, rate: 0.7 + 0.9 * k });
  } else if (engine) {
    engine.stop();
    engine = null;
  }

  // Afterburner loop + kick on start.
  const boosting = alive && !!own && world.boosting.has(own.id);
  if (boosting && !wasBoosting) playSfx('boost-kick');
  wasBoosting = boosting;
  if (boosting) {
    if (!burner) burner = startLoop('afterburner');
    burner?.update({ gain: 0.7 });
  } else if (burner) {
    burner.stop();
    burner = null;
  }

  // Lock progress: rising beeps, then a steady tone. Incoming warning beeps speed up with time-to-impact.
  const locking = alive && !!own && own.lockTarget !== null && own.lockProgress > 0;
  const locked = locking && own!.lockProgress >= 1;
  if (locked) {
    if (!lockTone) lockTone = startLoop('lock-tone');
    lockTone?.update({ gain: 0.25 });
  } else if (lockTone) {
    lockTone.stop();
    lockTone = null;
  }
  if (locking && !locked && t >= nextBeep) {
    playSfx('lock-beep', { pitch: 0.8 + own!.lockProgress * 0.9, volume: 0.8 });
    nextBeep = t + 0.35 - own!.lockProgress * 0.25;
  }
  if (alive && own && own.incomingDist >= 0) {
    lastCombat = t;
    if (t >= nextWarn) {
      playSfx('warn-beep');
      nextWarn = t + Math.min(0.7, Math.max(0.09, own.incomingTti * 0.2));
    }
  }

  // Missiles in flight: follow the estimated position.
  for (const [id, m] of tracked) {
    const age = t - m.born;
    if (age > 15) {
      m.loop?.stop();
      tracked.delete(id);
      continue;
    }
    m.loop?.update({
      gain: 0.6,
      pos: [m.origin[0] + m.dir[0] * m.speed * age, m.origin[1] + m.dir[1] * m.speed * age, m.origin[2] + m.dir[2] * m.speed * age],
    });
  }

  // Music intensity: docked/dead idle, enemies near mid, recent combat high.
  let I = 0;
  if (alive && own && !own.docked) {
    const radar = FRAMES[own.frame].radarRangeM;
    let near = false;
    for (const s of world.ships.values()) {
      if (s.alive && s.nation !== own.nation && Math.hypot(s.pos[0] - own.pos[0], s.pos[1] - own.pos[1], s.pos[2] - own.pos[2]) <= radar) {
        near = true;
        break;
      }
    }
    I = t - lastCombat < COMBAT_MEMORY_S ? 1 : near ? 0.5 : 0.15;
  }
  music.setIntensity(I);
}

/** Stop everything tied to the session (leaving the game). */
export function resetAudioSession(): void {
  for (const m of tracked.values()) m.loop?.stop();
  tracked.clear();
  engine?.stop();
  burner?.stop();
  lockTone?.stop();
  engine = burner = lockTone = null;
  wasBoosting = false;
  music.setIntensity(0);
}
