// Server tick budget check (PRD §13: 20 v 20 bots, tick ≤ 8 ms at 30 Hz).
// Times one MapRoom-shaped tick: bot brains + sim.step, plus the shared snapshot pack.
// `npx tsx scripts/bench.ts [ticks]`; add `--cpu-prof` to node for a profile.
import * as RAPIER from '@dimforge/rapier3d-compat';
import {
  BOTS_PER_NATION,
  FRAMES,
  RUSTWATER_CANYONS,
  createSim,
  generateHeightfield,
  type FrameId,
  type PilotInput,
  type ShipId,
} from '@skyriot/shared';
import { botBrain, createBotMemory } from '../src/bots/botBrain';
import { packShared } from '../src/rooms/snapshotFrame';

const TICKS = Number(process.argv[2] ?? 3000);
const WARMUP = 150;

await RAPIER.init();
const map = RUSTWATER_CANYONS;
const hf = generateHeightfield(map);
const sim = createSim(map, { rapier: RAPIER, authoritative: true });
const frames = Object.keys(FRAMES) as FrameId[];
const mems = new Map<ShipId, ReturnType<typeof createBotMemory>>();
for (let i = 0; i < BOTS_PER_NATION * 2; i++) {
  const id = `bot${i}`;
  const nation = i % 2 ? 'vex' : 'concord';
  sim.addShip(id, {
    nation,
    frame: frames[(i >> 1) % frames.length]!,
    name: id,
    isBot: true,
    tier: 1,
    upgrade: 0,
  });
  mems.set(id, createBotMemory(hf, i * 7919, map.launchDecks[nation]));
}

const brain: number[] = [];
const step: number[] = [];
const tick: number[] = [];
const pack: number[] = [];
const inputs = new Map<ShipId, PilotInput>();
for (let t = 0; t < TICKS + WARMUP; t++) {
  const t0 = performance.now();
  inputs.clear();
  for (const [id, mem] of mems) inputs.set(id, botBrain(sim, id, mem));
  const t1 = performance.now();
  sim.step(inputs);
  const t2 = performance.now();
  if (t % 3 === 0) {
    // Snapshots run at 20 Hz vs the 30 Hz tick; sample the shared pack every third tick.
    packShared([...sim.ships()], sim.structures(), sim.match());
    if (t >= WARMUP) pack.push(performance.now() - t2);
  }
  if (t < WARMUP) continue;
  brain.push(t1 - t0);
  step.push(t2 - t1);
  tick.push(t2 - t0);
}

const stats = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const mean = s.reduce((a, b) => a + b, 0) / s.length;
  const p = (q: number) => s[Math.min(s.length - 1, Math.floor(q * s.length))]!;
  return `mean ${mean.toFixed(3)}  p95 ${p(0.95).toFixed(3)}  p99 ${p(0.99).toFixed(3)}  max ${s[s.length - 1]!.toFixed(3)} ms`;
};
console.log(`ticks=${TICKS} ships=${mems.size} map=${map.id}`);
console.log(`brains  ${stats(brain)}`);
console.log(`step    ${stats(step)}`);
console.log(`tick    ${stats(tick)}`);
console.log(`pack    ${stats(pack)}`);
