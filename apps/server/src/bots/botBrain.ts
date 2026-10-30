import {
  EMPTY_INPUT,
  DECK,
  FRAMES,
  SIEGE,
  SKILLS,
  STRUCTURES,
  TICK_HZ,
  TURRET,
  WEAPONS,
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

// Bot tuning (module constants; no content/ equivalent yet).
const AVOID_LOOKAHEAD_SEC = 2.2;
const AVOID_MARGIN = 90;
const SINK_LOOKAHEAD_SEC = 0.8;
const CRUISE_THROTTLE = 0.6;
/** Below stallSpeed times this, Bots go full throttle. */
const SLOW_SPEED_MUL = 2;
const CRUISE_ALTITUDE = 160;
const FIRE_CONE_RAD = 0.07;
const FAR_BOOST_DISTANCE = 1200;
const DODGE_CHANCE = 0.3;
const ROLL_CHANCE = 0.08;
const HEAL_HP_FRACTION = 0.4;
const HEAL_SLOT = 7;
const SHIELD_SLOT = 8;
const SKILL_CHANCE = 0.01;
const RESUPPLY_AMMO_FRACTION = 0.05;
const DECK_APPROACH_HEIGHT = 20;
const DECK_BRAKE_DISTANCE = 250;
const BOT_EDGE_MARGIN = 600;
const SIEGE_SLOT = 0; // siege-anchor is hotbar slot 0 on the Bulwark
const ROLL_WINDOW_MIN_M = 30;
const ROLL_WINDOW_MAX_M = 80;
const FLARE_INCOMING_M = 700;
const FLARE_CHANCE = 0.25;
const BUFF_ENGAGE_DIST = 900;
const BOMB_DROP_RADIUS = 60;
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
  /** The Map's stall speed. */
  stallSpeed: number;
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
}

export function createBotMemory(
  hf: Heightfield,
  seed: number,
  decks: LaunchDeck[],
  stallSpeed: number,
): BotMemory {
  const rng = mulberry32(seed);
  return {
    hf,
    decks,
    stallSpeed,
    rng,
    seq: 0,
    lastHealth: 0,
    dodgeTicks: 0,
    dodgeDir: 1,
    siegeBot: rng() < SIEGE_BOT_CHANCE,
    lastBrake: false,
    raider: rng() < RAIDER_CHANCE,
    extending: false,
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
  const secondary = WEAPONS[fd.secondary]!;
  const enemy = nearestEnemy(sim, me);
  input.target = enemy ? enemy.id : null;

  let tx = 0,
    ty = CRUISE_ALTITUDE,
    tz = 0; // default: patrol the centre
  let dist = Infinity;
  if (enemy) {
    dist = Math.hypot(enemy.pos[0] - me.pos[0], enemy.pos[1] - me.pos[1], enemy.pos[2] - me.pos[2]);
    const lead = Math.min(dist / primary.speed, 2);
    tx = enemy.pos[0] + enemy.vel[0] * lead;
    ty = enemy.pos[1] + enemy.vel[1] * lead;
    tz = enemy.pos[2] + enemy.vel[2] * lead;
  }
  // No Ship close: go for the enemy Base (a Turret shooting at us first, then Shield Stations, then the Core).
  const engage = mem.raider ? RAIDER_ENGAGE_DISTANCE : SHIP_ENGAGE_DISTANCE;
  const objective = dist > engage ? pickObjective(sim, me) : null;
  let objectiveDist = Infinity;
  if (objective) {
    tx = objective.pos[0];
    ty = objective.pos[1] + STRUCTURES[objective.kind].height / 2;
    tz = objective.pos[2];
    objectiveDist = Math.hypot(tx - me.pos[0], ty - me.pos[1], tz - me.pos[2]);
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
    if (Math.hypot(me.pos[0] - tx, me.pos[2] - tz) < DECK_BRAKE_DISTANCE) input.brake = true;
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
        } else input.vertical = 1;
        mem.siegeBot = mem.rng() < SIEGE_BOT_CHANCE;
      }
    } else if (mem.siegeBot && enemy && dist < SIEGE_BOT_ENGAGE_DISTANCE) {
      siegeMode = true;
      input.vertical = -1;
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
  input.aim = [dx, dy, dz];
  // Full throttle when slow or climbing away from terrain: climbs bleed speed and a stall drops the nose.
  const slow = me.speed < mem.stallSpeed * SLOW_SPEED_MUL;
  if (!siegeMode || me.grounded)
    input.throttle = siegeMode ? 0 : slow || pullUp > 0 ? 1 : CRUISE_THROTTLE;
  input.boost =
    Math.min(dist, objectiveDist) > FAR_BOOST_DISTANCE && danger <= 0 && !landing && !siegeMode;

  // Fire when the nose is on target.
  if (enemy && danger <= 0 && !landing) {
    const f = noseOf(me);
    const aimAt = norm3(
      enemy.pos[0] - me.pos[0],
      enemy.pos[1] - me.pos[1],
      enemy.pos[2] - me.pos[2],
    );
    const cos = f[0] * aimAt[0] + f[1] * aimAt[1] + f[2] * aimAt[2];
    const angle = Math.acos(Math.min(Math.max(cos, -1), 1));
    const rangeMul = me.sieged ? SIEGE.rangeMul : 1;
    input.fire1 = angle < FIRE_CONE_RAD && dist < primary.rangeM * rangeMul;
    input.fire2 =
      secondary.lockConeRad > 0 || (me.sieged && secondary.kind === 'shell')
        ? me.lockTarget !== null
        : angle < FIRE_CONE_RAD && dist < secondary.rangeM * 0.6 * rangeMul;
  }
  if (objective && !mem.extending && danger <= 0 && !landing) {
    const f = noseOf(me);
    const cos =
      (f[0] * (tx - me.pos[0]) + f[1] * (ty - me.pos[1]) + f[2] * (tz - me.pos[2])) / objectiveDist;
    const onTarget = cos > Math.cos(STRUCTURE_FIRE_CONE_RAD);
    input.fire1 = onTarget && objectiveDist < primary.rangeM;
    input.fire2 = onTarget && secondary.lockConeRad === 0 && objectiveDist < secondary.rangeM * 0.6;
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
    if (mem.rng() < ROLL_CHANCE * 5) {
      if (mem.dodgeDir < 0) input.rollLeft = true;
      else input.rollRight = true;
    }
  }
  mem.lastHealth = health;
  if (mem.dodgeTicks > 0) {
    mem.dodgeTicks--;
    input.strafe = mem.dodgeDir;
  }

  const flareSlot = fd.hotbar.indexOf('flares');
  // Incoming guided missile: roll inside the break window, otherwise pop flares.
  if (me.incomingDist > 0 && !me.sieged && !me.grounded) {
    if (
      me.incomingDist < ROLL_WINDOW_MAX_M &&
      me.incomingDist > ROLL_WINDOW_MIN_M &&
      me.rollCooldownTicks === 0 &&
      me.fuel >= fd.rollFuelCost
    ) {
      if (mem.rng() < 0.5) input.rollLeft = true;
      else input.rollRight = true;
    } else if (
      me.incomingDist < FLARE_INCOMING_M &&
      flareSlot >= 0 &&
      me.cooldowns[flareSlot] === 0 &&
      mem.rng() < FLARE_CHANCE
    ) {
      input.hotbar = flareSlot;
    }
  } else if (me.hp < me.maxHp * HEAL_HP_FRACTION && mem.rng() < SKILL_CHANCE * 10) {
    input.hotbar = mem.rng() < 0.5 ? HEAL_SLOT : SHIELD_SLOT;
  }
  // Engagement: use buff Skills off cooldown, and pick the Anvil bombing mode by target.
  if (input.hotbar === -1 && enemy && dist < BUFF_ENGAGE_DIST && !me.docked) {
    const wantMode = enemy.grounded || enemy.docked ? 'ground-strike-mode' : 'air-barrage-mode';
    for (let slot = 0; slot < fd.hotbar.length; slot++) {
      const id = fd.hotbar[slot];
      const def = id ? SKILLS[id] : undefined;
      if (!id || !def || me.cooldowns[slot] !== 0) continue;
      if (def.kind === 'buff' && !me.buffs.some((x) => x.skill === id)) {
        input.hotbar = slot;
        break;
      }
      if (
        def.kind === 'toggle' &&
        def.toggleGroup &&
        id === wantMode &&
        me.toggles[def.toggleGroup] !== id
      ) {
        input.hotbar = slot;
        break;
      }
    }
  }
  // Ground-strike bombers fly over grounded targets and drop.
  if (enemy && me.toggles.bombing === 'ground-strike-mode' && (enemy.grounded || enemy.docked)) {
    const horiz = Math.hypot(enemy.pos[0] - me.pos[0], enemy.pos[2] - me.pos[2]);
    input.fire2 = horiz < BOMB_DROP_RADIUS && me.pos[1] > enemy.pos[1];
  }
  mem.lastBrake = input.brake;
  return input;
}

function norm3(x: number, y: number, z: number): [number, number, number] {
  const l = Math.hypot(x, y, z) || 1;
  return [x / l, y / l, z / l];
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

function nearestEnemy(sim: Sim, me: ShipState): ShipState | null {
  let best: ShipState | null = null;
  let bestD = Infinity;
  for (const o of sim.ships()) {
    if (!o.alive || o.nation === me.nation || o.launchPhase !== 'none') continue;
    const d =
      (o.pos[0] - me.pos[0]) ** 2 + (o.pos[1] - me.pos[1]) ** 2 + (o.pos[2] - me.pos[2]) ** 2;
    if (d < bestD) {
      bestD = d;
      best = o;
    }
  }
  return best;
}

function noseOf(s: ShipState): [number, number, number] {
  const [x, y, z, w] = s.rot;
  return [-2 * (x * z + w * y), -2 * (y * z - w * x), -(1 - 2 * (x * x + y * y))];
}
