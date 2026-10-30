import * as RAPIER from '@dimforge/rapier3d-compat';
import {
  FRAMES,
  RUSTWATER_CANYONS,
  createSim,
  generateHeightfield,
  sampleHeight,
  EMPTY_INPUT,
  type FrameId,
  type PilotInput,
  type ShipId,
  type SimEvent,
} from '@skyriot/shared';
import { botBrain, createBotMemory } from '../src/bots/botBrain';

const SHIPS = 40;
const TICKS = 900;
const FLOOR_TOLERANCE = 3; // Rapier triangulation vs bilinear sampling differ by a little

await RAPIER.init();
const map = RUSTWATER_CANYONS;
const hf = generateHeightfield(map);
const sim = createSim(map, { rapier: RAPIER, authoritative: true });

const frames = Object.keys(FRAMES) as FrameId[];
const mems = new Map<ShipId, ReturnType<typeof createBotMemory>>();
for (let i = 0; i < SHIPS; i++) {
  const id = `bot${i}`;
  sim.addShip(id, {
    nation: i % 2 ? 'vex' : 'concord',
    frame: frames[(i >> 1) % frames.length]!,
    name: id,
    isBot: true,
    tier: 1,
    upgrade: 0,
  });
  mems.set(id, createBotMemory(hf, i + 1, map.launchDecks[i % 2 ? 'vex' : 'concord']));
}

let total = 0,
  max = 0,
  kills = 0,
  hits = 0,
  spawned = 0,
  impacts = 0,
  respawns = 0,
  rolls = 0;
let negativeAmmo = 0,
  belowTerrain = 0,
  minClearance = Infinity;
const counts: Record<string, number> = {};
for (let t = 0; t < TICKS; t++) {
  const inputs = new Map<ShipId, PilotInput>();
  for (const [id, mem] of mems) inputs.set(id, botBrain(sim, id, mem));
  const t0 = performance.now();
  const events: SimEvent[] = sim.step(inputs);
  const dt = performance.now() - t0;
  total += dt;
  max = Math.max(max, dt);
  for (const e of events) {
    counts[e.type] = (counts[e.type] ?? 0) + 1;
    if (e.type === 'shipDestroyed') kills++;
    else if (e.type === 'hit') hits++;
    else if (e.type === 'projectileSpawned') spawned++;
    else if (e.type === 'terrainImpact') impacts++;
    else if (e.type === 'shipRespawned') respawns++;
    else if (e.type === 'barrelRoll') rolls++;
  }
  for (const s of sim.ships()) {
    if (!s.alive) continue;
    const clearance = s.pos[1] - sampleHeight(hf, s.pos[0], s.pos[2]);
    minClearance = Math.min(minClearance, clearance);
    if (clearance < -FLOOR_TOLERANCE) belowTerrain++;
    if (s.ammo1 < 0 || s.ammo2 < 0) negativeAmmo++;
  }
}

console.log(
  `ticks=${TICKS} ships=${SHIPS} avg=${(total / TICKS).toFixed(3)}ms max=${max.toFixed(3)}ms`,
);
console.log(
  `spawned=${spawned} hits=${hits} kills=${kills} respawns=${respawns} terrainImpacts=${impacts} rolls=${rolls}`,
);
console.log(`minClearance=${minClearance.toFixed(2)}m belowTerrainSamples=${belowTerrain}`, counts);

// ---- scenarios: impact rules, Bulwark ground mode, prediction equality ----
const spawn = (frame: FrameId, nation: 'concord' | 'vex' = 'vex') => ({
  nation,
  frame,
  name: 'x',
  isBot: false,
  tier: 1,
  upgrade: 0,
});
const mk = (seq: number, patch: Partial<PilotInput>): PilotInput => ({
  seq,
  viewTick: 0,
  ...EMPTY_INPUT,
  ...patch,
});
const fresh = (authoritative: boolean) => createSim(map, { rapier: RAPIER, authoritative });

// 1. Dive into terrain: with shield -> bounce (shield 0, lose HP); without shield -> destroyed.
function dive(shield: boolean) {
  const sim2 = fresh(true);
  sim2.addShip('p', spawn('wasp'), [0, 700, 0]);
  const ship = sim2.getShip('p')!;
  if (!shield) ship.shield = 0;
  let impact: SimEvent | undefined;
  for (let i = 0; i < 400 && !impact; i++) {
    const events = sim2.step(new Map([['p', mk(i, { aim: [0.1, -1, 0.1], boost: true })]]));
    impact = events.find((e) => e.type === 'terrainImpact');
    if (!shield) ship.shield = 0; // keep shield off against regen
  }
  const out = { impact, shield: ship.shield, hp: ship.hp, alive: ship.alive, maxHp: ship.maxHp };
  sim2.dispose();
  return out;
}
const bounce = dive(true);
const crash = dive(false);
console.log('bounce', bounce.impact, `shield=${bounce.shield} hp=${bounce.hp}/${bounce.maxHp}`);
console.log('crash', crash.impact, `alive=${crash.alive}`);

// 2. Bulwark: land with Q near ground, siege with Shift, lift off with E.
function bulwark() {
  const sim2 = fresh(true);
  const g = sampleHeight(hf, 0, 0);
  sim2.addShip('b', spawn('bulwark'), [0, g + 40, 0]);
  const b = sim2.getShip('b')!;
  const log: string[] = [];
  let seq = 0;
  const run = (n: number, patch: Partial<PilotInput>) => {
    for (let i = 0; i < n; i++)
      sim2.step(new Map([['b', mk(++seq, { aim: [0, 0, -1], ...patch })]]));
  };
  run(30, { throttle: -1, brake: false });
  for (let i = 0; i < 400 && !b.grounded; i++) run(1, { vertical: -1, throttle: -1 });
  log.push(
    `grounded=${b.grounded} y-ground=${(b.pos[1] - sampleHeight(hf, b.pos[0], b.pos[2])).toFixed(1)}`,
  );
  run(1, { brake: true });
  run(1, { brake: false });
  log.push(`sieged=${b.sieged}`);
  run(1, { brake: true });
  run(1, { brake: false });
  const unsieged = !b.sieged && b.grounded;
  run(60, { throttle: 1 });
  const moved = Math.hypot(b.pos[0], b.pos[2]);
  run(150, { vertical: 1 });
  log.push(
    `unsieged-still-grounded=${unsieged} drove=${moved.toFixed(0)}m liftedOff=${!b.grounded}`,
  );
  // airborne siege: slow + Shift high above ground
  run(60, { throttle: -1 });
  run(1, { brake: true });
  log.push(`airSiege=${b.sieged && !b.grounded}`);
  sim2.dispose();
  return { log, ok: unsieged && !b.grounded && b.sieged && moved > 20 };
}
const bw = bulwark();
console.log('bulwark', bw.log.join(' | '));

// 3. Prediction equality: stepLocal vs server step, identical inputs, bit-compare.
function prediction(
  god: boolean,
  frame: FrameId,
  at: [number, number, number] | undefined,
  script: (i: number) => Partial<PilotInput>,
) {
  const a = fresh(true);
  const b = fresh(false);
  if (god) {
    a.tuning.god.add('p');
    b.tuning.god.add('p');
  }
  a.addShip('p', spawn(frame), at);
  b.addShip('p', spawn(frame), at);
  let worst = 0;
  const N = 400;
  for (let i = 0; i < N; i++) {
    const inp = mk(i + 1, script(i));
    a.step(new Map([['p', inp]]));
    b.stepLocal('p', inp);
    const sa = a.getShip('p')!;
    const sb = b.getShip('p')!;
    for (let k = 0; k < 3; k++)
      worst = Math.max(worst, Math.abs(sa.pos[k]! - sb.pos[k]!), Math.abs(sa.vel[k]! - sb.vel[k]!));
    for (let k = 0; k < 4; k++) worst = Math.max(worst, Math.abs(sa.rot[k]! - sb.rot[k]!));
    worst = Math.max(worst, Math.abs(sa.speed - sb.speed), Math.abs(sa.fuel - sb.fuel));
  }
  a.dispose();
  b.dispose();
  return worst;
}
const sweep = (i: number): Partial<PilotInput> => ({
  aim: [Math.sin(i / 20), Math.sin(i / 37) * 0.4, -Math.cos(i / 20)],
  strafe: i % 50 < 10 ? 1 : 0,
  boost: i % 90 < 30,
  throttle: (i % 70) / 35 - 1,
  rollLeft: i % 60 === 5,
  rollRight: i % 85 === 5,
  vertical: i % 120 > 100 ? 1 : 0,
  hotbar: i === 3 ? 0 : -1, // afterburn-dash for wasp
});
const eq = {
  flightRollBoostDash: prediction(false, 'wasp', [0, 600, 0], sweep),
  dockedLaunch: prediction(false, 'wasp', undefined, (i) => ({
    launch: i === 40,
    aim: [1, 0, -1],
  })),
  diveBounce: prediction(true, 'anvil', [0, 700, 0], () => ({ aim: [0.1, -1, 0.1], boost: true })),
  bulwarkGround: prediction(false, 'bulwark', [0, sampleHeight(hf, 0, 0) + 30, 0], (i) => ({
    aim: [0.3, 0, -1],
    vertical: i < 100 ? -1 : i > 250 ? 1 : 0,
    throttle: i < 100 ? -1 : 1,
    brake: i === 150 || i === 160,
    strafe: i % 40 < 10 ? 1 : 0,
  })),
};
console.log('prediction max |server-local| diff:', eq);

let failed = false;
const check = (ok: boolean, msg: string) => {
  if (!ok) {
    failed = true;
    console.error('FAIL: ' + msg);
  }
};
check(belowTerrain === 0, 'ships went below terrain');
check(negativeAmmo === 0, 'negative ammo');
check((counts.docked ?? 0) + (counts.launched ?? 0) > 0, 'no deck docking/launch events');
check(
  bounce.impact?.type === 'terrainImpact' &&
    bounce.impact.bounced &&
    bounce.shield === 0 &&
    bounce.hp < bounce.maxHp &&
    bounce.alive,
  'shield bounce rule',
);
check(
  crash.impact?.type === 'terrainImpact' && !crash.impact.bounced && !crash.alive,
  'no-shield crash rule',
);
check(bw.ok, 'bulwark ground mode');
for (const [k, v] of Object.entries(eq)) check(v === 0, `prediction mismatch ${k}: ${v}`);
check(spawned > 0, 'no projectiles spawned');
check(hits > 0, 'no projectile hit anything');
sim.dispose();
if (failed) process.exit(1);
console.log('smoke OK');
