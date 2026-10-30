import * as RAPIER from '@dimforge/rapier3d-compat';
import { EMPTY_INPUT, RUSTWATER_CANYONS, createSim, generateHeightfield, type PilotInput, type ShipId, FRAMES, type FrameId } from '@skyriot/shared';
import { botBrain, createBotMemory } from '../src/bots/botBrain';
await RAPIER.init();
const map = RUSTWATER_CANYONS; const hf = generateHeightfield(map);
const sim = createSim(map, { rapier: RAPIER, authoritative: true });
const frames = Object.keys(FRAMES) as FrameId[];
const mems = new Map<ShipId, ReturnType<typeof createBotMemory>>();
for (let i = 0; i < 40; i++) { const id = `bot${i}`; const n = i % 2 ? 'vex' : 'concord'; sim.addShip(id, { nation: n, frame: frames[(i >> 1) % 4]!, name: id, isBot: true, tier: 1, upgrade: 0 }); mems.set(id, createBotMemory(hf, i + 1, map.launchDecks[n])); }
sim.addShip('w', { nation: 'concord', frame: 'wasp', name: 'x', isBot: false, tier: 1, upgrade: 0 }, [-1500, 450, -1500]);
sim.tuning.god.add('w');
const w = sim.getShip('w')!;
for (let i = 0; i < 6000; i++) {
  const inputs = new Map<ShipId, PilotInput>();
  for (const [id, m] of mems) inputs.set(id, botBrain(sim, id, m));
  inputs.set('w', { seq: i, viewTick: 0, ...EMPTY_INPUT, aim: [-1, 0, 0] });
  const evs = sim.step(inputs);
  for (const e of evs) if ((e.type === 'shipDestroyed' && e.victim === 'w') || (e.type === 'shipRespawned' && e.id === 'w') || (e.type === 'docked' && e.id === 'w')) console.log(i, e.type);
  if (i % 600 === 0) console.log(i, w.alive, w.docked, w.pos.map((v) => v.toFixed(0)).join(','), 'hp', w.hp.toFixed(0), 'sh', w.shield.toFixed(0));
}
