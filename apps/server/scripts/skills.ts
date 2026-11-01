// Smoke check for the Frame Skill kits: casts every kit Skill on a headless authoritative sim and asserts
// its effect. Run: pnpm --filter @skyriot/server exec tsx scripts/skills.ts
import * as RAPIER from '@dimforge/rapier3d-compat';
import {
  EMPTY_INPUT,
  FRAMES,
  RUSTWATER_CANYONS,
  SKILLS,
  createSim,
  isCloaked,
  type FrameId,
  type PilotInput,
  type ShipId,
  type ShipState,
} from '@skyriot/shared';

await RAPIER.init();
const sim = createSim(RUSTWATER_CANYONS, { rapier: RAPIER, authoritative: true });
const add = (id: string, nation: 'concord' | 'vex', frame: FrameId) =>
  sim.addShip(id, { nation, frame, name: id, isBot: true, tier: 1, upgrade: 0 });
for (const f of Object.keys(FRAMES) as FrameId[]) add(f, 'concord', f);
add('foe', 'vex', 'bulwark');

let seq = 0;
const input = (o: Partial<PilotInput> = {}): PilotInput => ({
  ...EMPTY_INPUT,
  seq: ++seq,
  viewTick: sim.tick,
  ...o,
});
const step = (n = 1, per: Record<string, Partial<PilotInput>> = {}) => {
  for (let i = 0; i < n; i++)
    sim.step(new Map(Object.entries(per).map(([id, o]) => [id as ShipId, input(o)])));
};
const ship = (id: string): ShipState => sim.getShip(id)!;
const fwd = (s: ShipState) => {
  const [x, y, z, w] = s.rot;
  return [-2 * (x * z + w * y), -2 * (y * z - w * x), -(1 - 2 * (x * x + y * y))];
};
/** Stack the team on one spot and put the foe `ahead` metres in front of `caster`. */
const place = (caster: string, ahead: number) => {
  for (const f of Object.keys(FRAMES)) sim.teleport(f, [0, 400, 0]);
  step();
  const s = ship(caster);
  const d = fwd(s);
  sim.teleport('foe', [
    s.pos[0] + d[0]! * ahead,
    s.pos[1] + d[1]! * ahead,
    s.pos[2] + d[2]! * ahead,
  ]);
  const foe = ship('foe');
  foe.hp = foe.maxHp;
  foe.shield = 0;
  foe.buffs.length = 0;
  step();
};
const has = (id: string, skill: string) => ship(id).buffs.some((b) => b.skill === skill);
let failed = 0;
const check = (name: string, ok: boolean) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`);
  if (!ok) failed++;
};

// Every kit Skill has a working cast on its Frame.
for (const def of Object.values(SKILLS)) {
  if (def.frames === 'all') continue;
  for (const f of def.frames) {
    place(f, 100);
    // The active mode of a toggle group can't be re-selected.
    const active = def.toggleGroup && ship(f).toggles[def.toggleGroup] === def.id;
    check(`cast ${def.id} on ${f}`, active || sim.castSkill(f, def.id));
  }
}

place('wasp', 100);
sim.castSkill('wasp', 'shroud-veil');
step();
check('shroud-veil cloaks', isCloaked(ship('wasp')));
step(2, { wasp: { fire1: true } });
check('firing drops shroud-veil', !isCloaked(ship('wasp')));

place('wasp', 200);
sim.castSkill('wasp', 'snare-tag');
check('snare-tag debuffs the foe ahead', has('foe', 'snare-tag'));

place('anvil', 0);
const hpCinder = ship('foe').hp;
sim.castSkill('anvil', 'cinder-cloud');
step(30);
check('cinder-cloud burns the foe inside', ship('foe').hp < hpCinder);

place('halo', 60);
sim.castSkill('halo', 'sapping-hex');
check('sapping-hex weakens nearby foe', has('foe', 'sapping-hex'));
ship('anvil').hp = 1000;
sim.castSkill('halo', 'renewal-pulse');
step(30);
check('renewal-pulse heals allies over time', ship('anvil').hp > 1000);
sim.castSkill('halo', 'ward-lattice');
check('ward-lattice reaches allies', has('wasp', 'ward-lattice'));

place('bulwark', 140);
const hpQuake = ship('foe').hp;
sim.castSkill('bulwark', 'quake-round');
check('quake-round damages and slows', ship('foe').hp < hpQuake && has('foe', 'quake-round'));
place('bulwark', 30);
const hpRing = ship('foe').hp;
sim.castSkill('bulwark', 'shrapnel-ring');
step(30);
check('shrapnel-ring grinds nearby foe', ship('foe').hp < hpRing);
sim.castSkill('bulwark', 'bastion-field');
check('bastion-field reaches allies', has('halo', 'bastion-field'));

console.log(failed ? `${failed} check(s) failed` : 'all Skill checks passed');
process.exit(failed ? 1 : 0);
