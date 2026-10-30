import { FRAMES } from '../content/frames';
import { generateHeightfield, mulberry32 } from '../terrain/heightfield';
import {
  EMPTY_INPUT,
  TICK_DT,
  type FrameDef,
  type FrameId,
  type MapDef,
  type PilotInput,
  type ShipId,
  type ShipSpawn,
  type ShipState,
  type SimEvent,
  type Vec3,
} from '../types';
import type { Sim, SimOptions, SimTuning } from './index';
import type { ShipRec, SimCtx } from './ctx';
import {
  DECK_HALF_THICKNESS,
  BOUNDARY_MARGIN,
  DOCK_CLEARANCE,
  DECK_RESPAWN_SPREAD,
  KCC_OFFSET,
  LAG_HISTORY_TICKS,
  SHIP_GROUPS,
  TERRAIN_GROUPS,
  TIMESCALE_MAX,
  TIMESCALE_MIN,
} from './constants';
import { stepProjectiles, stepWeapons, pushHistory } from './combat';
import { deriveLateral, stepFlight, syncBody } from './flight';
import { forwardOf } from './math';
import { tickTimers, useHotbar } from './skills';
import { createMods, initToggles, resolveMods } from './buffs';

const IDLE_INPUT: PilotInput = { seq: 0, viewTick: 0, ...EMPTY_INPUT };
const HALF_SQRT = Math.SQRT1_2;
const FRAME_IDS = Object.keys(FRAMES) as FrameId[];
const SPAWN_JITTER = 40;

export function createSim(map: MapDef, opts: SimOptions): Sim {
  const R = opts.rapier;
  const hf = generateHeightfield(map);
  const n = hf.resolution;
  const world = new R.World({ x: 0, y: 0, z: 0 });
  // Rapier heightfields are column-major with rows along x; ours are row-major (z rows).
  const rapierHeights = new Float32Array(n * n);
  for (let iz = 0; iz < n; iz++)
    for (let ix = 0; ix < n; ix++) rapierHeights[ix * n + iz] = hf.heights[iz * n + ix]!;
  const terrain = world.createCollider(
    R.ColliderDesc.heightfield(n - 1, n - 1, rapierHeights, {
      x: hf.size,
      y: 1,
      z: hf.size,
    }).setCollisionGroups(TERRAIN_GROUPS),
  );
  world.step(); // populate broad phase so queries see the terrain
  for (const nation of ['concord', 'vex'] as const) {
    for (const deck of map.launchDecks[nation]) {
      // Thin cylinder whose top face is the deck surface.
      world.createCollider(
        R.ColliderDesc.cylinder(DECK_HALF_THICKNESS, deck.radius)
          .setTranslation(deck.pos[0], deck.pos[1] - DECK_HALF_THICKNESS, deck.pos[2])
          .setCollisionGroups(TERRAIN_GROUPS),
      );
    }
  }
  const controller = world.createCharacterController(KCC_OFFSET);
  controller.setSlideEnabled(true);

  const tuning: SimTuning = { frames: {}, timescale: 1, god: new Set() };
  const baseFrames = {} as Record<FrameId, FrameDef>;
  const frames = {} as Record<FrameId, FrameDef>;
  for (const id of FRAME_IDS) {
    baseFrames[id] = FRAMES[id];
    frames[id] = { ...FRAMES[id] };
  }

  const ctx: SimCtx = {
    map,
    hf,
    authoritative: opts.authoritative,
    rapier: R,
    world,
    controller,
    terrain,
    ray: new R.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 }),
    rng: mulberry32(map.seed ^ 0x5eed),
    tick: 0,
    dt: TICK_DT,
    tuning,
    frames,
    ships: new Map(),
    list: [],
    recList: [],
    projectiles: [],
    pool: [],
    walls: [],
    nextProjectileId: 1,
    events: [],
  };
  /** Events raised between steps (teleports); flushed into the next step's result. */
  let pending: SimEvent[] = [];
  const discard: SimEvent[] = [];
  const spawnCursor = { concord: 0, vex: 0 };

  function refreshFrames(): void {
    ctx.dt = TICK_DT * Math.min(Math.max(tuning.timescale, TIMESCALE_MIN), TIMESCALE_MAX);
    for (const id of FRAME_IDS) {
      const over = tuning.frames[id];
      const dst = frames[id] as unknown as Record<string, unknown>;
      Object.assign(dst, baseFrames[id]);
      if (over) Object.assign(dst, over);
    }
  }

  function pickSpawn(nation: 'concord' | 'vex'): Vec3 {
    const list = map.spawns[nation];
    const base = list[spawnCursor[nation]++ % list.length]!;
    return [
      base[0] + (ctx.rng() - 0.5) * SPAWN_JITTER,
      base[1] + (ctx.rng() - 0.5) * 10,
      base[2] + (ctx.rng() - 0.5) * SPAWN_JITTER,
    ];
  }

  /** Face the map centre, level: yaw a maps forward (0,0,-1) to (-sin a, 0, -cos a). */
  function faceCentre(s: ShipState): void {
    const a = Math.atan2(s.pos[0], s.pos[2]);
    s.rot[0] = 0;
    s.rot[1] = Math.sin(a / 2);
    s.rot[2] = 0;
    s.rot[3] = Math.cos(a / 2);
  }

  function resetVitals(rec: ShipRec): void {
    const s = rec.state;
    const fd = frames[s.frame];
    s.maxHp = fd.maxHp;
    s.hp = fd.maxHp;
    s.maxShield = fd.maxShield;
    s.shield = fd.maxShield;
    s.fuel = 1;
    s.speed = fd.cruiseSpeed;
    s.alive = true;
    s.respawnAtTick = 0;
    s.rollTicks = 0;
    s.rollCooldownTicks = 0;
    s.sieged = false;
    s.lockTarget = null;
    s.cooldowns.fill(0);
    s.buffs.length = 0;
    initToggles(s, fd.hotbar);
    rec.lat[0] = rec.lat[1] = rec.lat[2] = 0;
    s.ammo1 = fd.ammo1Max;
    s.ammo2 = fd.ammo2Max;
    s.docked = false;
    s.siegePending = false;
    s.rollPhase = -1;
    s.rollDir = 0;
    s.outOfBounds = false;
    s.incomingDist = s.incomingTti = -1;
    s.canLock = false;
    s.lockProgress = 0;
    s.grounded = false;
    s.dockTicks = 0;
    s.brakeHeld = false;
    s.angVel[0] = s.angVel[1] = s.angVel[2] = 0;
    s.dashTicks = s.ghostTicks = s.ironTicks = s.flareTicks = 0;
    rec.lockCand = null;
    rec.lockTime = 0;
    rec.shieldDelay = 0;
    rec.fireCd[0] = rec.fireCd[1] = 0;
  }

  function placeAndLaunch(rec: ShipRec, at: Vec3, docked: boolean): void {
    const s = rec.state;
    s.pos[0] = at[0];
    s.pos[1] = at[1];
    s.pos[2] = at[2];
    faceCentre(s);
    resetVitals(rec);
    const f = [0, 0, 0];
    forwardOf(s.rot, f);
    if (docked) {
      s.docked = true;
      s.speed = 0;
    }
    s.vel[0] = f[0]! * s.speed;
    s.vel[1] = f[1]! * s.speed;
    s.vel[2] = f[2]! * s.speed;
    syncBody(ctx, rec);
  }

  /** Respawn / first spawn: docked on a deck of the Ship's nation; free-air spawns are only a fallback. */
  function placeAtBase(rec: ShipRec): void {
    const s = rec.state;
    const decks = map.launchDecks[s.nation];
    if (decks.length === 0) {
      placeAndLaunch(rec, pickSpawn(s.nation), false);
      return;
    }
    const deck = decks[spawnCursor[s.nation]++ % decks.length]!;
    const a = ctx.rng() * Math.PI * 2;
    const r = Math.sqrt(ctx.rng()) * deck.radius * DECK_RESPAWN_SPREAD;
    const fd = frames[s.frame];
    placeAndLaunch(
      rec,
      [
        deck.pos[0] + Math.cos(a) * r,
        deck.pos[1] + fd.radius + DOCK_CLEARANCE,
        deck.pos[2] + Math.sin(a) * r,
      ],
      true,
    );
  }

  function makeRec(id: ShipId, spawn: ShipSpawn, at: Vec3): ShipRec {
    const fd = frames[spawn.frame];
    const state: ShipState = {
      id,
      nation: spawn.nation,
      frame: spawn.frame,
      name: spawn.name,
      isBot: spawn.isBot,
      tier: spawn.tier,
      upgrade: spawn.upgrade,
      pos: [at[0], at[1], at[2]],
      rot: [0, 0, 0, 1],
      vel: [0, 0, 0],
      hp: fd.maxHp,
      maxHp: fd.maxHp,
      shield: fd.maxShield,
      maxShield: fd.maxShield,
      fuel: 1,
      speed: fd.cruiseSpeed,
      alive: true,
      respawnAtTick: 0,
      rollTicks: 0,
      rollCooldownTicks: 0,
      sieged: false,
      cooldowns: new Array<number>(fd.hotbar.length).fill(0),
      lockTarget: null,
      buffs: [],
      toggles: {},
      ammo1: fd.ammo1Max,
      ammo2: fd.ammo2Max,
      docked: false,
      grounded: false,
      angVel: [0, 0, 0],
      brakeHeld: false,
      dashTicks: 0,
      ghostTicks: 0,
      ironTicks: 0,
      flareTicks: 0,
      dockTicks: 0,
      siegePending: false,
      rollPhase: -1,
      rollDir: 0,
      outOfBounds: false,
      incomingDist: -1,
      incomingTti: -1,
      canLock: false,
      lockProgress: 0,
    };
    const body = world.createRigidBody(
      R.RigidBodyDesc.kinematicPositionBased().setTranslation(at[0], at[1], at[2]),
    );
    const half = Math.max(fd.halfLength - fd.radius, 0.01);
    // Capsule axis is local Y; rotate 90 degrees about X so it lies along the nose (Z).
    const collider = world.createCollider(
      R.ColliderDesc.capsule(half, fd.radius)
        .setRotation({ x: HALF_SQRT, y: 0, z: 0, w: HALF_SQRT })
        .setCollisionGroups(SHIP_GROUPS),
      body,
    );
    return {
      mods: createMods(),
      state,
      body,
      collider,
      lat: [0, 0, 0],
      fireCd: [0, 0],
      shieldDelay: 0,
      lockCand: null,
      lockTime: 0,
      spawnCounter: 0,
      histPos: new Float32Array(LAG_HISTORY_TICKS * 6),
      histTick: new Int32Array(LAG_HISTORY_TICKS).fill(-1),
    };
  }

  function addShip(id: ShipId, spawn: ShipSpawn, at?: Vec3): ShipState {
    if (ctx.ships.has(id)) removeShip(id);
    refreshFrames();
    const rec = makeRec(id, spawn, at ?? [0, 0, 0]);
    ctx.ships.set(id, rec);
    ctx.list.push(rec.state);
    ctx.recList.push(rec);
    if (at) placeAndLaunch(rec, at, false);
    else placeAtBase(rec);
    return rec.state;
  }

  function removeShip(id: ShipId): void {
    const rec = ctx.ships.get(id);
    if (!rec) return;
    world.removeRigidBody(rec.body);
    ctx.ships.delete(id);
    ctx.list.splice(ctx.list.indexOf(rec.state), 1);
    ctx.recList.splice(ctx.recList.indexOf(rec), 1);
    tuning.god.delete(id);
  }

  function respawn(rec: ShipRec): void {
    placeAtBase(rec);
    ctx.events.push({
      type: 'shipRespawned',
      id: rec.state.id,
      pos: [rec.state.pos[0], rec.state.pos[1], rec.state.pos[2]],
    });
  }

  return {
    get tick() {
      return ctx.tick;
    },
    tuning,
    addShip,
    removeShip,

    step(inputs, frozen) {
      const events: SimEvent[] = pending;
      pending = [];
      ctx.events = events;
      refreshFrames();
      for (const rec of ctx.recList) {
        const s = rec.state;
        const input = inputs.get(s.id) ?? IDLE_INPUT;
        if (!s.alive) {
          if (ctx.authoritative && ctx.tick >= s.respawnAtTick) respawn(rec);
          tickTimers(rec);
          continue;
        }
        // Frozen = a human whose input hasn't arrived; skipping keeps seq-for-seq lockstep with prediction.
        if (frozen?.has(s.id)) continue;
        resolveMods(ctx, rec);
        stepFlight(ctx, rec, input, ctx.authoritative);
        if (!ctx.authoritative) continue;
        if (s.alive) {
          tickTimers(rec);
          useHotbar(ctx, rec, input.hotbar, false);
          stepWeapons(ctx, rec, input);
          if (rec.shieldDelay > 0) rec.shieldDelay -= ctx.dt;
          else
            s.shield = Math.min(
              s.maxShield,
              s.shield + frames[s.frame].shieldRegenPerSec * rec.mods.shieldRegenMul * ctx.dt,
            );
        }
      }
      ctx.tick++;
      pushHistory(ctx);
      if (ctx.authoritative) stepProjectiles(ctx);
      return events;
    },

    getShip: (id) => ctx.ships.get(id)?.state,
    ships: () => ctx.list,

    setShipState(id, state) {
      let rec = ctx.ships.get(id);
      if (!rec) {
        addShip(id, state, state.pos);
        rec = ctx.ships.get(id)!;
      }
      const { pos, rot, vel, cooldowns, angVel, buffs, toggles, ...scalars } = state;
      // `state` may alias the live state (callers spread it), so copy arrays before touching them.
      const cooldownsCopy = cooldowns.slice();
      const buffsCopy = buffs.map((b) => ({ ...b }));
      const togglesCopy = { ...toggles };
      const s = rec.state;
      Object.assign(s, scalars);
      for (let i = 0; i < 3; i++) {
        s.pos[i] = pos[i]!;
        s.vel[i] = vel[i]!;
        s.angVel[i] = angVel[i]!;
      }
      for (let i = 0; i < 4; i++) s.rot[i] = rot[i]!;
      s.cooldowns.length = 0;
      for (const c of cooldownsCopy) s.cooldowns.push(c);
      s.buffs.length = 0;
      for (const b of buffsCopy) s.buffs.push(b);
      for (const k of Object.keys(s.toggles)) delete s.toggles[k];
      Object.assign(s.toggles, togglesCopy);
      deriveLateral(rec, frames[s.frame]);
      syncBody(ctx, rec);
    },

    teleport(id, to) {
      const rec = ctx.ships.get(id);
      if (!rec) return;
      const s = rec.state;
      const lim = map.size / 2 - BOUNDARY_MARGIN;
      s.pos[0] = Math.min(Math.max(to[0], -lim), lim);
      s.pos[1] = Math.min(Math.max(to[1], 0), map.ceiling);
      s.pos[2] = Math.min(Math.max(to[2], -lim), lim);
      // A teleported Ship is airborne and flying, never left docked or grounded mid-air.
      s.docked = false;
      s.grounded = false;
      s.sieged = false;
      s.siegePending = false;
      s.dockTicks = 0;
      s.rollPhase = -1;
      s.rollDir = 0;
      s.speed = Math.max(s.speed, frames[s.frame].cruiseSpeed);
      s.angVel[0] = s.angVel[1] = s.angVel[2] = 0;
      rec.lat[0] = rec.lat[1] = rec.lat[2] = 0;
      const f = [0, 0, 0];
      forwardOf(s.rot, f);
      for (let i = 0; i < 3; i++) s.vel[i] = f[i]! * s.speed;
      syncBody(ctx, rec);
      pending.push({ type: 'teleport', id, pos: [s.pos[0], s.pos[1], s.pos[2]] });
    },

    stepLocal(id, input) {
      const rec = ctx.ships.get(id);
      if (!rec) return;
      ctx.events = discard;
      refreshFrames();
      // Same order as step(): flight, timers, then Skills.
      resolveMods(ctx, rec);
      stepFlight(ctx, rec, input, false);
      tickTimers(rec);
      useHotbar(ctx, rec, input.hotbar, true);
      discard.length = 0;
    },

    debugLines: () => world.debugRender().vertices,
    dispose: () => world.free(),
  };
}
