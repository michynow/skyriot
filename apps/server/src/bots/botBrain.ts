import {
  BOMB_DROP_SPEED,
  BOMB_GRAVITY,
  CLOAK_REVEAL_M,
  EMPTY_INPUT,
  DECK,
  FRAMES,
  SIEGE,
  HEAL_BEAM_RANGE,
  SKILLS,
  STRUCTURES,
  TICK_HZ,
  TURRET,
  WEAPONS,
  bombingSecondary,
  isCloaked,
  mulberry32,
  sampleHeight,
  type Heightfield,
  type LaunchDeck,
  type PilotInput,
  type Sim,
  type ShipId,
  type ShipState,
  type StructureState,
} from '@skyriot/shared';

// Skill: Bots fly like mediocre human pilots. Raise/lower these to make them harder/easier.
/** Ticks between looks at the enemy: in between, a Bot steers at where it last saw it. */
const REACTION_TICKS = 7;
/** Anvil target pick: each point of the target's HP + shield costs this many metres of distance. */
const ANVIL_TARGET_HEALTH_COST = 0.3;
/** Anvil vs an air target: Air Barrage inside this range, Wide Lock (guided salvo) beyond it. */
const BARRAGE_RANGE_M = 450;
/** Anvil Secondary: rocket salvo cone, the guided salvo's minimum range, and its per-tick fire chance once locked. */
const ROCKET_FIRE_CONE_RAD = 0.12;
const WIDE_LOCK_MIN_M = 200;
const WIDE_LOCK_FIRE_CHANCE = 0.06;
/** Overcharge Round: armed only with the target this tight in the nose and inside Primary range. */
const OVERCHARGE_CONE_RAD = 0.06;
/** Aim error (rad) on a fresh target; shrinks toward the floor only while the target is held. */
const AIM_ERR_START_RAD = 0.22;
const AIM_ERR_MIN_RAD = 0.04;
const AIM_ERR_DECAY = 0.985; // per tick
/** Wide fire cone plus bursts: Bots spray and waste shots. */
const FIRE_CONE_RAD = 0.14;
const BURST_ON_TICKS = 15;
const BURST_PERIOD_TICKS = 40;
/** Fraction of the Frame's turn rate a Bot uses, and its throttle while fighting (player max is 1 + boost). */
const BOT_TURN_MUL = 0.65;
const COMBAT_THROTTLE = 0.3;
/** Mirrors the sim's TURN_GAIN (turn rate = aim angle * gain), used to cap the Bot's aim offset. */
const SIM_TURN_GAIN = 9;
/** Per-tick chances: Barrel Roll an incoming missile in the break window, use a ready Skill, launch a locked missile. */
const ROLL_DODGE_CHANCE = 0.1;
const SKILL_USE_CHANCE = 0.004;
const MISSILE_FIRE_CHANCE = 0.015;
/** Hurt below this HP fraction, a Bot may break off and run for a while. */
const DISENGAGE_HP_FRACTION = 0.35;
const DISENGAGE_CHANCE = 0.5;
const DISENGAGE_TICKS = 6 * TICK_HZ;
/** Extra distance (m) a target costs per other Bot already on it: spreads Bots over targets. */
const DOGPILE_PENALTY_M = 1000;

// Bot tuning (module constants; no content/ equivalent yet).
const AVOID_LOOKAHEAD_SEC = 2.2;
const AVOID_MARGIN = 90;
const SINK_LOOKAHEAD_SEC = 0.8;
const CRUISE_THROTTLE = 0.6;
/** Below the engine's min speed times this, Bots go full throttle. */
const SLOW_SPEED_MUL = 1.3;
const CRUISE_ALTITUDE = 160;
const FAR_BOOST_DISTANCE = 1200;
const DODGE_CHANCE = 0.3;
const ROLL_CHANCE = 0.08;
const HEAL_HP_FRACTION = 0.4;
/** Repair/Shield Kits (4 s cooldown): only when low, never back to back, so a Bot can still be finished. */
const KIT_HP_FRACTION = 0.3;
const KIT_SHIELD_FRACTION = 0.2;
const KIT_GAP_TICKS = 10 * TICK_HZ;
const RESUPPLY_AMMO_FRACTION = 0.05;
const DECK_APPROACH_HEIGHT = 20;
const DECK_BRAKE_DISTANCE = 250;
const BOT_EDGE_MARGIN = 600;
const SIEGE_SLOT = 0; // siege-anchor is hotbar slot 0 on the Bulwark
const ROLL_WINDOW_MIN_M = 30;
const ROLL_WINDOW_MAX_M = 80;
const BUFF_ENGAGE_DIST = 900;
const BOMB_DROP_RADIUS = 60;
/** Distance to the enemy under which a Bot fires each offensive Skill (roughly its effect reach). */
const OFFENSIVE_REACH_M: Record<string, number> = {
  'snare-tag': 400,
  'blind-tag': 400,
  'shield-breaker': 400,
  'dispel-lance': 500,
  'quake-round': 220,
};
/** Halo heal Skills a Bot casts when it (or its nearest ally) is hurt. */
const HEAL_SKILLS = new Set([
  'renewal-pulse',
  'recharge-pulse',
  'mend-beam',
  'charge-beam',
  'lifeline',
]);
/** Core Breach: only when about to die anyway, with an enemy inside the blast. */
const BREACH_HP_FRACTION = 0.2;
const BREACH_REACH_M = 120;
const BOMB_RUN_ALTITUDE = 120;
const SIEGE_BOT_CHANCE = 0.5;
const SIEGE_BOT_ENGAGE_DISTANCE = 700;
const SIEGE_BOT_LEAVE_DISTANCE = 1100;
/** Enemy Ships closer than this are fought; otherwise the bot attacks the enemy Base. Raiders mostly ignore Ships. */
const SHIP_ENGAGE_DISTANCE = 600;
const RAIDER_ENGAGE_DISTANCE = 200;
const RAIDER_CHANCE = 0.5;
const STRUCTURE_FIRE_CONE_RAD = 0.12;
/** Steepest dive (as aim y) on a strafing run, the height above ground that ends it, and the climb-out. */
const STRUCTURE_MAX_DIVE_DY = 0.35;
const STRUCTURE_PULL_UP_M = 80;
const STRUCTURE_CLIMB_DY = 0.3;
const STRUCTURE_BREAK_M = 250;
const STRUCTURE_RUN_IN_M = 900;
const STRUCTURE_RUN_ALTITUDE = 150;

export interface BotMemory {
  hf: Heightfield;
  /** Launch Decks of the bot's own nation. */
  decks: LaunchDeck[];
  rng: () => number;
  seq: number;
  lastHealth: number;
  dodgeTicks: number;
  dodgeDir: number;
  /** Bulwark bots with this set land and siege when an enemy is near. */
  siegeBot: boolean;
  lastBrake: boolean;
  /** Flying away from a structure to line up the next strafing run. */
  extending: boolean;
  /** Goes for the enemy Base, fighting only Ships that get very close. */
  raider: boolean;
  /** Current target and where it was last seen: [x, y, z, vx, vy, vz]. */
  target: ShipId | null;
  seen: number[];
  aimErr: number;
  errDir: [number, number, number];
  burstPhase: number;
  retreatTicks: number;
  /** Already rolled the dice on running away this time HP dropped low. */
  disengaged: boolean;
  /** `seq` of the last Repair/Shield Kit. */
  lastKitSeq: number;
}

/** Each Bot's current target, per Sim, so Bots can spread over targets. */
const claims = new WeakMap<Sim, Map<ShipId, ShipId | null>>();

export function createBotMemory(hf: Heightfield, seed: number, decks: LaunchDeck[]): BotMemory {
  const rng = mulberry32(seed);
  return {
    hf,
    decks,
    rng,
    seq: 0,
    lastHealth: 0,
    dodgeTicks: 0,
    dodgeDir: 1,
    siegeBot: rng() < SIEGE_BOT_CHANCE,
    lastBrake: false,
    raider: rng() < RAIDER_CHANCE,
    extending: false,
    target: null,
    seen: [0, 0, 0, 0, 0, 0],
    aimErr: AIM_ERR_START_RAD,
    errDir: [0, 0, 0],
    burstPhase: Math.floor(rng() * BURST_PERIOD_TICKS),
    retreatTicks: 0,
    disengaged: false,
    lastKitSeq: -Infinity,
  };
}

/** Bots are just another PilotInput source: the sim cannot tell them from humans. */
export function botBrain(sim: Sim, id: ShipId, mem: BotMemory): PilotInput {
  const me = sim.getShip(id);
  const input: PilotInput = { seq: ++mem.seq, viewTick: sim.tick, ...EMPTY_INPUT, aim: [0, 0, -1] };
  if (!me || !me.alive) return input;
  if (me.launchPhase !== 'none') {
    input.throttle = 1;
    return input;
  }

  const fd = FRAMES[me.frame];
  const primary = WEAPONS[fd.primary]!;
  const secondary = bombingSecondary(WEAPONS[fd.secondary]!, me.toggles.bombing);
  let claimed = claims.get(sim);
  if (!claimed) claims.set(sim, (claimed = new Map()));
  // Reaction delay: look at the enemy only every REACTION_TICKS; in between, steer at the stale sighting.
  let enemy = mem.target ? sim.getShip(mem.target) : undefined;
  if (enemy && (!enemy.alive || enemy.launchPhase !== 'none')) enemy = undefined;
  if (!enemy || mem.seq % REACTION_TICKS === 0) {
    enemy = pickEnemy(sim, me, mem.target, claimed) ?? undefined;
    if ((enemy?.id ?? null) !== mem.target) mem.aimErr = AIM_ERR_START_RAD;
    mem.target = enemy?.id ?? null;
    if (enemy) {
      mem.seen = [...enemy.pos, ...enemy.vel];
      mem.errDir = norm3(mem.rng() - 0.5, mem.rng() - 0.5, mem.rng() - 0.5);
    }
  }
  claimed.set(id, mem.target);
  mem.aimErr = Math.max(mem.aimErr * AIM_ERR_DECAY, AIM_ERR_MIN_RAD);
  input.target = mem.target;

  // Hurt: maybe break off and run for a while.
  if (me.hp >= me.maxHp * DISENGAGE_HP_FRACTION) mem.disengaged = false;
  else if (!mem.disengaged && enemy) {
    mem.disengaged = true;
    if (mem.rng() < DISENGAGE_CHANCE) mem.retreatTicks = DISENGAGE_TICKS;
  }
  if (mem.retreatTicks > 0) mem.retreatTicks--;
  const retreating = mem.retreatTicks > 0 && enemy !== undefined;

  let tx = 0,
    ty = CRUISE_ALTITUDE,
    tz = 0; // default: patrol the centre
  let dist = Infinity;
  if (enemy) {
    dist = Math.hypot(enemy.pos[0] - me.pos[0], enemy.pos[1] - me.pos[1], enemy.pos[2] - me.pos[2]);
    const lead = Math.min(dist / primary.speed, 2);
    const miss = mem.aimErr * dist;
    const [sx, sy, sz, svx, svy, svz] = mem.seen as [
      number,
      number,
      number,
      number,
      number,
      number,
    ];
    tx = sx + svx * lead + mem.errDir[0] * miss;
    ty = sy + svy * lead + mem.errDir[1] * miss;
    tz = sz + svz * lead + mem.errDir[2] * miss;
    if (retreating) {
      tx = 2 * me.pos[0] - enemy.pos[0];
      ty = Math.max(me.pos[1], CRUISE_ALTITUDE);
      tz = 2 * me.pos[2] - enemy.pos[2];
    }
  }
  // No Ship close: go for the enemy Base (a Turret shooting at us first, then Shield Stations, then the Core).
  const engage = mem.raider ? RAIDER_ENGAGE_DISTANCE : SHIP_ENGAGE_DISTANCE;
  const objective = dist > engage && !retreating ? pickObjective(sim, me) : null;
  let objectiveDist = Infinity;
  if (objective) {
    tx = objective.pos[0];
    ty = objective.pos[1] + STRUCTURES[objective.kind].height / 2;
    tz = objective.pos[2];
    objectiveDist = Math.hypot(tx - me.pos[0], ty - me.pos[1], tz - me.pos[2]);
    input.target = objective.id; // guns only damage the selected Target
    // Strafing run: break off when close, extend away, turn back in from far out.
    const hx = me.pos[0] - tx,
      hz = me.pos[2] - tz;
    const horiz = Math.hypot(hx, hz) || 1;
    if (horiz < STRUCTURE_BREAK_M) mem.extending = true;
    else if (horiz > STRUCTURE_RUN_IN_M) mem.extending = false;
    if (mem.extending) {
      tx = me.pos[0] + (hx / horiz) * STRUCTURE_RUN_IN_M;
      tz = me.pos[2] + (hz / horiz) * STRUCTURE_RUN_IN_M;
      ty = objective.pos[1] + STRUCTURE_RUN_ALTITUDE;
    }
  }

  if (enemy && me.toggles.bombing === 'ground-strike-mode' && (enemy.grounded || enemy.docked)) {
    ty = enemy.pos[1] + BOMB_RUN_ALTITUDE;
  }

  // Stay inside the map: head for the centre well before the sim's own edge override kicks in.
  const reach = Math.max(Math.abs(me.pos[0]), Math.abs(me.pos[2]));
  const edgeBot = reach > mem.hf.size / 2 - BOT_EDGE_MARGIN;
  if (edgeBot) {
    tx = 0;
    tz = 0;
    ty = Math.max(me.pos[1], CRUISE_ALTITUDE);
  }

  // Launch Deck logic: relaunch right after resupply; return when out of ammo.
  const deck = mem.decks[0];
  const resupplyTicks = Math.ceil(DECK.resupplySec * TICK_HZ);
  if (me.docked) {
    input.launch = me.dockTicks >= resupplyTicks;
    input.aim = [tx - me.pos[0], 0, tz - me.pos[2]];
    return input;
  }
  const needResupply = deck !== undefined && me.ammo1 < fd.ammo1Max * RESUPPLY_AMMO_FRACTION;
  let landing = false;
  if (needResupply && deck) {
    tx = deck.pos[0];
    ty = deck.pos[1] + DECK_APPROACH_HEIGHT;
    tz = deck.pos[2];
    if (Math.hypot(me.pos[0] - tx, me.pos[2] - tz) < DECK_BRAKE_DISTANCE) input.land = !me.landing;
    landing = true;
  }

  // Bulwark: land and siege near enemies, lift off when they are gone.
  let siegeMode = false;
  if (me.frame === 'bulwark' && !needResupply) {
    if (me.grounded) {
      if (enemy && dist < SIEGE_BOT_LEAVE_DISTANCE) {
        siegeMode = true;
        if (!me.sieged && me.cooldowns[SIEGE_SLOT] === 0) input.hotbar = SIEGE_SLOT;
      } else {
        if (me.sieged) {
          if (me.cooldowns[SIEGE_SLOT] === 0) input.hotbar = SIEGE_SLOT;
        } else input.land = true;
        mem.siegeBot = mem.rng() < SIEGE_BOT_CHANCE;
      }
    } else if (mem.siegeBot && enemy && dist < SIEGE_BOT_ENGAGE_DISTANCE) {
      siegeMode = true;
      input.land = !me.landing;
      input.throttle = -1;
    }
  }

  let dx = tx - me.pos[0],
    dy = ty - me.pos[1],
    dz = tz - me.pos[2];
  let dl = Math.hypot(dx, dy, dz) || 1;
  dx /= dl;
  dy /= dl;
  dz /= dl;
  // Strafing runs on structures: shallow dives only, and pull up near the ground.
  if (objective) {
    const low = me.pos[1] - sampleHeight(mem.hf, me.pos[0], me.pos[2]) < STRUCTURE_PULL_UP_M;
    const minDy = low ? STRUCTURE_CLIMB_DY : -STRUCTURE_MAX_DIVE_DY;
    if (dy < minDy) {
      const k = Math.sqrt((1 - minDy * minDy) / Math.max(dx * dx + dz * dz, 1e-6));
      dx *= k;
      dz *= k;
      dy = minDy;
    }
  }

  // Terrain avoidance: sample ahead along velocity; if too close, climb hard.
  let danger = 0;
  let pullUp = 0;
  if (!landing && !siegeMode) {
    const speed = Math.max(me.speed, fd.minSpeed);
    const ahead = speed * AVOID_LOOKAHEAD_SEC;
    const hx = me.vel[0],
      hz = me.vel[2];
    const hl = Math.hypot(hx, hz) || 1;
    const groundAhead = Math.max(
      sampleHeight(mem.hf, me.pos[0], me.pos[2]),
      sampleHeight(mem.hf, me.pos[0] + (hx / hl) * ahead, me.pos[2] + (hz / hl) * ahead),
      sampleHeight(
        mem.hf,
        me.pos[0] + (hx / hl) * ahead * 0.5,
        me.pos[2] + (hz / hl) * ahead * 0.5,
      ),
    );
    danger = groundAhead + AVOID_MARGIN - me.pos[1];
    // A steep dive needs room to pull out: steering counts the sink rate as lost height.
    pullUp = danger - Math.min(me.vel[1], 0) * SINK_LOOKAHEAD_SEC;
    if (pullUp > 0) {
      const w = Math.min(pullUp / AVOID_MARGIN, 1);
      dx = dx * (1 - w) + (hx / hl) * 0.3 * w;
      dz = dz * (1 - w) + (hz / hl) * 0.3 * w;
      dy = dy * (1 - w) + w;
      dl = Math.hypot(dx, dy, dz) || 1;
      dx /= dl;
      dy /= dl;
      dz /= dl;
    }
  }
  // Turn slower than the Frame can: cap how far the aim leads the nose (never when dodging terrain).
  if (pullUp <= 0 && !landing && !siegeMode && !edgeBot) {
    const f = noseOf(me);
    const maxOff = (BOT_TURN_MUL * fd.turnRate) / SIM_TURN_GAIN;
    const c = dx * f[0] + dy * f[1] + dz * f[2];
    if (c < Math.cos(maxOff)) {
      const p = norm3(dx - f[0] * c, dy - f[1] * c, dz - f[2] * c);
      const [cs, sn] = [Math.cos(maxOff), Math.sin(maxOff)];
      dx = f[0] * cs + p[0] * sn;
      dy = f[1] * cs + p[1] * sn;
      dz = f[2] * cs + p[2] * sn;
    }
  }
  input.aim = [dx, dy, dz];
  // Full throttle when slow or climbing away from terrain; easy throttle in a fight.
  const slow = me.speed < fd.minSpeed * SLOW_SPEED_MUL;
  const fighting = enemy !== undefined && dist < FAR_BOOST_DISTANCE && !retreating;
  if ((!siegeMode || me.grounded) && !me.landing)
    input.throttle = siegeMode
      ? 0
      : slow || pullUp > 0
        ? 1
        : fighting
          ? COMBAT_THROTTLE
          : CRUISE_THROTTLE;
  input.boost =
    (retreating || Math.min(dist, objectiveDist) > FAR_BOOST_DISTANCE) &&
    danger <= 0 &&
    !landing &&
    !siegeMode;

  // Fire in bursts when the nose is roughly on target; missiles only now and then once locked.
  const burst = (mem.seq + mem.burstPhase) % BURST_PERIOD_TICKS < BURST_ON_TICKS;
  if (enemy && danger <= 0 && !landing && !retreating) {
    const f = noseOf(me);
    const aimAt = norm3(
      enemy.pos[0] - me.pos[0],
      enemy.pos[1] - me.pos[1],
      enemy.pos[2] - me.pos[2],
    );
    const cos = f[0] * aimAt[0] + f[1] * aimAt[1] + f[2] * aimAt[2];
    const angle = Math.acos(Math.min(Math.max(cos, -1), 1));
    const rangeMul = me.sieged ? SIEGE.rangeMul : 1;
    input.fire1 =
      burst &&
      !me.overheated &&
      angle < FIRE_CONE_RAD &&
      dist < Math.min(primary.rangeM, fd.radarStdM) * rangeMul;
    // Missiles and the Bulwark salvo fire only while LOCKED (Target in the Valid Angle of the nose).
    input.fire2 =
      secondary.validAngleDeg > 0
        ? me.lockTarget !== null && mem.rng() < MISSILE_FIRE_CHANCE
        : burst && angle < FIRE_CONE_RAD && dist < secondary.rangeM * 0.6 * rangeMul;
  }
  if (enemy && danger <= 0 && !landing && !retreating && me.frame === 'anvil') {
    // Bomber Secondary by mode: rockets at what's in the nose, guided salvos at range, bombs only on the ground.
    const mode = me.toggles.bombing;
    const f = noseOf(me);
    const air = !enemy.grounded && !enemy.docked;
    if (mode === 'air-barrage-mode') {
      const a = norm3(tx - me.pos[0], ty - me.pos[1], tz - me.pos[2]);
      const cos = f[0] * a[0] + f[1] * a[1] + f[2] * a[2];
      input.fire2 = air && cos > Math.cos(ROCKET_FIRE_CONE_RAD) && dist < BARRAGE_RANGE_M + 100;
    } else if (mode === 'wide-lock-mode') {
      input.fire2 =
        me.lockTarget !== null && dist > WIDE_LOCK_MIN_M && mem.rng() < WIDE_LOCK_FIRE_CHANCE;
    } else input.fire2 = false; // Ground Strike: the bomb sight below decides
    // An armed Overcharge Round goes out with the target in the nose, whatever the burst.
    if (me.buffs.some((b) => b.skill === 'overcharge-round')) {
      const aimAt = norm3(
        enemy.pos[0] - me.pos[0],
        enemy.pos[1] - me.pos[1],
        enemy.pos[2] - me.pos[2],
      );
      const cos = f[0] * aimAt[0] + f[1] * aimAt[1] + f[2] * aimAt[2];
      input.fire1 = cos > Math.cos(OVERCHARGE_CONE_RAD * 2) && dist < primary.rangeM * 2;
    }
  }
  if (objective && !mem.extending && danger <= 0 && !landing) {
    const f = noseOf(me);
    const cos =
      (f[0] * (tx - me.pos[0]) + f[1] * (ty - me.pos[1]) + f[2] * (tz - me.pos[2])) / objectiveDist;
    const onTarget = cos > Math.cos(STRUCTURE_FIRE_CONE_RAD);
    input.fire1 = onTarget && !me.overheated && objectiveDist < primary.rangeM;
    input.fire2 =
      me.frame === 'anvil'
        ? me.toggles.bombing === 'ground-strike-mode' &&
          bombOnTarget(me, objective.pos[0], objective.pos[1], objective.pos[2])
        : secondary.validAngleDeg > 0
          ? me.lockTarget !== null && mem.rng() < MISSILE_FIRE_CHANCE
          : onTarget && objectiveDist < secondary.rangeM * 0.6;
  }

  // Evade when taking damage (never while rooted).
  const health = me.hp + me.shield;
  if (
    !me.sieged &&
    !me.grounded &&
    health < mem.lastHealth - 1 &&
    mem.dodgeTicks <= 0 &&
    mem.rng() < DODGE_CHANCE
  ) {
    mem.dodgeTicks = 8 + Math.floor(mem.rng() * 10);
    mem.dodgeDir = mem.rng() < 0.5 ? -1 : 1;
    if (mem.rng() < ROLL_CHANCE) {
      if (mem.dodgeDir < 0) input.rollLeft = true;
      else input.rollRight = true;
    }
  }
  mem.lastHealth = health;
  if (mem.dodgeTicks > 0) {
    mem.dodgeTicks--;
    input.strafe = mem.dodgeDir;
  }

  // Incoming guided missile: roll inside the break window.
  if (me.incomingDist > 0 && !me.sieged && !me.grounded) {
    if (
      me.incomingDist < ROLL_WINDOW_MAX_M &&
      me.incomingDist > ROLL_WINDOW_MIN_M &&
      me.rollCooldownTicks === 0 &&
      me.fuel >= fd.rollFuelCost &&
      mem.rng() < ROLL_DODGE_CHANCE
    ) {
      if (mem.rng() < 0.5) input.rollLeft = true;
      else input.rollRight = true;
    }
  } else if (
    me.hp < me.maxHp * KIT_HP_FRACTION &&
    mem.seq - mem.lastKitSeq >= KIT_GAP_TICKS &&
    mem.rng() < SKILL_USE_CHANCE * 5
  ) {
    const kit = me.shield < me.maxShield * KIT_SHIELD_FRACTION ? 'shield-kit' : 'repair-kit';
    const slot = fd.hotbar.indexOf(kit);
    if (slot >= 0 && me.cooldowns[slot] === 0) {
      input.hotbar = slot;
      mem.lastKitSeq = mem.seq;
    }
  }
  // Anvil bombing mode, picked every tick: bombs for ground targets and structures, rockets up close,
  // guided salvos at range.
  if (me.frame === 'anvil' && input.hotbar === -1) {
    const groundTarget = enemy && (enemy.grounded || enemy.docked);
    const wantMode =
      groundTarget || objective
        ? 'ground-strike-mode'
        : !enemy
          ? undefined
          : dist > BARRAGE_RANGE_M
            ? 'wide-lock-mode'
            : 'air-barrage-mode';
    const slot = wantMode ? fd.hotbar.indexOf(wantMode) : -1;
    if (slot >= 0 && me.toggles.bombing !== wantMode && me.cooldowns[slot] === 0)
      input.hotbar = slot;
    // Overcharge Round: arm it with the target dead in the nose.
    const oc = fd.hotbar.indexOf('overcharge-round');
    if (
      input.hotbar === -1 &&
      enemy &&
      oc >= 0 &&
      me.cooldowns[oc] === 0 &&
      dist < primary.rangeM
    ) {
      const f = noseOf(me);
      const a = norm3(enemy.pos[0] - me.pos[0], enemy.pos[1] - me.pos[1], enemy.pos[2] - me.pos[2]);
      if (f[0] * a[0] + f[1] * a[1] + f[2] * a[2] > Math.cos(OVERCHARGE_CONE_RAD))
        input.hotbar = oc;
    }
  }
  // Engagement: use buff Skills off cooldown.
  if (
    input.hotbar === -1 &&
    enemy &&
    dist < BUFF_ENGAGE_DIST &&
    !me.docked &&
    mem.rng() < SKILL_USE_CHANCE
  ) {
    const need = allyNeed(sim, me);
    for (let slot = 0; slot < fd.hotbar.length; slot++) {
      const id = fd.hotbar[slot];
      const def = id ? SKILLS[id] : undefined;
      if (!id || !def || me.cooldowns[slot] !== 0) continue;
      if (!botMayCast(id, me, dist)) continue;
      if (HEAL_SKILLS.has(id)) {
        if (wantsHeal(id, need)) {
          input.hotbar = slot;
          break;
        }
        continue;
      }
      if (id === 'purge') {
        // Shake a missile or shed enemy debuffs.
        if (me.incomingDist > 0 || me.buffs.some((b) => SKILLS[b.skill]?.kind === 'skill')) {
          input.hotbar = slot;
          break;
        }
        continue;
      }
      if (id === 'core-breach') {
        if (me.hp < me.maxHp * BREACH_HP_FRACTION && dist < BREACH_REACH_M) {
          input.hotbar = slot;
          break;
        }
        continue;
      }
      if (id === 'overcharge-round') continue; // aimed: armed above
      if (def.kind === 'buff' && !me.buffs.some((x) => x.skill === id)) {
        input.hotbar = slot;
        break;
      }
      // Offensive Skills (debuffs, damage areas): only once the enemy is inside their reach.
      const reach = OFFENSIVE_REACH_M[id];
      if (reach !== undefined && dist < reach) {
        input.hotbar = slot;
        break;
      }
    }
  }
  // Ground-strike bombers fly over grounded targets and drop when the bomb sight is on.
  if (enemy && me.toggles.bombing === 'ground-strike-mode' && (enemy.grounded || enemy.docked)) {
    input.fire2 = bombOnTarget(me, enemy.pos[0], enemy.pos[1], enemy.pos[2]);
  }
  mem.lastBrake = input.brake;
  return input;
}

function norm3(x: number, y: number, z: number): [number, number, number] {
  const l = Math.hypot(x, y, z) || 1;
  return [x / l, y / l, z / l];
}

/** Bomb sight: a Ground Strike bomb dropped now (carrying the Ship's velocity, falling under gravity) lands near the point. */
function bombOnTarget(me: ShipState, gx: number, gy: number, gz: number): boolean {
  const h = me.pos[1] - gy;
  if (h <= 0) return false;
  const vy = me.vel[1] - BOMB_DROP_SPEED;
  const t = (vy + Math.sqrt(vy * vy + 2 * BOMB_GRAVITY * h)) / BOMB_GRAVITY;
  return (
    Math.hypot(me.pos[0] + me.vel[0] * t - gx, me.pos[2] + me.vel[2] * t - gz) < BOMB_DROP_RADIUS
  );
}

function pickObjective(sim: Sim, me: ShipState): StructureState | null {
  const threatRange2 = WEAPONS[TURRET.weapon]!.rangeM ** 2;
  let turret: StructureState | null = null;
  let station: StructureState | null = null;
  let core: StructureState | null = null;
  let turretD = Infinity;
  let stationD = Infinity;
  for (const st of sim.structures()) {
    if (!st.alive || st.nation === me.nation) continue;
    const d =
      (st.pos[0] - me.pos[0]) ** 2 + (st.pos[1] - me.pos[1]) ** 2 + (st.pos[2] - me.pos[2]) ** 2;
    if (st.kind === 'turret' && d < threatRange2 && d < turretD) {
      turret = st;
      turretD = d;
    } else if (st.kind === 'shieldStation' && d < stationD) {
      station = st;
      stationD = d;
    } else if (st.kind === 'core') core = st;
  }
  return turret ?? station ?? core;
}

/** Nearest enemy, but each other Bot already on a Ship makes it look DOGPILE_PENALTY_M farther. */
function pickEnemy(
  sim: Sim,
  me: ShipState,
  current: ShipId | null,
  claimed: Map<ShipId, ShipId | null>,
): ShipState | null {
  const load = new Map<ShipId, number>();
  for (const [bot, t] of claimed) {
    if (bot !== me.id && t && sim.getShip(bot)?.alive) load.set(t, (load.get(t) ?? 0) + 1);
  }
  let best: ShipState | null = null;
  let bestCost = Infinity;
  for (const o of sim.ships()) {
    if (!o.alive || o.nation === me.nation || o.launchPhase !== 'none') continue;
    const d =
      (o.pos[0] - me.pos[0]) ** 2 + (o.pos[1] - me.pos[1]) ** 2 + (o.pos[2] - me.pos[2]) ** 2;
    if (d > CLOAK_REVEAL_M ** 2 && isCloaked(o)) continue;
    // Small bias to the current target so Bots don't flip between two at the same range.
    let cost =
      Math.sqrt(d) + DOGPILE_PENALTY_M * (load.get(o.id) ?? 0) - (o.id === current ? 100 : 0);
    // A bomber can't win long turning fights against its big hull: it picks the softest, most hurt target.
    if (me.frame === 'anvil') cost += ANVIL_TARGET_HEALTH_COST * (o.hp + o.shield);
    if (cost < bestCost) {
      bestCost = cost;
      best = o;
    }
  }
  return best;
}

function noseOf(s: ShipState): [number, number, number] {
  const [x, y, z, w] = s.rot;
  return [-2 * (x * z + w * y), -2 * (y * z - w * x), -(1 - 2 * (x * x + y * y))];
}

/**
 * Skills whose cast would fail or hurt the Bot right now: kept off the "use anything ready" pick so a
 * refused cast (no cooldown paid) can't block the rest of the hotbar.
 */
function botMayCast(id: string, me: ShipState, dist: number): boolean {
  switch (id) {
    case 'ground-shroud':
    case 'track-drive':
      return me.grounded;
    case 'sanctum':
      // Weapons go offline: only as a panic button.
      return me.hp < me.maxHp * HEAL_HP_FRACTION;
    case 'shroud-veil':
      // Stealth is for closing in, not mid-dogfight (firing ends it).
      return dist > 400;
    default:
      return true;
  }
}

/** Lowest HP and shield fractions among live allies within heal reach (self included). */
function allyNeed(sim: Sim, me: ShipState): { hp: number; shield: number } {
  let hp = me.hp / me.maxHp,
    shield = me.maxShield > 0 ? me.shield / me.maxShield : 1;
  for (const o of sim.ships()) {
    if (!o.alive || o.nation !== me.nation || o.launchPhase !== 'none') continue;
    const d = Math.hypot(o.pos[0] - me.pos[0], o.pos[1] - me.pos[1], o.pos[2] - me.pos[2]);
    if (d > HEAL_BEAM_RANGE) continue;
    hp = Math.min(hp, o.hp / o.maxHp);
    if (o.maxShield > 0) shield = Math.min(shield, o.shield / o.maxShield);
  }
  return { hp, shield };
}

/** Halo heal pick: big heals for big need, shield refills when shields are down. */
function wantsHeal(id: string, need: { hp: number; shield: number }): boolean {
  switch (id) {
    case 'lifeline':
      return need.hp < 0.35;
    case 'mend-beam':
    case 'renewal-pulse':
      return need.hp < 0.65;
    default:
      return need.shield < 0.35; // charge-beam, recharge-pulse
  }
}
