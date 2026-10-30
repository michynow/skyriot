import {
  EMPTY_INPUT,
  FRAMES,
  WEAPONS,
  mulberry32,
  sampleHeight,
  type Heightfield,
  type PilotInput,
  type Sim,
  type ShipId,
  type ShipState,
} from '@skyriot/shared';

// Bot tuning (module constants; no content/ equivalent yet).
const AVOID_LOOKAHEAD_SEC = 2.2;
const AVOID_MARGIN = 90;
const CRUISE_ALTITUDE = 160;
const FIRE_CONE_RAD = 0.07;
const FAR_BOOST_DISTANCE = 1200;
const DODGE_CHANCE = 0.3;
const ROLL_CHANCE = 0.08;
const HEAL_HP_FRACTION = 0.4;
const HEAL_SLOT = 7;
const SHIELD_SLOT = 8;
const SKILL_CHANCE = 0.01;

export interface BotMemory {
  hf: Heightfield;
  rng: () => number;
  seq: number;
  lastHealth: number;
  dodgeTicks: number;
  dodgeDir: number;
}

export function createBotMemory(hf: Heightfield, seed: number): BotMemory {
  return { hf, rng: mulberry32(seed), seq: 0, lastHealth: 0, dodgeTicks: 0, dodgeDir: 1 };
}

/** Bots are just another PilotInput source: the sim cannot tell them from humans. */
export function botBrain(sim: Sim, id: ShipId, mem: BotMemory): PilotInput {
  const me = sim.getShip(id);
  const input: PilotInput = { seq: ++mem.seq, viewTick: sim.tick, ...EMPTY_INPUT, aim: [0, 0, -1] };
  if (!me || !me.alive) return input;

  const fd = FRAMES[me.frame];
  const primary = WEAPONS[fd.primary]!;
  const secondary = WEAPONS[fd.secondary]!;
  const enemy = nearestEnemy(sim, me);

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
  let dx = tx - me.pos[0],
    dy = ty - me.pos[1],
    dz = tz - me.pos[2];
  let dl = Math.hypot(dx, dy, dz) || 1;
  dx /= dl;
  dy /= dl;
  dz /= dl;

  // Terrain avoidance: sample ahead along velocity; if too close, climb hard.
  const speed = Math.max(me.speed, fd.minSpeed);
  const ahead = speed * AVOID_LOOKAHEAD_SEC;
  const hx = me.vel[0],
    hz = me.vel[2];
  const hl = Math.hypot(hx, hz) || 1;
  const groundAhead = Math.max(
    sampleHeight(mem.hf, me.pos[0], me.pos[2]),
    sampleHeight(mem.hf, me.pos[0] + (hx / hl) * ahead, me.pos[2] + (hz / hl) * ahead),
    sampleHeight(mem.hf, me.pos[0] + (hx / hl) * ahead * 0.5, me.pos[2] + (hz / hl) * ahead * 0.5),
  );
  const danger = groundAhead + AVOID_MARGIN - me.pos[1];
  if (danger > 0) {
    const w = Math.min(danger / AVOID_MARGIN, 1);
    dx = dx * (1 - w) + (hx / hl) * 0.3 * w;
    dz = dz * (1 - w) + (hz / hl) * 0.3 * w;
    dy = dy * (1 - w) + w;
    dl = Math.hypot(dx, dy, dz) || 1;
    dx /= dl;
    dy /= dl;
    dz /= dl;
  }
  input.aim = [dx, dy, dz];
  input.throttle = 0.5;
  input.boost = dist > FAR_BOOST_DISTANCE && danger <= 0;

  // Fire when the nose is on target.
  if (enemy && danger <= 0) {
    const f = noseOf(me);
    const cos = f[0] * dx + f[1] * dy + f[2] * dz;
    const angle = Math.acos(Math.min(Math.max(cos, -1), 1));
    input.fire1 = angle < FIRE_CONE_RAD && dist < primary.rangeM;
    input.fire2 =
      secondary.lockConeRad > 0
        ? me.lockTarget !== null
        : angle < FIRE_CONE_RAD && dist < secondary.rangeM * 0.6;
  }

  // Evade when taking damage.
  const health = me.hp + me.shield;
  if (health < mem.lastHealth - 1 && mem.dodgeTicks <= 0 && mem.rng() < DODGE_CHANCE) {
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

  if (me.hp < me.maxHp * HEAL_HP_FRACTION && mem.rng() < SKILL_CHANCE * 10) {
    input.hotbar = mem.rng() < 0.5 ? HEAL_SLOT : SHIELD_SLOT;
  }
  return input;
}

function nearestEnemy(sim: Sim, me: ShipState): ShipState | null {
  let best: ShipState | null = null;
  let bestD = Infinity;
  for (const o of sim.ships()) {
    if (!o.alive || o.nation === me.nation) continue;
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
