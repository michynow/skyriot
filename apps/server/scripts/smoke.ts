import * as RAPIER from '@dimforge/rapier3d-compat';
import {
  FRAMES,
  RUSTWATER_CANYONS,
  createSim,
  generateHeightfield,
  sampleHeight,
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
    frame: frames[i % frames.length]!,
    name: id,
    isBot: true,
    tier: 1,
    upgrade: 0,
  });
  mems.set(id, createBotMemory(hf, i + 1));
}

let total = 0,
  max = 0,
  kills = 0,
  hits = 0,
  spawned = 0,
  impacts = 0,
  respawns = 0,
  rolls = 0;
let belowTerrain = 0,
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
  }
}

console.log(
  `ticks=${TICKS} ships=${SHIPS} avg=${(total / TICKS).toFixed(3)}ms max=${max.toFixed(3)}ms`,
);
console.log(
  `spawned=${spawned} hits=${hits} kills=${kills} respawns=${respawns} terrainImpacts=${impacts} rolls=${rolls}`,
);
console.log(`minClearance=${minClearance.toFixed(2)}m belowTerrainSamples=${belowTerrain}`, counts);

let failed = false;
const check = (ok: boolean, msg: string) => {
  if (!ok) {
    failed = true;
    console.error('FAIL: ' + msg);
  }
};
check(belowTerrain === 0, 'ships went below terrain');
check(spawned > 0, 'no projectiles spawned');
check(hits > 0, 'no projectile hit anything');
sim.dispose();
if (failed) process.exit(1);
console.log('smoke OK');
