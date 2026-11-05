import * as RAPIER from '@dimforge/rapier3d-compat';
import {
  FRAMES,
  GILDSPIRE,
  RUSTWATER_CANYONS,
  SKILLS,
  TICK_HZ,
  createSim,
  generateHeightfield,
  sampleHeight,
  EMPTY_INPUT,
  TICK_DT,
  WEAPONS,
  BOMB_DROP_SPEED,
  BOMB_GRAVITY,
  AIR_BARRAGE_COUNT,
  type FrameId,
  type PilotInput,
  type ShipId,
  type ShipState,
  type SimEvent,
} from '@skyriot/shared';
import { botBrain, createBotMemory } from '../src/bots/botBrain';
import { signTravel, verifyTravel } from '../src/travel';

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
    // Ships in the Launch Queue / tunnel sit inside the Base, below the terrain surface by design.
    if (!s.alive || s.launchPhase !== 'none') continue;
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
/** Add a Ship at rest just above its nation's first Launch Deck: its next tick docks. */
const atDeck = (
  sim2: ReturnType<typeof fresh>,
  id: ShipId,
  frame: FrameId,
  nation: 'concord' | 'vex' = 'vex',
) => {
  const deck = map.launchDecks[nation][0]!;
  const s = sim2.addShip(id, spawn(frame, nation), [
    deck.pos[0],
    deck.pos[1] + FRAMES[frame].radius + 1,
    deck.pos[2],
  ]);
  s.speed = 0;
  s.vel.fill(0);
  return s;
};

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

// 2. Bulwark: land with C, siege, lift off with C.
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
  for (let i = 0; i < 400 && !b.grounded; i++)
    run(1, { vertical: -1, throttle: -1, land: i === 0 });
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
  run(1, { land: true }); // C lifts off
  run(149, { vertical: 1 });
  log.push(
    `unsieged-still-grounded=${unsieged} drove=${moved.toFixed(0)}m liftedOff=${!b.grounded}`,
  );
  // airborne and fast: the skill auto-brakes, then sieges once slow
  run(60, { throttle: 1 });
  run(1, { hotbar: 0 }); // Ground Siege is refused while airborne
  const refused = !b.sieged && !b.siegePending;
  run(1, { hotbar: 1 }); // Air Siege
  const pending = b.siegePending && !b.sieged;
  run(90, {});
  log.push(`airSiegePending=${pending} airSiege=${b.sieged && !b.grounded}`);
  sim2.dispose();
  return {
    log,
    ok: sieged && unsieged && refused && !b.grounded && pending && b.sieged && moved > 20,
  };
}
const bw = bulwark();
console.log('bulwark', bw.log.join(' | '));

// 2a. Siege gun lock: a sieged Bulwark locks a jinking Wasp and every Primary round hits it;
// swinging the nose away drops the lock.
function siegeLockTest() {
  const sim2 = fresh(true);
  // A flat spot so the grounded hull sits level.
  let ox = 0;
  const slope = (x: number) =>
    Math.abs(sampleHeight(hf, x + 10, 0) - sampleHeight(hf, x - 10, 0)) +
    Math.abs(sampleHeight(hf, x, 10) - sampleHeight(hf, x, -10));
  for (let x = -1500; x <= 1500; x += 50) if (slope(x) < slope(ox)) ox = x;
  const g = sampleHeight(hf, ox, 0);
  sim2.addShip('b', spawn('bulwark'), [ox, g + 3, 0]);
  sim2.addShip('t', spawn('wasp', 'concord'), [ox - 150, g + 150, -650]);
  const b = sim2.getShip('b')!;
  const t = sim2.getShip('t')!;
  let seq = 0;
  let shots = 0,
    hits = 0,
    lockedTicks = 0;
  const step = (patch: Partial<PilotInput>, aimAtTarget: boolean) => {
    const aim: [number, number, number] = aimAtTarget
      ? [t.pos[0] - b.pos[0], t.pos[1] - b.pos[1], t.pos[2] - b.pos[2]]
      : [b.pos[0] - t.pos[0], 0, b.pos[2] - t.pos[2]];
    const ev = sim2.step(
      new Map([
        ['b', mk(++seq, { aim, target: 't', ...patch })],
        [
          't',
          mk(seq, {
            aim: [1, Math.sin(seq / 6) * 0.6, Math.cos(seq / 9) * 0.5],
            boost: seq % 40 < 15,
          }),
        ],
      ]),
    );
    for (const e of ev) {
      if (e.type === 'projectileSpawned' && e.owner === 'b') shots++;
      if (e.type === 'hit' && e.victim === 't') hits++;
    }
    t.hp = t.maxHp; // keep the target alive
    t.shield = t.maxShield;
  };
  for (let i = 0; i < 200 && !b.grounded; i++)
    step({ vertical: -1, throttle: -1, land: i === 0 }, true);
  step({ hotbar: 0 }, true);
  for (let i = 0; i < 150 && b.siegeLock !== 't'; i++) step({}, true);
  const acquired = b.sieged && b.siegeLock === 't';
  for (let i = 0; i < 90; i++) {
    step({ fire1: true }, true);
    if (b.siegeLock === 't') lockedTicks++;
  }
  for (let i = 0; i < 30; i++) step({}, true); // rounds in flight land
  // Swing away: the lock must drop once the Target is outside the break cone.
  let dropped = false;
  for (let i = 0; i < 240 && !dropped; i++) {
    step({}, false);
    dropped = b.siegeLock === null;
  }
  sim2.dispose();
  return { grounded: b.grounded, sieged: b.sieged, acquired, lockedTicks, shots, hits, dropped };
}
const siegeLock = siegeLockTest();
console.log('siege gun lock:', siegeLock);

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
            aim: [
              tgt.pos[0] - shooter.pos[0],
              tgt.pos[1] - shooter.pos[1],
              tgt.pos[2] - shooter.pos[2],
            ],
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

// 2b'. Lag compensation: a single dumb Anvil bomb fired when it hits with no lag must still hit when the
// shooter sees the world VIEW_LAG ticks late and fires that much later (150 ms each way + interp).
// (Primary rounds are accuracy rolls now; only physical projectiles hit-test in the shooter's past.)
const VIEW_LAG = 15;
function shotHits(fireTick: number, viewTick: number): boolean {
  const sim2 = fresh(true);
  sim2.addShip('t', spawn('wasp', 'concord'), [-400, 600, -150]);
  // Lagged shooter starts further back so it fires from the same spot (it flies straight at cruise).
  const back = (fireTick - viewTick) * FRAMES.anvil.cruiseSpeed * TICK_DT;
  sim2.addShip('sh', spawn('anvil'), [0, 600, 450 + back]);
  let hit = false;
  for (let i = 0; i < fireTick + 200 && !hit; i++) {
    const ev = sim2.step(
      new Map([
        ['t', mk(i, { aim: [1, 0, 0] })],
        ['sh', mk(i, { aim: [0, 0, -1], fire2: i === fireTick, viewTick })],
      ]),
    );
    hit = ev.some((e) => e.type === 'hit' && e.victim === 't');
  }
  sim2.dispose();
  return hit;
}
const lagComp = { hitWindow: 0, lagged: 0 };
for (let f = 0; f < 150; f++) {
  if (!shotHits(f, f)) continue;
  lagComp.hitWindow++;
  if (shotHits(f + VIEW_LAG, f)) lagComp.lagged++;
}
console.log(`lag comp (${VIEW_LAG} ticks view lag): hits`, lagComp);

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
  sim2.addShip('t', spawn('wasp', 'concord')); // humans spawn in the hangar
  const was = sim2.getShip('t')!.launchPhase === 'hangar';
  sim2.teleport('t', [100, 600, 100]);
  const events = sim2.step(new Map([['t', mk(1, {})]]));
  const s = sim2.getShip('t')!;
  const ok =
    was &&
    !s.docked &&
    s.launchPhase === 'none' &&
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
    sim2.step(new Map([['b', mk(++seq, { vertical: -1, throttle: -1, land: i === 0 })]]));
  for (let i = 0; i < 40; i++) sim2.step(new Map([['b', mk(++seq, {})]]));
  const x0 = b.pos[0],
    z0 = b.pos[2];
  for (let i = 0; i < 30; i++)
    sim2.step(new Map([['b', mk(++seq, { strafe: 1, rollRight: true })]]));
  const drift = Math.hypot(b.pos[0] - x0, b.pos[2] - z0);
  const grounded = b.grounded && b.rollPhase < 0;
  sim2.dispose();
  const sim3 = fresh(true);
  const d = atDeck(sim3, 'd', 'wasp', 'concord');
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

/** Land on the own Launch Deck, resupply, launch: both events fire. */
function deckTest() {
  const sim2 = fresh(true);
  const s = atDeck(sim2, 'k', 'anvil');
  const seen = new Set<string>();
  for (let i = 0; i < 90; i++)
    for (const e of sim2.step(new Map([['k', mk(i + 1, { launch: i === 80 })]]))) seen.add(e.type);
  sim2.dispose();
  return {
    docked: seen.has('docked'),
    resupplied: seen.has('resupplied'),
    launched: seen.has('launched'),
    flying: !s.docked,
  };
}
const deck = deckTest();
console.log('deck', deck);
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
  const hotSlot = FRAMES.wasp.hotbar.indexOf('trim-tabs');
  const hotTicks = Math.ceil(SKILLS['trim-tabs']!.durationSec * TICK_HZ);
  idle(1, { w: { hotbar: hotSlot } });
  const hotOn = w.buffs.some((b) => b.skill === 'trim-tabs');
  idle(hotTicks - 1, { w: {} });
  const stillOn = w.buffs.length === 1;
  idle(3, { w: {} });
  const expired = w.buffs.length === 0;
  const cooldownRunning = w.cooldowns[hotSlot]! > 0;
  sim2.addShip('a', spawn('anvil'), [300, 600, 0]);
  const a = sim2.getShip('a')!;
  // Toggles: bombing starts off, a press turns Air Barrage on (then its ammo use).
  const abSlot = FRAMES.anvil.hotbar.indexOf('air-barrage-mode');
  const startsOff = a.toggles.bombing === undefined;
  idle(1, { a: { hotbar: abSlot } });
  const defaultMode = startsOff && a.toggles.bombing === 'air-barrage-mode';
  idle(70, { a: {} });
  const before = a.ammo2;
  let spawnedRockets = 0;
  const ev = sim2.step(new Map([['a', mk(1, { aim: [0, 0, -1], fire2: true })]]));
  for (const e of ev) if (e.type === 'projectileSpawned' && e.owner === 'a') spawnedRockets++;
  const barrage = spawnedRockets === AIR_BARRAGE_COUNT && before - a.ammo2 === AIR_BARRAGE_COUNT;
  idle(120, { a: {} });
  const gsSlot = FRAMES.anvil.hotbar.indexOf('ground-strike-mode');
  idle(1, { a: { hotbar: gsSlot } });
  const switched = a.toggles.bombing === 'ground-strike-mode' && a.cooldowns[gsSlot]! > 0;
  idle(70, { a: {} });
  let bombDown = false;
  for (const e of sim2.step(new Map([['a', mk(2, { aim: [0, 0, -1], fire2: true })]]))) {
    if (e.type === 'projectileSpawned' && e.owner === 'a' && e.dir[1] < -0.1) bombDown = true;
  }
  // Pressing the active mode turns bombing off again.
  idle(70, { a: {} });
  idle(1, { a: { hotbar: gsSlot } });
  const toggledOff = a.toggles.bombing === undefined;
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
    hotOn,
    stillOn,
    expired,
    cooldownRunning,
    defaultMode,
    barrage,
    switched,
    toggledOff,
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
            aim: [
              tgt.pos[0] - shooter.pos[0],
              tgt.pos[1] - shooter.pos[1],
              tgt.pos[2] - shooter.pos[2],
            ],
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

// 2d. Targeting rules (docs/specs/targeting.md).
/** A Wasp with a Wasp straight ahead (`ahead` m), both flying the same way. */
function duel(frame: FrameId, ahead: number, offX = 0) {
  const sim2 = fresh(true);
  sim2.addShip('t', spawn('wasp', 'concord'), [offX, 600, -ahead]);
  sim2.addShip('sh', spawn(frame), [0, 600, 0]);
  const t = sim2.getShip('t')!;
  const sh = sim2.getShip('sh')!;
  // Same heading, same speed: the gap holds.
  for (const x of [t, sh]) {
    x.rot[0] = x.rot[1] = x.rot[2] = 0;
    x.rot[3] = 1;
  }
  return { sim2, t, sh };
}
const toT = (sh: ShipState, t: ShipState): [number, number, number] => [
  t.pos[0] - sh.pos[0],
  t.pos[1] - sh.pos[1],
  t.pos[2] - sh.pos[2],
];

// No Target selected: the Primary fires tracers but deals 0 damage; with the Target it hits.
function stdTargetTest() {
  const out = { spawnedNone: 0, hitsNone: 0, spawnedTarget: 0, hitsTarget: 0 };
  for (const withTarget of [false, true]) {
    const { sim2, t, sh } = duel('wasp', 300);
    for (let i = 0; i < 90; i++) {
      const ev = sim2.step(
        new Map([
          ['t', mk(i, { aim: [0, 0, -1] })],
          ['sh', mk(i, { aim: toT(sh, t), fire1: i < 60, target: withTarget ? 't' : null })],
        ]),
      );
      for (const e of ev) {
        if (e.type === 'projectileSpawned' && e.owner === 'sh')
          out[withTarget ? 'spawnedTarget' : 'spawnedNone']++;
        if (e.type === 'hit' && e.victim === 't' && e.damage > 0)
          out[withTarget ? 'hitsTarget' : 'hitsNone']++;
      }
      t.hp = t.maxHp;
    }
    sim2.dispose();
  }
  return out;
}
const stdRes = stdTargetTest();
console.log('std target rule:', stdRes);

// ADV: Target in ADV range but outside the Valid Angle = the salvo dumb-fires (no Target, no homing, no
// warning); with the nose on it the Target is LOCKED and the very tick the trigger is pulled the salvo is guided.
function advAngleTest() {
  const out = { dumb: 0, dumbGuided: 0, lockTick: -1, guidedTick: -1 };
  {
    const { sim2, t, sh } = duel('wasp', 700, 300); // ~23 degrees off the nose
    for (let i = 0; i < 30; i++) {
      const ev = sim2.step(
        new Map([
          ['t', mk(i, { aim: [0, 0, -1] })],
          ['sh', mk(i, { aim: [0, 0, -1], fire2: true, target: 't' })],
        ]),
      );
      for (const e of ev) {
        if (e.type === 'projectileSpawned' && e.owner === 'sh') out.dumb++;
        if (
          (e.type === 'projectileSpawned' && e.owner === 'sh' && e.target) ||
          e.type === 'missileIncoming'
        )
          out.dumbGuided++;
      }
    }
    void t;
    sim2.dispose();
  }
  const { sim2, t, sh } = duel('wasp', 700, 300);
  for (let i = 0; i < 200 && out.guidedTick < 0; i++) {
    const pull = out.lockTick >= 0; // pull the trigger the tick after the HUD shows LOCKED
    const ev = sim2.step(
      new Map([
        ['t', mk(i, { aim: [0, 0, -1] })],
        ['sh', mk(i, { aim: toT(sh, t), fire2: pull, target: 't' })],
      ]),
    );
    if (
      pull &&
      ev.some((e) => e.type === 'projectileSpawned' && e.owner === 'sh' && e.target === 't')
    )
      out.guidedTick = i;
    if (out.lockTick < 0 && sh.lockTarget === 't') out.lockTick = i;
  }
  sim2.dispose();
  return out;
}
const advRes = advAngleTest();
console.log('adv valid angle:', advRes);

// Continuous Primary fire overheats after the weapon's overheatSec, then cools for half that before firing again.
function overheatTest() {
  const { sim2, t, sh } = duel('wasp', 300);
  const w = WEAPONS[FRAMES.wasp.primary]!;
  let hotAt = -1,
    coolAt = -1,
    firedHot = 0;
  for (let i = 0; i < Math.ceil(w.overheatSec * 1.8 * TICK_HZ) && coolAt < 0; i++) {
    const ev = sim2.step(
      new Map([
        ['t', mk(i, { aim: [0, 0, -1] })],
        ['sh', mk(i, { aim: [0, 0, -1], fire1: true })],
      ]),
    );
    const fired = ev.some((e) => e.type === 'projectileSpawned' && e.owner === 'sh');
    if (hotAt < 0 && sh.overheated) hotAt = i;
    else if (hotAt >= 0 && sh.overheated && fired) firedHot++;
    else if (hotAt >= 0 && !sh.overheated) coolAt = i;
    sh.ammo1 = 1000;
    t.hp = t.maxHp;
  }
  sim2.dispose();
  return {
    overheatSec: w.overheatSec,
    hotSec: hotAt / TICK_HZ,
    coolSec: (coolAt - hotAt) / TICK_HZ,
    firedHot,
  };
}
const heatRes = overheatTest();
console.log('overheat:', heatRes);

// Bulwark salvo (2 x 2 straight shells): the first volley goes at the locked Target; lose the lock before the
// second and it flies off the nose, unaimed and unannounced.
function salvoLockTest() {
  const { sim2, t, sh } = duel('bulwark', 600);
  const vols: (string | null)[][] = [];
  let incoming = 0,
    ended = 0;
  let broke = false;
  for (let i = 0; i < 120; i++) {
    const ev = sim2.step(
      new Map([
        ['t', mk(i, { aim: [0, 0, -1] })],
        ['sh', mk(i, { aim: toT(sh, t), fire2: i === 5, target: 't' })],
      ]),
    );
    const vol = ev.filter((e) => e.type === 'projectileSpawned' && e.owner === 'sh');
    if (vol.length) vols.push(vol.map((e) => (e.type === 'projectileSpawned' ? e.target : null)));
    incoming += ev.filter((e) => e.type === 'missileIncoming' && e.target === 't').length;
    ended += ev.filter((e) => e.type === 'missileEnded').length;
    if (vols.length === 1 && !broke) {
      // Jump the Target far behind: out of the Valid Angle.
      sim2.teleport('t', [sh.pos[0], sh.pos[1], sh.pos[2] + 500]);
      broke = true;
    }
    t.hp = t.maxHp;
  }
  sim2.dispose();
  return { vols, incoming, ended };
}
const salvoRes = salvoLockTest();
console.log('bulwark salvo lock:', JSON.stringify(salvoRes));

// Anvil bombing modes: share of salvos that damage the Target, with a realistic aim error.
// Air Barrage: a Wasp head-on from 600 m. Ground Strike: a grounded Bulwark, Anvil 120 m above.
function barrageTrial(k: number): boolean {
  // Head-on pass; the salvo is aimed at the Target's centre line with up to ~30 m error; the Target jinks.
  const { sim2, t, sh } = duel('anvil', 600, ((k % 7) - 3) * 10);
  t.pos[1] += ((k % 5) - 2) * 10;
  t.rot[1] = 1;
  t.rot[3] = 0;
  sim2.castSkill('sh', 'air-barrage-mode');
  let hit = false;
  for (let i = 0; i < 150 && !hit; i++) {
    const ev = sim2.step(
      new Map([
        ['t', mk(i, { aim: [Math.sin(i / 9 + k) * 0.15, Math.cos(i / 7 + k) * 0.1, 1] })],
        ['sh', mk(i, { aim: [0, 0, -1], fire2: i === 3 })],
      ]),
    );
    hit = ev.some((e) => e.type === 'hit' && e.victim === 't' && e.damage > 0);
  }
  sim2.dispose();
  return hit;
}
function strikeTrial(k: number): boolean {
  const sim2 = fresh(true);
  let ox = 0;
  const slope = (x: number) =>
    Math.abs(sampleHeight(hf, x + 10, 0) - sampleHeight(hf, x - 10, 0)) +
    Math.abs(sampleHeight(hf, x, 10) - sampleHeight(hf, x, -10));
  for (let x = -1500; x <= 1500; x += 50) if (slope(x) < slope(ox)) ox = x;
  const g = sampleHeight(hf, ox, 0);
  sim2.addShip('t', spawn('bulwark', 'concord'), [ox, g + 3, 0]);
  const t = sim2.getShip('t')!;
  for (let i = 0; i < 200 && !t.grounded; i++)
    sim2.step(new Map([['t', mk(i, { vertical: -1, throttle: -1, land: i === 0 })]]));
  // Aim error: the drop point misses by up to ~40 m sideways and 20 m long/short.
  const miss = ((k % 7) - 3) * 13;
  sim2.addShip('sh', spawn('anvil'), [t.pos[0] + miss, t.pos[1] + 120, 900]);
  const sh = sim2.getShip('sh')!;
  sh.rot[0] = sh.rot[1] = sh.rot[2] = 0;
  sh.rot[3] = 1;
  sim2.castSkill('sh', 'ground-strike-mode');
  let hit = false,
    dropped = false;
  for (let i = 0; i < 400 && !hit; i++) {
    // Drop when the falling bomb lands on the Target's line (vel z only, ballistic fall).
    const h = sh.pos[1] - t.pos[1];
    const vy = sh.vel[1] - BOMB_DROP_SPEED;
    const tf = (vy + Math.sqrt(vy * vy + 2 * BOMB_GRAVITY * h)) / BOMB_GRAVITY;
    const fire: boolean = !dropped && sh.pos[2] + sh.vel[2] * tf <= t.pos[2] + ((k % 3) - 1) * 20;
    dropped ||= fire;
    const ev = sim2.step(
      new Map([
        ['t', mk(i, {})],
        ['sh', mk(i, { aim: [0, 0, -1], fire2: fire })],
      ]),
    );
    hit = ev.some((e) => e.type === 'hit' && e.victim === 't' && e.damage > 0);
  }
  sim2.dispose();
  return hit;
}
const bombRes = { barrage: 0, strike: 0, of: 21 };
for (let k = 0; k < bombRes.of; k++) {
  if (barrageTrial(k)) bombRes.barrage++;
  if (strikeTrial(k)) bombRes.strike++;
}
console.log('anvil bombing hit rate:', bombRes);

// 3. Prediction equality: stepLocal (with reconcile + replay) vs server step, bit-compare.
function prediction(
  god: boolean,
  frame: FrameId,
  at: [number, number, number] | 'deck',
  script: (i: number) => Partial<PilotInput>,
) {
  const a = fresh(true);
  const b = fresh(false);
  if (god) {
    a.tuning.god.add('p');
    b.tuning.god.add('p');
  }
  for (const sim2 of [a, b]) {
    if (at === 'deck') atDeck(sim2, 'p', frame);
    else sim2.addShip('p', spawn(frame), at);
  }
  let worst = 0;
  const N = 400;
  // Like the Predictor: every SNAP ticks the client gets the server state from LAG ticks ago,
  // overwrites its own, and replays the inputs since. Hidden state that isn't rebuilt shows here.
  const SNAP = 3,
    LAG = 9;
  const inputs: PilotInput[] = [];
  const snaps: ShipState[] = [];
  for (let i = 0; i < N; i++) {
    const inp = mk(i + 1, script(i));
    inputs.push(inp);
    a.step(new Map([['p', inp]]));
    snaps.push(structuredClone(a.getShip('p')!));
    if (i % SNAP === 0 && i >= LAG) {
      b.setShipState('p', structuredClone(snaps[i - LAG]!));
      for (let j = i - LAG + 1; j <= i; j++) b.stepLocal('p', inputs[j]!);
    } else b.stepLocal('p', inp);
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
  dockedLaunch: prediction(false, 'wasp', 'deck', (i) => ({
    launch: i === 40,
    aim: [1, 0, -1],
  })),
  diveBounce: prediction(true, 'anvil', [0, 700, 0], () => ({ aim: [0.1, -1, 0.1], boost: true })),
  ceilingClimb: prediction(false, 'wasp', [0, map.ceiling - 40, 0], (i) => ({
    aim: [Math.sin(i / 15), 0.8, -1],
    vertical: 1,
    boost: i % 80 < 40,
  })),
  floorSkim: prediction(true, 'wasp', [300, sampleHeight(hf, 300, 0) + 15, 0], (i) => ({
    aim: [Math.sin(i / 25), -0.3, -1],
    vertical: -1,
    strafe: i % 30 < 15 ? 1 : -1,
  })),
  ...Object.fromEntries(
    frames.map((f) => [
      `hotbarAllBars_${f}`,
      prediction(true, f, [0, 600, 0], (i) => ({
        ...sweep(i),
        // Every slot of all three bars, one press each, spaced so most come off cooldown.
        hotbar: i % 13 === 0 ? (i / 13) % FRAMES[f].hotbar.length : -1,
      })),
    ]),
  ),
  bulwarkGround: prediction(false, 'bulwark', [0, sampleHeight(hf, 0, 0) + 30, 0], (i) => ({
    aim: [0.3, 0, -1],
    vertical: i < 100 ? -1 : i > 250 ? 1 : 0,
    throttle: i < 100 ? -1 : 1,
    hotbar: i === 150 || i === 200 ? 0 : -1,
    strafe: i % 40 < 10 ? 1 : 0,
  })),
};
console.log('prediction max |server-local| diff:', eq);

// 4. City: no Bases, humans spawn flying (not in a hangar), terrain dives and weapons are harmless.
function cityTest() {
  const city = createSim(GILDSPIRE, { rapier: RAPIER, authoritative: true });
  const s = city.addShip('h', {
    nation: 'vex',
    frame: 'wasp',
    name: 'h',
    isBot: false,
    tier: 1,
    upgrade: 0,
  });
  const spawnOk = s.launchPhase === 'none' && s.alive;
  let fired = 0;
  for (let i = 0; i < 300; i++) {
    const ev = city.step(
      new Map([
        [
          'h',
          {
            ...EMPTY_INPUT,
            seq: i + 1,
            viewTick: 0,
            aim: [0, -1, -0.2],
            throttle: 1,
            fire1: true,
            fire2: true,
          },
        ],
      ]),
    );
    fired += ev.filter((e) => e.type === 'projectileSpawned').length;
  }
  const res = {
    spawnOk,
    fired,
    alive: s.alive,
    hp: s.hp === s.maxHp,
    structures: city.structures().length,
  };
  city.dispose();
  return res;
}
const cityRes = cityTest();
console.log('city:', cityRes);
const tok = signTravel({
  shipId: 'x',
  name: 'n',
  nation: 'vex',
  frame: 'halo',
  from: 'a',
  to: 'b',
});
const tamper = tok.slice(0, -2) + (tok.endsWith('A') ? 'BB' : 'AA');
const travelOk =
  verifyTravel(tok, 'b')?.frame === 'halo' && !verifyTravel(tok, 'a') && !verifyTravel(tamper, 'b');

let failed = false;
const check = (ok: boolean, msg: string) => {
  if (!ok) {
    failed = true;
    console.error('FAIL: ' + msg);
  }
};
check(belowTerrain === 0, 'ships went below terrain');
check(negativeAmmo === 0, 'negative ammo');
check(Object.values(deck).every(Boolean), 'deck dock/resupply/launch: ' + JSON.stringify(deck));
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
check(
  siegeLock.acquired &&
    siegeLock.lockedTicks > 80 &&
    siegeLock.shots > 0 &&
    siegeLock.hits === siegeLock.shots &&
    siegeLock.dropped,
  'siege gun lock: ' + JSON.stringify(siegeLock),
);
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
// Reconcile rebuilds hidden lateral velocity from vel, which leaves float rounding (~1e-14).
for (const [k, v] of Object.entries(eq)) check(v < 1e-6, `prediction mismatch ${k}: ${v}`);
check(
  lagComp.hitWindow > 0 && lagComp.lagged === lagComp.hitWindow,
  'lag comp: shots that hit unlagged must hit at the same view time',
);
check(spawned > 0, 'no projectiles spawned');
check(hits > 0, 'no projectile hit anything');
check(
  cityRes.spawnOk && cityRes.fired === 0 && cityRes.alive && cityRes.hp && cityRes.structures === 0,
  'city safe zone: ' + JSON.stringify(cityRes),
);
check(travelOk, 'travel token sign/verify/tamper');
check(
  bombRes.barrage >= bombRes.of * 0.8 && bombRes.strike >= bombRes.of * 0.8,
  'Anvil bombing salvos near the Target should mostly hit: ' + JSON.stringify(bombRes),
);
check(
  stdRes.spawnedNone > 0 && stdRes.hitsNone === 0 && stdRes.hitsTarget > 0,
  'Primary with no Target must deal 0 damage (and hit with one): ' + JSON.stringify(stdRes),
);
check(
  advRes.dumb > 0 && advRes.dumbGuided === 0 && advRes.guidedTick === advRes.lockTick + 1,
  'Secondary dumb-fires outside the Valid Angle, guided the tick it is pulled while LOCKED: ' +
    JSON.stringify(advRes),
);
check(
  Math.abs(heatRes.hotSec - heatRes.overheatSec) < 0.5 &&
    Math.abs(heatRes.coolSec - heatRes.overheatSec * 0.5) < 0.2 &&
    heatRes.firedHot === 0,
  'overheat after overheatSec, cool for half: ' + JSON.stringify(heatRes),
);
check(
  salvoRes.vols.length === 2 &&
    salvoRes.vols[0]!.every((x) => x === 't') &&
    salvoRes.vols[1]!.every((x) => x === null) &&
    salvoRes.incoming === 1 &&
    salvoRes.ended === 2,
  'Bulwark salvo needs the lock held: ' + JSON.stringify(salvoRes),
);
sim.dispose();
if (failed) process.exit(1);
console.log('smoke OK');
