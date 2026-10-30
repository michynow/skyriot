import { BATTLE, SHIELD_DOME, STRUCTURES } from '../content/bases';
import {
  TICK_HZ,
  type NationId,
  type ShipId,
  type StructureKind,
  type StructureState,
  type Vec3,
} from '../types';
import type { ShipRec, SimCtx, StructureRec } from './ctx';
import { TERRAIN_GROUPS } from './constants';
import { syncBody } from './flight';

export const NATIONS = ['concord', 'vex'] as const;

export function enemyOf(nation: NationId): NationId {
  return nation === 'concord' ? 'vex' : 'concord';
}

/** Build every Base structure from the MapDef. Same on client and server, so colliders agree. */
export function createStructures(ctx: SimCtx): void {
  for (const nation of NATIONS) {
    const base = ctx.map.bases[nation];
    ctx.coreIndex[nation] = ctx.structures.length;
    addStructure(ctx, nation, 'core', `${nation}-core`, base.core);
    base.shieldStations.forEach((p, i) =>
      addStructure(ctx, nation, 'shieldStation', `${nation}-station-${i}`, p),
    );
    base.turrets.forEach((p, i) => addStructure(ctx, nation, 'turret', `${nation}-turret-${i}`, p));
    ctx.match.shielded[nation] = base.shieldStations.length > 0;
    ctx.tunnelFreeTick[nation] = base.tunnels.map(() => 0);
  }
}

function addStructure(
  ctx: SimCtx,
  nation: NationId,
  kind: StructureKind,
  id: string,
  pos: Vec3,
): void {
  const def = STRUCTURES[kind];
  const collider = ctx.world.createCollider(
    ctx.rapier.ColliderDesc.cylinder(def.height / 2, def.radius)
      .setTranslation(pos[0], pos[1] + def.height / 2, pos[2])
      .setCollisionGroups(TERRAIN_GROUPS),
  );
  const base = ctx.map.bases[nation];
  const rec: StructureRec = {
    state: {
      id,
      kind,
      nation,
      pos: [pos[0], pos[1], pos[2]],
      hp: def.maxHp,
      maxHp: def.maxHp,
      alive: true,
      aim: kind === 'turret' ? [base.facing[0], 0, base.facing[2]] : [0, 0, -1],
    },
    collider,
    radius: def.radius,
    height: def.height,
    fireCd: 0,
    shooter: { state: { id, nation } },
  };
  ctx.structures.push(rec);
  ctx.structureByCollider.set(collider.handle, rec);
}

function coreOf(ctx: SimCtx, nation: NationId): StructureRec {
  return ctx.structures[ctx.coreIndex[nation]]!;
}

function refreshShields(ctx: SimCtx): void {
  for (const nation of NATIONS) {
    let up = false;
    for (const st of ctx.structures)
      if (st.state.kind === 'shieldStation' && st.state.nation === nation && st.state.alive)
        up = true;
    if (ctx.match.shielded[nation] && !up) ctx.events.push({ type: 'shieldDown', nation });
    ctx.match.shielded[nation] = up;
  }
}

/** Projectile damage to a structure. The Core takes none while its dome is up. */
export function damageStructure(
  ctx: SimCtx,
  st: StructureRec,
  amount: number,
  attacker: ShipId,
  projectile: number,
  x: number,
  y: number,
  z: number,
): void {
  const s = st.state;
  if (!s.alive) return;
  const shielded = s.kind === 'core' && ctx.match.shielded[s.nation];
  const dealt = shielded ? 0 : Math.min(amount, s.hp);
  s.hp -= dealt;
  ctx.events.push({
    type: 'structureHit',
    projectile,
    attacker,
    structure: s.id,
    damage: dealt,
    pos: [x, y, z],
    shielded,
  });
  if (s.hp <= 0) destroyStructure(ctx, st, attacker);
}

export function destroyStructure(ctx: SimCtx, st: StructureRec, killer: ShipId | null): void {
  const s = st.state;
  if (!s.alive) return;
  s.alive = false;
  s.hp = 0;
  setSolid(ctx, st, false);
  ctx.events.push({
    type: 'structureDestroyed',
    structure: s.id,
    killer,
    pos: [s.pos[0], s.pos[1] + st.height / 2, s.pos[2]],
  });
  if (s.kind === 'shieldStation') refreshShields(ctx);
  if (s.kind === 'core') endBattle(ctx, enemyOf(s.nation));
}

function setSolid(ctx: SimCtx, st: StructureRec, solid: boolean): void {
  if (st.collider.isEnabled() === solid) return;
  st.collider.setEnabled(solid);
  // Scene queries (rays, the character controller) only see collider changes after a step.
  ctx.world.step();
}

/** Splash from an explosion at x,y,z onto enemy structures (except the one hit directly). */
export function splashStructures(
  ctx: SimCtx,
  nation: NationId,
  damage: number,
  splash: number,
  minFraction: number,
  direct: StructureRec | null,
  attacker: ShipId,
  projectile: number,
  x: number,
  y: number,
  z: number,
): void {
  for (const st of ctx.structures) {
    const s = st.state;
    if (st === direct || !s.alive || s.nation === nation) continue;
    const out = Math.max(Math.hypot(x - s.pos[0], z - s.pos[2]) - st.radius, 0);
    const above =
      y > s.pos[1] + st.height ? y - s.pos[1] - st.height : y < s.pos[1] ? s.pos[1] - y : 0;
    const d = Math.hypot(out, above);
    if (d >= splash) continue;
    damageStructure(
      ctx,
      st,
      damage * Math.max(1 - d / splash, minFraction),
      attacker,
      projectile,
      x,
      y,
      z,
    );
  }
}

let _domeCore: StructureRec | null = null;

/**
 * Distance along the unit direction at which a segment from outside enters an enemy Core's
 * shield dome (sphere around the Core), or Infinity. `domeHitCore()` names the Core.
 */
export function domeEntry(
  ctx: SimCtx,
  nation: NationId,
  px: number,
  py: number,
  pz: number,
  dx: number,
  dy: number,
  dz: number,
  len: number,
): number {
  const enemy = enemyOf(nation);
  if (!ctx.match.shielded[enemy]) return Infinity;
  const core = coreOf(ctx, enemy);
  const c = core.state.pos;
  const r = ctx.map.bases[enemy].shieldRadius;
  const ox = px - c[0],
    oy = py - c[1],
    oz = pz - c[2];
  const b = ox * dx + oy * dy + oz * dz;
  const k = ox * ox + oy * oy + oz * oz - r * r;
  if (k <= 0) return Infinity;
  const disc = b * b - k;
  if (disc < 0) return Infinity;
  const t = -b - Math.sqrt(disc);
  if (t < 0 || t > len) return Infinity;
  _domeCore = core;
  return t;
}

export function domeHitCore(): StructureRec {
  return _domeCore!;
}

/** Enemy Ships can't enter a shielded dome: put them back on its surface with an outward kick. */
export function pushOutOfDomes(ctx: SimCtx, rec: ShipRec): void {
  const s = rec.state;
  const enemy = enemyOf(s.nation);
  if (!ctx.match.shielded[enemy]) return;
  const c = coreOf(ctx, enemy).state.pos;
  const r = ctx.map.bases[enemy].shieldRadius + ctx.frames[s.frame].radius;
  const ox = s.pos[0] - c[0],
    oy = s.pos[1] - c[1],
    oz = s.pos[2] - c[2];
  const d = Math.hypot(ox, oy, oz);
  if (d >= r || d < 1e-3) return;
  const k = (r + SHIELD_DOME.marginM) / d;
  s.pos[0] = c[0] + ox * k;
  s.pos[1] = c[1] + oy * k;
  s.pos[2] = c[2] + oz * k;
  rec.lat[0] = (ox / d) * SHIELD_DOME.bounceSpeed;
  rec.lat[1] = (oy / d) * SHIELD_DOME.bounceSpeed;
  rec.lat[2] = (oz / d) * SHIELD_DOME.bounceSpeed;
  syncBody(ctx, rec);
}

export function endBattle(ctx: SimCtx, winner: NationId): void {
  const m = ctx.match;
  if (m.phase === 'ended') return;
  m.phase = 'ended';
  m.winner = winner;
  m.restartAtTick = ctx.tick + Math.ceil(BATTLE.restartSec * TICK_HZ);
  ctx.events.push({ type: 'matchEnded', winner });
}

/** After a Battle ends: rebuild the Bases when it's time. Returns true on the restart tick. */
export function stepBattle(ctx: SimCtx): boolean {
  const m = ctx.match;
  if (m.phase !== 'ended' || ctx.tick < m.restartAtTick) return false;
  for (const st of ctx.structures) {
    st.state.hp = st.state.maxHp;
    st.state.alive = true;
    st.fireCd = 0;
    setSolid(ctx, st, true);
  }
  for (const nation of NATIONS) {
    ctx.match.shielded[nation] = ctx.map.bases[nation].shieldStations.length > 0;
    ctx.match.queues[nation].length = 0;
    ctx.tunnelFreeTick[nation].fill(0);
    ctx.formationSlot[nation] = 0;
  }
  m.phase = 'battle';
  m.winner = null;
  m.restartAtTick = 0;
  ctx.events.push({ type: 'matchStarted' });
  return true;
}

/** Client: mirror the server's structures (alive state drives colliders and the dome). */
export function applyStructures(ctx: SimCtx, list: readonly StructureState[]): void {
  for (const src of list) {
    const st = ctx.structures.find((x) => x.state.id === src.id);
    if (!st) continue;
    st.state.hp = src.hp;
    st.state.alive = src.alive;
    st.state.aim[0] = src.aim[0];
    st.state.aim[1] = src.aim[1];
    st.state.aim[2] = src.aim[2];
    setSolid(ctx, st, src.alive);
  }
  for (const nation of NATIONS) {
    ctx.match.shielded[nation] = ctx.structures.some(
      (st) => st.state.kind === 'shieldStation' && st.state.nation === nation && st.state.alive,
    );
  }
}
