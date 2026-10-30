import { SKILLS, WEAPONS } from '../content/weapons';
import { TICK_HZ, type ShipId } from '../types';
import type { ShipRec, SimCtx } from './ctx';
import {
  AEGIS_RADIUS,
  CARPET_BOMBS,
  CARPET_BOMB_WEAPON,
  CARPET_DAMAGE_MUL,
  CARPET_SPACING,
  FLARE_COUNT,
  FLARE_RANGE,
  FLARE_SPEED,
  MEND_CONE_RAD,
  MEND_HEAL_FRACTION,
  MEND_RANGE,
  REPAIR_KIT_FRACTION,
  WALL_DISTANCE,
  WALL_MAX,
} from './constants';
import { toggleSiege } from './flight';
import { forwardOf, rightOf } from './math';
import { spawnProjectile } from './combat';

const _f = [0, 0, 0];
const _r = [0, 0, 0];

/** Skills that change movement and therefore must also run in client prediction. */
const PREDICTED = new Set(['afterburn-dash', 'siege-anchor']);

export function tickTimers(rec: ShipRec): void {
  const s = rec.state;
  for (let i = 0; i < s.cooldowns.length; i++) if (s.cooldowns[i]! > 0) s.cooldowns[i]!--;
  if (rec.state.ghostTicks > 0) rec.state.ghostTicks--;
  if (rec.state.ironTicks > 0) rec.state.ironTicks--;
  if (rec.state.flareTicks > 0) rec.state.flareTicks--;
}

export function useHotbar(ctx: SimCtx, rec: ShipRec, slot: number, predictOnly: boolean): void {
  const s = rec.state;
  if (slot < 0 || slot >= s.cooldowns.length || s.cooldowns[slot]! > 0 || !s.alive) return;
  const fd = ctx.frames[s.frame];
  const id = fd.hotbar[slot];
  const def = id ? SKILLS[id] : undefined;
  if (!id || !def) return;
  if (def.frames !== 'all' && !def.frames.includes(s.frame)) return;
  if (predictOnly && !PREDICTED.has(id)) return;
  const ticks = Math.ceil(def.durationSec * TICK_HZ);
  forwardOf(s.rot, _f);
  rightOf(s.rot, _r);

  switch (id) {
    case 'flares':
      rec.state.flareTicks = Math.max(ticks, 1);
      s.lockTarget = null;
      for (const o of ctx.recList) if (o.state.lockTarget === s.id) o.state.lockTarget = null;
      // Guided missiles drop their target (reason 'flare') in stepProjectiles while flares are active.
      for (let i = 0; i < FLARE_COUNT; i++) {
        const side = i === 0 ? -1 : 1;
        let dx = -_f[0]! + _r[0]! * side * 0.5,
          dy = -_f[1]! - 0.2,
          dz = -_f[2]! + _r[2]! * side * 0.5;
        const dl = Math.hypot(dx, dy, dz);
        dx /= dl;
        dy /= dl;
        dz /= dl;
        spawnProjectile(
          ctx,
          rec,
          'flare',
          'flare',
          0,
          0,
          FLARE_SPEED,
          FLARE_RANGE,
          0,
          null,
          s.pos[0],
          s.pos[1],
          s.pos[2],
          dx,
          dy,
          dz,
          0,
        );
      }
      break;
    case 'afterburn-dash':
      rec.state.dashTicks = Math.max(ticks, 1);
      s.speed = Math.max(s.speed, fd.boostSpeed);
      break;
    case 'ghost-skin':
      rec.state.ghostTicks = ticks;
      break;
    case 'iron-hide':
      rec.state.ironTicks = ticks;
      break;
    case 'repair-kit':
      s.hp = Math.min(s.maxHp, s.hp + s.maxHp * REPAIR_KIT_FRACTION);
      break;
    case 'shield-kit':
      s.shield = s.maxShield;
      break;
    case 'fuel-cell':
      s.fuel = 1;
      break;
    case 'siege-anchor':
      toggleSiege(rec);
      break;
    case 'carpet-drop': {
      const w = WEAPONS[CARPET_BOMB_WEAPON]!;
      for (let i = 0; i < CARPET_BOMBS; i++) {
        const off = (i - (CARPET_BOMBS - 1) / 2) * CARPET_SPACING;
        spawnProjectile(
          ctx,
          rec,
          w.kind,
          w.id,
          w.damage * CARPET_DAMAGE_MUL,
          w.splashRadius,
          w.speed,
          w.rangeM,
          0,
          null,
          s.pos[0] + _f[0]! * off,
          s.pos[1] - 3,
          s.pos[2] + _f[2]! * off,
          0,
          -1,
          0,
          0,
        );
      }
      break;
    }
    case 'mend-beam': {
      const ally = nearestAllyInFront(ctx, rec);
      if (ally)
        ally.state.hp = Math.min(
          ally.state.maxHp,
          ally.state.hp + ally.state.maxHp * MEND_HEAL_FRACTION,
        );
      break;
    }
    case 'aegis-bubble':
      for (const o of ctx.recList) {
        const os = o.state;
        if (
          os.alive &&
          os.nation === s.nation &&
          Math.hypot(os.pos[0] - s.pos[0], os.pos[1] - s.pos[1], os.pos[2] - s.pos[2]) <=
            AEGIS_RADIUS
        ) {
          os.shield = os.maxShield;
        }
      }
      break;
    case 'scrap-wall':
      if (ctx.walls.length >= WALL_MAX) ctx.walls.shift();
      ctx.walls.push({
        x: s.pos[0] + _f[0]! * WALL_DISTANCE,
        y: s.pos[1] + _f[1]! * WALL_DISTANCE,
        z: s.pos[2] + _f[2]! * WALL_DISTANCE,
        nation: s.nation,
        expireTick: ctx.tick + ticks,
      });
      break;
  }
  s.cooldowns[slot] = Math.ceil(def.cooldownSec * TICK_HZ);
  ctx.events.push({ type: 'skillUsed', id: s.id as ShipId, skill: id, slot });
}

function nearestAllyInFront(ctx: SimCtx, rec: ShipRec): ShipRec | null {
  const s = rec.state;
  const minCos = Math.cos(MEND_CONE_RAD);
  let best: ShipRec | null = null;
  let bestD = MEND_RANGE;
  for (const o of ctx.recList) {
    const os = o.state;
    if (o === rec || !os.alive || os.nation !== s.nation) continue;
    const dx = os.pos[0] - s.pos[0],
      dy = os.pos[1] - s.pos[1],
      dz = os.pos[2] - s.pos[2];
    const d = Math.hypot(dx, dy, dz);
    if (d < bestD && (dx * _f[0]! + dy * _f[1]! + dz * _f[2]!) / (d || 1) >= minCos) {
      best = o;
      bestD = d;
    }
  }
  return best;
}
