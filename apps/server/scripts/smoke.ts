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
  mems.set(
    id,
    createBotMemory(hf, i + 1, map.launchDecks[i % 2 ? 'vex' : 'concord'], map.env.stallSpeed),
  );
}

let total = 0,
  max = 0,
  kills = 0,
  hits = 0,
  spawned = 0,
  impacts = 0,
  respawns = 0,
  rolls = 0;
let missileSum = 0,
  missileMax = 0,
  negativeAmmo = 0,
  belowTerrain = 0,
  minClearance = Infinity;
const counts: Record<string, number> = {};
for (let t = 0; t < TICKS; t++) {
  const inputs = new Map<ShipId, PilotInput>();
  for (const [id, mem] of mems) inputs.set(id, botBrain(sim, id, mem));
  const t0 = performance.now();
  const events: SimEvent[] = sim.step(inputs);
  const live = sim.missiles().length;
  missileSum += live;
  missileMax = Math.max(missileMax, live);
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
console.log(
  `missiles on wire: avg ${(missileSum / TICKS).toFixed(1)} max ${missileMax}; ~${JSON.stringify({ id: 123, pos: [1234.5, 456.7, -890.1], vel: [123.4, -56.7, 189.9], guided: true }).length} B each as JSON`,
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
  run(1, { hotbar: 0 }); // siege-anchor skill: grounded siege
  log.push(`sieged=${b.sieged}`);
  const sieged = b.sieged;
  run(35, {});
  run(1, { hotbar: 0 });
  run(35, {});
  const unsieged = !b.sieged && b.grounded;
  run(60, { throttle: 1 });
  const moved = Math.hypot(b.pos[0], b.pos[2]);
  run(150, { vertical: 1 });
  log.push(
    `unsieged-still-grounded=${unsieged} drove=${moved.toFixed(0)}m liftedOff=${!b.grounded}`,
  );
  // airborne and fast: the skill auto-brakes, then sieges once slow
  run(60, { throttle: 1 });
  run(1, { hotbar: 0 });
  const pending = b.siegePending && !b.sieged;
  run(90, {});
  log.push(`airSiegePending=${pending} airSiege=${b.sieged && !b.grounded}`);
  sim2.dispose();
  return { log, ok: sieged && unsieged && !b.grounded && pending && b.sieged && moved > 20 };
}
const bw = bulwark();
console.log('bulwark', bw.log.join(' | '));

// 2b. Missile evasion: a target that rolls at ~60 m vs one that flies straight.
function missileTrial(roll: boolean, k: number): 'hit' | 'evaded' | 'miss' {
  const sim2 = fresh(true);
  const dx = ((k * 37) % 21) * 10 - 100;
  const dy = ((k * 53) % 21) * 8 - 80;
  sim2.addShip('tgt', spawn('wasp', 'vex'), [0, 500, 0]);
  sim2.addShip('sh', spawn('wasp', 'concord'), [dx, 500 + dy, 420]);
  const tgt = sim2.getShip('tgt')!;
  const shooter = sim2.getShip('sh')!;
  let missileId = -1;
  let result: 'hit' | 'evaded' | 'miss' = 'miss';
  for (let i = 0; i < 360 && result === 'miss'; i++) {
    const rolling = roll && tgt.incomingDist > 0 && tgt.incomingDist < 60;
    const events = sim2.step(
      new Map([
        ['tgt', mk(i, { aim: [0, 0, -1], rollLeft: rolling })],
        [
          'sh',
          mk(i, {
            aim: [0, 0, -1],
            target: 'tgt',
            fire2: shooter.lockTarget !== null,
            throttle: -0.2,
          }),
        ],
      ]),
    );
    for (const e of events) {
      if (e.type === 'projectileSpawned' && e.kind === 'missile' && e.target && missileId < 0)
        missileId = e.id;
      if (e.type === 'missileEvaded' && e.id === missileId) result = 'evaded';
      if (e.type === 'hit' && e.projectile === missileId) result = 'hit';
    }
  }
  sim2.dispose();
  return result;
}
const TRIALS = 30;
const tally = (roll: boolean) => {
  const r = { hit: 0, evaded: 0, miss: 0 };
  for (let k = 0; k < TRIALS; k++) r[missileTrial(roll, k)]++;
  return r;
};
const rollRes = tally(true);
const straightRes = tally(false);
console.log('missile trials (30 each) roll@60m:', rollRes, 'straight:', straightRes);

// 2c. Soft boundary, ceiling, teleport, Barrel Roll curve, grounded/docked purity.
function edgeTest() {
  const sim2 = fresh(true);
  sim2.addShip('e', spawn('wasp'), [1500, 500, 0]);
  const e = sim2.getShip('e')!;
  let maxReach = 0,
    warned = false,
    turnedBack = false;
  for (let i = 0; i < 900; i++) {
    sim2.step(new Map([['e', mk(i, { aim: [1, 0, 0] })]]));
    maxReach = Math.max(maxReach, Math.abs(e.pos[0]));
    warned ||= e.outOfBounds;
    if (Math.abs(e.pos[0]) > 1560 && e.vel[0] < -20) turnedBack = true;
  }
  const hard = map.size / 2 - 20;
  const out = { maxReach, warned, returned: turnedBack };
  sim2.addShip('c', spawn('wasp'), [0, map.ceiling - 20, 0]);
  const c = sim2.getShip('c')!;
  let maxY = 0;
  for (let i = 0; i < 300; i++) {
    sim2.step(new Map([['c', mk(i, { aim: [0, 1, -0.3] })]]));
    maxY = Math.max(maxY, c.pos[1]);
  }
  sim2.dispose();
  return { ...out, hard, maxY, ceilingPinned: c.pos[1] > map.ceiling - 1 };
}
const edge = edgeTest();
console.log('edge/ceiling', edge);

function teleportTest() {
  const sim2 = fresh(true);
  sim2.addShip('t', spawn('wasp', 'concord')); // spawns docked
  const was = sim2.getShip('t')!.docked;
  sim2.teleport('t', [100, 600, 100]);
  const events = sim2.step(new Map([['t', mk(1, {})]]));
  const s = sim2.getShip('t')!;
  const ok =
    was &&
    !s.docked &&
    Math.hypot(s.pos[0] - 100, s.pos[2] - 100) < 30 &&
    events.some((e) => e.type === 'teleport');
  sim2.dispose();
  return ok;
}
const tpOk = teleportTest();

function rollTest() {
  const run = (roll: boolean) => {
    const sim2 = fresh(true);
    sim2.addShip('r', spawn('wasp'), [0, 600, 0]);
    const r = sim2.getShip('r')!;
    let phaseSeen = false;
    for (let i = 0; i < 30; i++) {
      sim2.step(new Map([['r', mk(i, { aim: [0, 0, -1], rollRight: roll && i === 2 })]]));
      phaseSeen ||= r.rollPhase > 0 && r.rollPhase < 1;
    }
    const pos = [...r.pos];
    sim2.dispose();
    return { pos, phaseSeen };
  };
  const a = run(true);
  const b = run(false);
  return { lateral: Math.abs(a.pos[0]! - b.pos[0]!), phaseSeen: a.phaseSeen };
}
const rollInfo = rollTest();
console.log('roll lateral displacement (m)', rollInfo.lateral.toFixed(1), 'tp', tpOk);

function purity() {
  const sim2 = fresh(true);
  const g = sampleHeight(hf, 0, 0);
  sim2.addShip('b', spawn('bulwark'), [0, g + 40, 0]);
  const b = sim2.getShip('b')!;
  let seq = 0;
  for (let i = 0; i < 400 && !b.grounded; i++)
    sim2.step(new Map([['b', mk(++seq, { vertical: -1, throttle: -1 })]]));
  for (let i = 0; i < 40; i++) sim2.step(new Map([['b', mk(++seq, {})]]));
  const x0 = b.pos[0],
    z0 = b.pos[2];
  for (let i = 0; i < 30; i++)
    sim2.step(new Map([['b', mk(++seq, { strafe: 1, rollRight: true })]]));
  const drift = Math.hypot(b.pos[0] - x0, b.pos[2] - z0);
  const grounded = b.grounded && b.rollPhase < 0;
  sim2.dispose();
  const sim3 = fresh(true);
  sim3.addShip('d', spawn('wasp', 'concord')); // docked
  const d = sim3.getShip('d')!;
  for (let i = 0; i < 20; i++)
    sim3.step(new Map([['d', mk(i, { aim: [Math.sin(i / 5), 0, -Math.cos(i / 5)], strafe: 1 })]]));
  const [qx, qy, qz, qw] = d.rot;
  const upY = 1 - 2 * (qx * qx + qz * qz);
  void qy;
  void qw;
  const dockOk = d.docked && upY > 0.999 && Math.hypot(d.vel[0], d.vel[1], d.vel[2]) === 0;
  sim3.dispose();
  return { drift, grounded, dockOk, upY };
}
const pure = purity();
console.log('grounded strafe drift', pure.drift.toFixed(2), 'docked upY', pure.upY.toFixed(4));

// 2d. Frame core kits: buff expiry, maxHp revert, auras, toggles, Purge.
function buffTests() {
  const sim2 = fresh(true);
  sim2.addShip('w', spawn('wasp'), [0, 600, 0]);
  const w = sim2.getShip('w')!;
  const idle = (n: number, extra: Record<string, Partial<PilotInput>> = {}) => {
    for (let k = 0; k < n; k++) {
      sim2.step(
        new Map(Object.entries(extra).map(([id, p]) => [id, mk(k, { aim: [0, 0, -1], ...p })])),
      );
    }
  };
  const ghostSlot = FRAMES.wasp.hotbar.indexOf('ghost-skin');
  idle(1, { w: { hotbar: ghostSlot } });
  const ghostOn = w.buffs.some((b) => b.skill === 'ghost-skin');
  idle(149, { w: {} });
  const stillOn = w.buffs.length === 1;
  idle(3, { w: {} });
  const expired = w.buffs.length === 0;
  const cooldownDone = w.cooldowns[ghostSlot] === 0;
  // Anvil: bulk-plating raises max HP, scales HP, and reverts on expiry.
  sim2.addShip('a', spawn('anvil'), [300, 600, 0]);
  const a = sim2.getShip('a')!;
  a.hp = a.maxHp / 2;
  const base = a.maxHp;
  const bulkSlot = FRAMES.anvil.hotbar.indexOf('bulk-plating');
  idle(1, { a: { hotbar: bulkSlot } });
  idle(1, { a: {} });
  const raised = Math.abs(a.maxHp - base * 1.25) < 1e-6 && Math.abs(a.hp - a.maxHp / 2) < 1;
  idle(3600, { a: {} });
  const reverted =
    a.buffs.length === 0 && Math.abs(a.maxHp - base) < 1e-6 && Math.abs(a.hp - base / 2) < 1;
  // Toggles + Air Barrage ammo.
  const defaultMode = a.toggles.bombing === 'air-barrage-mode';
  const before = a.ammo2;
  let spawnedRockets = 0;
  const ev = sim2.step(new Map([['a', mk(1, { aim: [0, 0, -1], fire2: true })]]));
  for (const e of ev) if (e.type === 'projectileSpawned' && e.owner === 'a') spawnedRockets++;
  const barrage = spawnedRockets === 3 && before - a.ammo2 === 3;
  idle(120, { a: {} });
  const gsSlot = FRAMES.anvil.hotbar.indexOf('ground-strike-mode');
  idle(1, { a: { hotbar: gsSlot } });
  const switched = a.toggles.bombing === 'ground-strike-mode' && a.cooldowns[gsSlot]! > 0;
  idle(70, { a: {} });
  let bombDown = false;
  for (const e of sim2.step(new Map([['a', mk(2, { aim: [0, 0, -1], fire2: true })]]))) {
    if (e.type === 'projectileSpawned' && e.owner === 'a' && e.dir[1] < -0.1) bombDown = true;
  }
  sim2.dispose();
  // Halo aura (Rally Field) reaches a nearby ally with the caster as source.
  const sim3 = fresh(true);
  sim3.addShip('h', spawn('halo', 'concord'), [0, 600, 0]);
  sim3.addShip('f', spawn('wasp', 'concord'), [60, 600, 0]);
  sim3.addShip('far', spawn('wasp', 'concord'), [900, 600, 0]);
  const rally = FRAMES.halo.hotbar.indexOf('rally-field');
  const evs = sim3.step(new Map([['h', mk(1, { hotbar: rally })]]));
  const used = evs.find((e) => e.type === 'skillUsed' && e.skill === 'rally-field');
  const aura =
    sim3.getShip('f')!.buffs[0]?.source === 'h' &&
    sim3.getShip('far')!.buffs.length === 0 &&
    used?.type === 'skillUsed' &&
    !!used.targets?.includes('f');
  sim3.dispose();
  return {
    ghostOn,
    stillOn,
    expired,
    cooldownDone,
    raised,
    reverted,
    defaultMode,
    barrage,
    switched,
    bombDown,
    aura,
  };
}
const buffRes = buffTests();
console.log('buffs', buffRes);

// Purge breaks missile guidance on the Halo.
function purgeTrial(k: number): boolean {
  const sim2 = fresh(true);
  sim2.addShip('tgt', spawn('halo', 'vex'), [0, 500, 0]);
  sim2.addShip('sh', spawn('wasp', 'concord'), [((k * 37) % 21) * 4 - 40, 500, 420]);
  const tgt = sim2.getShip('tgt')!;
  const shooter = sim2.getShip('sh')!;
  const slot = FRAMES.halo.hotbar.indexOf('purge');
  let missileId = -1;
  let purged = false;
  for (let i = 0; i < 360 && !purged; i++) {
    const ev = sim2.step(
      new Map([
        [
          'tgt',
          mk(i, {
            aim: [0, 0, -1],
            hotbar: tgt.incomingDist > 0 && tgt.incomingDist < 200 ? slot : -1,
          }),
        ],
        [
          'sh',
          mk(i, {
            aim: [0, 0, -1],
            target: 'tgt',
            fire2: shooter.lockTarget !== null,
            throttle: -0.2,
          }),
        ],
      ]),
    );
    for (const e of ev) {
      if (e.type === 'projectileSpawned' && e.kind === 'missile' && e.target && missileId < 0)
        missileId = e.id;
      if (e.type === 'missileEvaded' && e.id === missileId && e.reason === 'purge') purged = true;
    }
  }
  sim2.dispose();
  return purged;
}
let purges = 0;
for (let k = 0; k < 10; k++) if (purgeTrial(k)) purges++;
console.log('purge breaks guidance', purges, '/ 10');

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
  edgeOverride: prediction(false, 'wasp', [1500, 500, 0], () => ({ aim: [1, 0, 0] })),
  buffMovement: prediction(false, 'wasp', [0, 600, 0], (i) => ({
    ...sweep(i),
    hotbar: i === 3 ? 1 : i === 10 ? 2 : sweep(i).hotbar,
  })),
  dockedLaunch: prediction(false, 'wasp', undefined, (i) => ({
    launch: i === 40,
    aim: [1, 0, -1],
  })),
  diveBounce: prediction(true, 'anvil', [0, 700, 0], () => ({ aim: [0.1, -1, 0.1], boost: true })),
  bulwarkGround: prediction(false, 'bulwark', [0, sampleHeight(hf, 0, 0) + 30, 0], (i) => ({
    aim: [0.3, 0, -1],
    vertical: i < 100 ? -1 : i > 250 ? 1 : 0,
    throttle: i < 100 ? -1 : 1,
    hotbar: i === 150 || i === 200 ? 0 : -1,
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
check(Object.values(buffRes).every(Boolean), 'buff/toggle/aura checks: ' + JSON.stringify(buffRes));
check(purges >= 9, 'purge should break guidance');
check(
  edge.maxReach < edge.hard - 5 && edge.warned && edge.returned,
  'soft boundary should turn the ship back before the hard clamp',
);
check(!edge.ceilingPinned, 'ceiling should not pin the ship');
check(tpOk, '/tp teleport');
check(
  rollInfo.lateral > 20 && rollInfo.lateral < 40 && rollInfo.phaseSeen,
  'roll displacement ~30 m with rollPhase',
);
check(
  pure.drift < 0.5 && pure.grounded && pure.dockOk,
  'grounded strafe/roll and docked bank must be inert',
);
check(rollRes.hit <= TRIALS * 0.25, 'rolling target should mostly evade');
check(straightRes.hit >= TRIALS * 0.7, 'straight-flying target should mostly get hit');
for (const [k, v] of Object.entries(eq)) check(v === 0, `prediction mismatch ${k}: ${v}`);
check(spawned > 0, 'no projectiles spawned');
check(hits > 0, 'no projectile hit anything');
sim.dispose();
if (failed) process.exit(1);
console.log('smoke OK');
