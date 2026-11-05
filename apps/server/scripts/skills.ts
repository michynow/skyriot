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

// Every kit Skill has a working cast on its Frame (landed-only ones are cast on the ground below).
const GROUND_ONLY = new Set(['ground-shroud', 'track-drive', 'siege-anchor']);
for (const def of Object.values(SKILLS)) {
  if (def.frames === 'all' || GROUND_ONLY.has(def.id) || def.id === 'core-breach') continue;
  for (const f of def.frames) {
    place(f, 100);
    check(`cast ${def.id} on ${f}`, sim.castSkill(f, def.id));
  }
}
const step1 = () => step();

// ---- Wasp ----
place('wasp', 200);
sim.castSkill('wasp', 'blind-tag');
check('blind-tag jams the foe ahead', has('foe', 'blind-tag'));
sim.castSkill('wasp', 'roll-cascade');
step(1, { wasp: { rollLeft: true } });
check('roll-cascade: no roll cooldown', ship('wasp').rollCooldownTicks === 0);

// ---- Anvil ----
place('anvil', 100);
sim.castSkill('anvil', 'shroud-veil');
step();
check('shroud-veil cloaks', isCloaked(ship('anvil')));
step(2, { anvil: { fire1: true } });
check('firing drops shroud-veil', !isCloaked(ship('anvil')));
place('anvil', 100);
sim.castSkill('anvil', 'overcharge-round');
step(10, { anvil: { fire1: true } });
check('overcharge-round is spent by one shot', !has('anvil', 'overcharge-round'));
sim.castSkill('anvil', 'chaff-screen');
check('chaff-screen is up', has('anvil', 'chaff-screen'));
place('anvil', 40);
const foeHpBreach = ship('foe').hp;
sim.castSkill('anvil', 'core-breach');
check(
  'core-breach hurts the foe and destroys the caster',
  ship('foe').hp < foeHpBreach && !ship('anvil').alive,
);
step(200);

// Bombing toggles off on a second press; rockets burst near (not only on) a hull.
place('anvil', 100);
ship('anvil').toggles.bombing = 'air-barrage-mode';
sim.castSkill('anvil', 'air-barrage-mode');
check('bombing mode toggles off', ship('anvil').toggles.bombing === undefined);
sim.castSkill('anvil', 'air-barrage-mode');
step(80);
place('anvil', 120);
{
  const f = ship('foe');
  sim.teleport('foe', [f.pos[0], f.pos[1] + 16, f.pos[2]]);
  step();
  const hpProx = ship('foe').hp;
  step(1, { anvil: { fire2: true } });
  step(90);
  check('rocket proximity burst hits a near-miss', ship('foe').hp < hpProx);
}

// ---- Halo ----
place('halo', 300);
ship('wasp').hp = 300;
ship('anvil').hp = 1000;
sim.castSkill('halo', 'renewal-pulse');
check('renewal-pulse heals allies at once', ship('anvil').hp > 1000);
const hpMend = ship('wasp').hp;
sim.castSkill('halo', 'mend-beam');
check('mend-beam heals the most hurt ally', ship('wasp').hp > hpMend);
ship('wasp').shield = 0;
sim.castSkill('halo', 'recharge-pulse');
check('recharge-pulse refills ally shields', ship('wasp').shield > 0);
ship('wasp').hp = 100;
sim.castSkill('halo', 'lifeline');
check('lifeline fully restores', ship('wasp').hp === ship('wasp').maxHp);
sim.castSkill('halo', 'ward-lattice');
check('ward-lattice reaches allies', has('wasp', 'ward-lattice'));
sim.castSkill('halo', 'sanctum');
const hpSanctum = ship('halo').hp;
check('sanctum is up', has('halo', 'sanctum'));
step(5, { halo: { fire1: true } });
check(
  'sanctum blocks firing',
  ship('halo').ammo1 === FRAMES.halo.ammo1Max && ship('halo').hp === hpSanctum,
);
place('halo', 100);
sim.castSkill('foe', 'blast-ward');
sim.castSkill('halo', 'dispel-lance');
check('dispel-lance strips the foe', ship('foe').buffs.length === 0);
place('halo', 100);
sim.castSkill('wasp', 'shield-damper');
ship('wasp').buffs.push({ skill: 'snare-tag', source: 'foe' as ShipId, ticksLeft: 300 });
sim.castSkill('halo', 'purge');
check(
  'purge cleanses debuffs, keeps buffs',
  !has('wasp', 'snare-tag') && has('wasp', 'shield-damper'),
);

// ---- Bulwark ----
place('bulwark', 180);
const hpQuake = ship('foe').hp;
sim.castSkill('bulwark', 'quake-round');
check('quake-round damages the blast area', ship('foe').hp < hpQuake);
place('bulwark', 200);
sim.castSkill('bulwark', 'shield-breaker');
check('shield-breaker locks the foe shield', has('foe', 'shield-breaker'));
step(60);
check('locked shield does not regenerate', ship('foe').shield === 0);
ship('bulwark').shield = 0;
sim.castSkill('bulwark', 'shield-weave');
step(30);
check('shield-weave rebuilds the shield', ship('bulwark').shield > 0);
check('ground-shroud refused in the air', !sim.castSkill('bulwark', 'ground-shroud'));
step1();

console.log(failed ? `${failed} check(s) failed` : 'all Skill checks passed');
process.exit(failed ? 1 : 0);
