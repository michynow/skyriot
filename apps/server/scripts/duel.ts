// Combat balance harness: headless 1v1 duels for every Frame matchup, Siege scenarios and 5v5 Bot matches on the
// authoritative sim, flown by botBrain with a sharp "ace" profile (5v5 also with stock Bots). Prints tables.
// Run: pnpm --filter @skyriot/server exec tsx scripts/duel.ts [duelsPerMatchup=20]
import * as RAPIER from '@dimforge/rapier3d-compat';
import {
  FRAMES,
  RUSTWATER_CANYONS,
  TICK_HZ,
  createSim,
  generateHeightfield,
  sampleHeight,
  type FrameId,
  type MapDef,
  type PilotInput,
  type Sim,
  type ShipId,
  type SimEvent,
} from '@skyriot/shared';
import {
  BOT_SKILL,
  botBrain,
  createBotMemory,
  type BotMemory,
  type BotSkill,
} from '../src/bots/botBrain';

const N = Number(process.argv[2] ?? 20);
const DUEL_SEC = 150;
const SIEGE_SEC = 120;
const MATCH_SEC = 300;
const TRACE = process.env.TRACE;

/** A focused, competent Pilot: quick eyes, full turn, bursts under the heat cap, times rolls, fires on lock. */
const ACE: BotSkill = {
  ...BOT_SKILL,
  reactionTicks: 3,
  aimErrStartRad: 0.08,
  aimErrMinRad: 0.01,
  aimErrDecay: 0.97,
  fireConeRad: 0.25,
  burstOnTicks: 1,
  burstPeriodTicks: 1,
  heatCap: 0.85,
  turnMul: 1,
  combatThrottle: 0.5,
  rollDodgeChance: 0.5,
  panicRollChance: 0,
  rollWindowMinM: 40,
  rollWindowMaxM: 330,
  skillUseChance: 0.02,
  missileFireChance: 0.3,
  disengageChance: 0,
  turnBrake: true,
  pivotFlip: true,
  strafeGround: true,
  standoffMinM: 150,
  standoffMaxM: 480,
};
const HOLD: BotSkill = { ...ACE, heatCap: 1.01 };
const NO_KITS: BotSkill = { ...ACE, kits: false };
/** A human leaning on Kits: whichever is ready, whenever below 75% HP (both have 4 s cooldowns). */
const KIT_SPAM: BotSkill = { ...ACE, kitHpFraction: 0.75, kitGapSec: 0 };

await RAPIER.init();
const FRAME_IDS = Object.keys(FRAMES) as FrameId[];
const ARENA: MapDef = { ...RUSTWATER_CANYONS, bases: undefined };
const arenaHf = generateHeightfield(ARENA);
/** Open ground for Siege runs: Siege at its best (no terrain cover for either side). */
const FLAT: MapDef = { ...ARENA, maxHeight: 25 };
const flatHf = generateHeightfield(FLAT);
const fullHf = generateHeightfield(RUSTWATER_CANYONS);
const slot = (f: FrameId, weapon: string) => (FRAMES[f].primary === weapon ? 'P' : 'S');

interface Guided {
  n: number;
  roll: number;
  lost: number;
  hit: number;
}

/** Per-weapon and per-pilot counters fed from sim events. */
class Tally {
  shots = new Map<string, number>(); // weapon -> rounds/projectiles
  hits = new Map<string, number>(); // weapon -> projectiles that dealt damage
  dmg = new Map<string, number>();
  overheats = 0;
  triggerTicks = 0;
  /** Per weapon: announced (missileIncoming) rounds, broken by a Barrel Roll, out-flown/terrain, ended on a hull. */
  guided = new Map<string, Guided>();
  rollsSpent = 0; // Barrel Rolls by this Pilot
  kits = 0;
  skills = new Map<string, number>();
  /** HP + shield regained (regen, Kits, heals) and seconds alive. */
  restored = 0;
  aliveTicks = 0;
  lastHealth = -1;
  private weaponOf = new Map<number, string>();
  private scored = new Set<number>();
  private g(id: number): Guided {
    const k = this.weaponOf.get(id) ?? '?';
    let v = this.guided.get(k);
    if (!v) this.guided.set(k, (v = { n: 0, roll: 0, lost: 0, hit: 0 }));
    return v;
  }
  add(m: Map<string, number>, k: string, v = 1) {
    m.set(k, (m.get(k) ?? 0) + v);
  }
  feed(sim: Sim, ev: SimEvent[], who: Set<ShipId>) {
    for (const e of ev) {
      if (e.type === 'projectileSpawned' && who.has(e.owner)) {
        const ship = sim.getShip(e.owner)!;
        const key = `${ship.frame}:${slot(ship.frame, e.weapon)}`;
        this.weaponOf.set(e.id, key);
        this.add(this.shots, key);
      } else if (e.type === 'hit' && who.has(e.attacker)) {
        const key = this.weaponOf.get(e.projectile);
        if (!key) continue;
        this.add(this.dmg, key, e.damage);
        if (!this.scored.has(e.projectile) && (e.damage > 0 || e.deflected)) {
          this.scored.add(e.projectile);
          this.add(this.hits, key);
        }
      } else if (e.type === 'missileIncoming' && who.has(e.attacker)) {
        for (const id of e.missiles) this.g(id).n++;
      } else if (e.type === 'missileEvaded' && this.weaponOf.has(e.id)) {
        if (e.reason === 'roll') this.g(e.id).roll++;
        else this.g(e.id).lost++;
      } else if (e.type === 'barrelRoll' && who.has(e.id)) {
        this.rollsSpent++;
      } else if (e.type === 'missileEnded' && e.reason === 'hit' && this.weaponOf.has(e.id)) {
        this.g(e.id).hit++;
      } else if (e.type === 'skillUsed' && who.has(e.id)) {
        this.add(this.skills, e.skill);
        if (e.skill === 'repair-kit' || e.skill === 'shield-kit') this.kits++;
      }
    }
  }
}

interface Pilot {
  id: ShipId;
  mem: BotMemory;
  wasHot: boolean;
  last?: PilotInput;
}

function spawn(
  sim: Sim,
  hf: typeof arenaHf,
  map: MapDef,
  id: string,
  nation: 'concord' | 'vex',
  frame: FrameId,
  at: [number, number, number] | undefined,
  skill: BotSkill,
  seed: number,
): Pilot {
  sim.addShip(id, { nation, frame, name: id, isBot: true, tier: 1, upgrade: 0 }, at);
  const mem = createBotMemory(hf, seed, map.launchDecks[nation], skill);
  mem.siegeBot = false;
  mem.raider = false;
  return { id, mem, wasHot: false };
}

/** One tick for every Pilot: brains, step, tally. */
function tick(sim: Sim, pilots: Pilot[], tally: Map<ShipId, Tally>): SimEvent[] {
  const inputs = new Map<ShipId, PilotInput>();
  for (const p of pilots) {
    const inp = botBrain(sim, p.id, p.mem);
    inputs.set(p.id, inp);
    p.last = inp;
    const s = sim.getShip(p.id);
    if (s?.alive && inp.fire1) tally.get(p.id)!.triggerTicks++;
  }
  const ev = sim.step(inputs);
  for (const p of pilots) {
    const t = tally.get(p.id)!;
    t.feed(sim, ev, new Set([p.id]));
    const s = sim.getShip(p.id);
    if (s?.alive) {
      const h = s.hp + s.shield;
      if (t.lastHealth >= 0 && h > t.lastHealth) t.restored += h - t.lastHealth;
      t.lastHealth = h;
      t.aliveTicks++;
    }
    if (s && s.overheated && !p.wasHot) t.overheats++;
    p.wasHot = !!s?.overheated;
  }
  return ev;
}

const arenaY = (x: number, z: number) => {
  let top = 0;
  for (let dx = -600; dx <= 600; dx += 100) top = Math.max(top, sampleHeight(arenaHf, x + dx, z));
  return top + 220;
};

interface DuelResult {
  winner: 0 | 1 | -1; // -1 = draw / crash
  engageSec: number; // first damage to kill
  trigger: [number, number]; // seconds of fire1 held
  tallies: [Tally, Tally];
}

function duel(fa: FrameId, fb: FrameId, seed: number, sa: BotSkill, sb: BotSkill): DuelResult {
  const sim = createSim(ARENA, { rapier: RAPIER, authoritative: true });
  // Vary the meeting point and angle with the seed; both start facing the centre ~900 m apart.
  const ang = seed * 2.399;
  const cx = Math.cos(seed * 1.7) * 625,
    cz = Math.sin(seed * 1.3) * 625;
  const ox = Math.cos(ang) * 560,
    oz = Math.sin(ang) * 560;
  const y = arenaY(cx, cz);
  const a = spawn(sim, arenaHf, ARENA, 'a', 'concord', fa, [cx - ox, y, cz - oz], sa, seed * 2 + 1);
  const b = spawn(sim, arenaHf, ARENA, 'b', 'vex', fb, [cx + ox, y, cz + oz], sb, seed * 2 + 2);
  const tally = new Map([
    ['a', new Tally()],
    ['b', new Tally()],
  ]);
  let first = -1;
  let winner: 0 | 1 | -1 = -1;
  let end = DUEL_SEC * TICK_HZ;
  for (let t = 0; t < DUEL_SEC * TICK_HZ; t++) {
    const ev = tick(sim, [a, b], tally);
    if (TRACE && t % 30 === 0) {
      const A = sim.getShip('a')!,
        B = sim.getShip('b')!;
      const d = Math.hypot(A.pos[0] - B.pos[0], A.pos[1] - B.pos[1], A.pos[2] - B.pos[2]);
      console.log(
        `t=${f1(t / TICK_HZ)} d=${d.toFixed(0)} A ${A.hp.toFixed(0)}/${A.shield.toFixed(0)} y${A.pos[1].toFixed(0)} v${A.speed.toFixed(0)} lock${A.lockTarget ? 1 : 0}  B ${B.hp.toFixed(0)}/${B.shield.toFixed(0)} y${B.pos[1].toFixed(0)} v${B.speed.toFixed(0)} lock${B.lockTarget ? 1 : 0}`,
      );
    }
    if (first < 0 && ev.some((e) => e.type === 'hit' && e.damage > 0)) first = t;
    // The survivor wins (a crash or a Core Breach that only takes its caster counts too); both down = draw.
    if (ev.some((e) => e.type === 'shipDestroyed')) {
      end = t;
      const aUp = sim.getShip('a')!.alive,
        bUp = sim.getShip('b')!.alive;
      winner = aUp && !bUp ? 0 : bUp && !aUp ? 1 : -1;
      break;
    }
  }
  sim.dispose();
  return {
    winner,
    engageSec: (end - Math.max(first, 0)) / TICK_HZ,
    trigger: [tally.get('a')!.triggerTicks / TICK_HZ, tally.get('b')!.triggerTicks / TICK_HZ],
    tallies: [tally.get('a')!, tally.get('b')!],
  };
}

const pct = (a: number, b: number) => (b ? `${Math.round((100 * a) / b)}%` : '-');
const f1 = (x: number) => x.toFixed(1);
const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : NaN);
const median = (xs: number[]) => {
  const s = [...xs].sort((p, q) => p - q);
  return s.length ? s[Math.floor(s.length / 2)]! : NaN;
};

if (TRACE) {
  const [fa, fb, seed] = TRACE.split(',');
  if (fa === 'siege') {
    console.log(siege([fb as FrameId], Number(seed)));
    process.exit(0);
  }
  const r = duel(fa as FrameId, fb as FrameId, Number(seed), ACE, ACE);
  console.log(
    r.winner,
    r.engageSec,
    r.trigger,
    r.tallies.map(
      (t) =>
        [...t.dmg].map(([k, v]) => `${k}=${v.toFixed(0)}`).join(' ') +
        ` skills ${[...t.skills].map(([k, v]) => `${k}=${v}`).join(' ')} restored ${t.restored.toFixed(0)} shots ${[...t.shots].map(([k, v]) => `${k}=${v}`).join(' ')} kits ${t.kits}`,
    ),
  );
  process.exit(0);
}
// Per-weapon accumulators across all duels.
const W = new Map<string, { shots: number; hits: number; dmg: number }>();
let overheatsAll = 0,
  pilotsAll = 0,
  rollsAll = 0;
const G = new Map<string, Guided>();
const frameWins = new Map<FrameId, { w: number; l: number }>();
const frameIO = new Map<FrameId, { dmg: number; restored: number; sec: number; trig: number }>();
function absorb(t: Tally) {
  for (const [k, v] of t.shots) {
    const e = W.get(k) ?? { shots: 0, hits: 0, dmg: 0 };
    e.shots += v;
    e.hits += t.hits.get(k) ?? 0;
    e.dmg += t.dmg.get(k) ?? 0;
    W.set(k, e);
  }
  overheatsAll += t.overheats;
  pilotsAll++;
  rollsAll += t.rollsSpent;
  for (const [k, v] of t.guided) {
    const e = G.get(k) ?? { n: 0, roll: 0, lost: 0, hit: 0 };
    e.n += v.n;
    e.roll += v.roll;
    e.lost += v.lost;
    e.hit += v.hit;
    G.set(k, e);
  }
}

if (process.env.ONLY !== 'series') {
  console.log(`\n== 1v1 duels (ace vs ace, ${N} per matchup, ${DUEL_SEC} s cap) ==`);
  console.log(
    'matchup            A win  B win  draw  engage med/mean s  trigger(winner) s  overheats/pilot  kits/duel',
  );
  for (let i = 0; i < FRAME_IDS.length; i++)
    for (let j = i; j < FRAME_IDS.length; j++) {
      const fa = FRAME_IDS[i]!,
        fb = FRAME_IDS[j]!;
      let wa = 0,
        wb = 0,
        draw = 0,
        oh = 0,
        kits = 0;
      const eng: number[] = [];
      const trig: number[] = [];
      for (let k = 0; k < N; k++) {
        // Swap sides every other duel so spawn geometry doesn't favour a Frame.
        const swap = k % 2 === 1;
        const r = swap ? duel(fb, fa, 100 + k, ACE, ACE) : duel(fa, fb, 100 + k, ACE, ACE);
        const wA = swap ? r.winner === 1 : r.winner === 0;
        const wB = swap ? r.winner === 0 : r.winner === 1;
        if (wA) wa++;
        else if (wB) wb++;
        else draw++;
        if (r.winner >= 0) {
          eng.push(r.engageSec);
          trig.push(r.trigger[r.winner as 0 | 1]);
        }
        r.tallies.forEach((t, side) => {
          const f = (side === 0) !== swap ? fa : fb;
          const io = frameIO.get(f) ?? { dmg: 0, restored: 0, sec: 0, trig: 0 };
          io.dmg += [...t.dmg.values()].reduce((x, y) => x + y, 0);
          io.restored += t.restored;
          io.sec += t.aliveTicks / TICK_HZ;
          io.trig += t.triggerTicks / TICK_HZ;
          frameIO.set(f, io);
        });
        for (const t of r.tallies) {
          absorb(t);
          oh += t.overheats;
          kits += t.kits;
        }
        if (fa !== fb && r.winner >= 0) {
          const winF = wA ? fa : fb,
            loseF = wA ? fb : fa;
          const w = frameWins.get(winF) ?? { w: 0, l: 0 };
          w.w++;
          frameWins.set(winF, w);
          const l = frameWins.get(loseF) ?? { w: 0, l: 0 };
          l.l++;
          frameWins.set(loseF, l);
        }
      }
      console.log(
        `${(fa + ' v ' + fb).padEnd(18)} ${pct(wa, N).padStart(5)}  ${pct(wb, N).padStart(5)}  ${String(draw).padStart(4)}  ${(f1(median(eng)) + ' / ' + f1(mean(eng))).padStart(17)}  ${f1(mean(trig)).padStart(17)}  ${(oh / (2 * N)).toFixed(2).padStart(15)}  ${(kits / N).toFixed(1).padStart(9)}`,
      );
    }
  console.log(
    '\nFrame vs other Frames (decisive duels): win%   dealt/s alive  dealt/s trigger  restored/s  trigger share',
  );
  for (const f of FRAME_IDS) {
    const w = frameWins.get(f) ?? { w: 0, l: 0 };
    const io = frameIO.get(f)!;
    console.log(
      `  ${f.padEnd(8)} ${pct(w.w, w.w + w.l).padStart(4)}  (${w.w}-${w.l})`.padEnd(46) +
        `${f1(io.dmg / io.sec).padStart(13)}  ${f1(io.dmg / io.trig).padStart(15)}  ${f1(io.restored / io.sec).padStart(10)}  ${pct(io.trig, io.sec).padStart(13)}`,
    );
  }
  console.log('\nPer weapon (all duels): shots  hit%  damage/shot  share of Frame damage');
  for (const [k, v] of [...W].sort()) {
    const frame = k.split(':')[0]!;
    const tot = [...W].reduce((a, [kk, vv]) => a + (kk.startsWith(frame + ':') ? vv.dmg : 0), 0);
    console.log(
      `  ${k.padEnd(10)} ${String(v.shots).padStart(6)}  ${pct(v.hits, v.shots).padStart(4)}  ${f1(v.dmg / v.shots).padStart(11)}  ${pct(v.dmg, tot).padStart(5)}`,
    );
  }
  console.log(
    `Overheats per pilot per duel: ${(overheatsAll / pilotsAll).toFixed(2)}; Barrel Rolls per pilot ${(rollsAll / pilotsAll).toFixed(1)}.`,
  );
  console.log('Guided Secondary rounds (fired while LOCKED): count  roll-beaten  out-flown  hit');
  for (const [k, v] of [...G].sort())
    console.log(
      `  ${k.padEnd(10)} ${String(v.n).padStart(6)}  ${pct(v.roll, v.n).padStart(11)}  ${pct(v.lost, v.n).padStart(9)}  ${pct(v.hit, v.n).padStart(4)}`,
    );
}
if (process.env.ONLY) {
  if (process.env.ONLY === 'duels') process.exit(0);
}

// ---- Burst vs hold, kits on vs off (mirror duels) ----
function series(label: string, sa: BotSkill, sb: BotSkill) {
  let wa = 0,
    dec = 0,
    all = 0;
  let ohA = 0,
    ohB = 0;
  const eng: number[] = [];
  const draws: string[] = [];
  for (const f of FRAME_IDS) {
    let d = 0;
    for (let k = 0; k < N; k++) {
      const swap = k % 2 === 1;
      const r = swap ? duel(f, f, 300 + k, sb, sa) : duel(f, f, 300 + k, sa, sb);
      all++;
      ohA += r.tallies[swap ? 1 : 0].overheats;
      ohB += r.tallies[swap ? 0 : 1].overheats;
      if (r.winner < 0) {
        d++;
        continue;
      }
      dec++;
      eng.push(r.engageSec);
      if ((r.winner === 0) !== swap) wa++;
    }
    draws.push(`${f} ${d}`);
  }
  console.log(
    `  ${label.padEnd(30)} first side wins ${pct(wa, dec)} of ${dec} decisive, ${pct(all - dec, all)} draws (${draws.join(', ')}); engage mean ${f1(mean(eng))} s; overheats/duel ${(ohA / all).toFixed(2)} vs ${(ohB / all).toFixed(2)}`,
  );
}
console.log('\n== Mirror series (all Frames) ==');
series('burst (heat<0.85) vs hold', ACE, HOLD);
series('kits vs kits', ACE, ACE);
series('no kits vs no kits', NO_KITS, NO_KITS);
series('kits vs no kits', ACE, NO_KITS);
series('kit spam vs kit spam', KIT_SPAM, KIT_SPAM);
series('kit spam vs no kits', KIT_SPAM, NO_KITS);
if (process.env.ONLY === 'series') process.exit(0);

// ---- Siege: a Ground-Sieged Bulwark vs attackers that keep coming ----
function siege(attackers: FrameId[], seed: number) {
  const sim = createSim(FLAT, { rapier: RAPIER, authoritative: true });
  // Siege where a Pilot would: the highest ground near a random spot (clear sightlines).
  let cx = 0,
    cz = 0,
    g = -Infinity;
  for (let k = 0; k < 40; k++) {
    const x = Math.cos(seed * 3.1 + k * 2.4) * (100 + k * 15) + Math.cos(seed) * 300,
      z = Math.sin(seed * 3.1 + k * 2.4) * (100 + k * 15) + Math.sin(seed) * 300;
    const h = sampleHeight(flatHf, x, z);
    if (h > g) [cx, cz, g] = [x, z, h];
  }
  const bul = spawn(sim, flatHf, FLAT, 'bul', 'concord', 'bulwark', [cx, g + 30, cz], ACE, seed);
  bul.mem.siegeBot = true;
  const tally = new Map<ShipId, Tally>([['bul', new Tally()]]);
  const pilots: Pilot[] = [bul];
  let n = 0;
  const addAttacker = (f: FrameId) => {
    const id = `atk${n++}`;
    const a = (seed + n) * 2.399;
    const at: [number, number, number] = [
      cx + Math.cos(a) * 1060,
      sampleHeight(flatHf, cx + Math.cos(a) * 1060, cz + Math.sin(a) * 1060) + 180,
      cz + Math.sin(a) * 1060,
    ];
    const p = spawn(sim, flatHf, FLAT, id, 'vex', f, at, ACE, seed * 31 + n);
    tally.set(id, new Tally());
    pilots.push(p);
  };
  for (const f of attackers) addAttacker(f);
  let kills = 0,
    sieged = 0,
    t = 0;
  for (; t < SIEGE_SEC * TICK_HZ; t++) {
    const ev = tick(sim, pilots, tally);
    if (sim.getShip('bul')?.sieged) sieged++;
    if (TRACE && t % 15 === 0) {
      const B = sim.getShip('bul')!;
      console.log(
        `t=${f1(t / TICK_HZ)} hdgErr=${(() => {
          const A = sim.getShip(pilots[1]!.id)!;
          const [x, y, z, w] = B.rot;
          const fx = -2 * (x * z + w * y),
            fz = -(1 - 2 * (x * x + y * y));
          const dx = A.pos[0] - B.pos[0],
            dz = A.pos[2] - B.pos[2];
          return (
            (Math.acos((fx * dx + fz * dz) / Math.hypot(fx, fz) / Math.hypot(dx, dz)) * 180) /
            Math.PI
          ).toFixed(0);
        })()} los=${(() => {
          const A = sim.getShip(pilots[1]!.id)!;
          let worst = Infinity;
          for (let k = 1; k < 50; k++) {
            const f = k / 50;
            const x = B.pos[0] + (A.pos[0] - B.pos[0]) * f,
              y = B.pos[1] + (A.pos[1] - B.pos[1]) * f,
              z = B.pos[2] + (A.pos[2] - B.pos[2]) * f;
            worst = Math.min(worst, y - sampleHeight(flatHf, x, z));
          }
          return worst.toFixed(0);
        })()} aim=${bul.last?.aim.map((x) => x.toFixed(2))} hb=${bul.last?.hotbar} thr=${bul.last?.throttle} f1=${bul.last?.fire1} tgt=${bul.mem.target} bul ${B.hp.toFixed(0)}/${B.shield.toFixed(0)} g${B.grounded ? 1 : 0} s${B.sieged ? 1 : 0} lock=${B.siegeLock} | ` +
          pilots
            .slice(1)
            .map((p) => {
              const A = sim.getShip(p.id)!;
              const d = Math.hypot(A.pos[0] - B.pos[0], A.pos[1] - B.pos[1], A.pos[2] - B.pos[2]);
              return `${A.frame} ${A.hp.toFixed(0)}/${A.shield.toFixed(0)} d${d.toFixed(0)} dy${(A.pos[1] - B.pos[1]).toFixed(0)} v${A.speed.toFixed(0)}`;
            })
            .join(' '),
      );
    }
    let bulDead = false;
    for (const e of ev) {
      if (e.type !== 'shipDestroyed') continue;
      if (e.victim === 'bul') bulDead = true;
      else {
        if (e.killer === 'bul') kills++;
        const i = pilots.findIndex((p) => p.id === e.victim);
        const f = sim.getShip(e.victim)!.frame;
        sim.removeShip(e.victim);
        pilots.splice(i, 1);
        addAttacker(f);
      }
    }
    if (bulDead) break;
  }
  sim.dispose();
  const bt = tally.get('bul')!;
  return {
    life: t / TICK_HZ,
    kills,
    siegedFrac: sieged / Math.max(t, 1),
    pHit: [bt.hits.get('bulwark:P') ?? 0, bt.shots.get('bulwark:P') ?? 0],
    bomb: [...tally.values()].reduce(
      (acc, x) => [acc[0]! + (x.hits.get('anvil:S') ?? 0), acc[1]! + (x.shots.get('anvil:S') ?? 0)],
      [0, 0],
    ),
  };
}
console.log(`\n== Ground Siege Bulwark (ace) vs attackers that respawn, ${SIEGE_SEC} s cap ==`);
console.log(
  'attackers          survives  life s  kills/min  sieged  bulwark P hit%  anvil bomb hit%',
);
for (const atk of [
  ['wasp'],
  ['anvil'],
  ['halo'],
  ['bulwark'],
  ['wasp', 'wasp'],
  ['wasp', 'anvil'],
] as FrameId[][]) {
  const rs = Array.from({ length: Math.max(4, N / 2) }, (_, k) => siege(atk, 500 + k));
  const surv = rs.filter((r) => r.life >= SIEGE_SEC - 0.1).length;
  const life = mean(rs.map((r) => r.life));
  const kpm = rs.reduce((s, r) => s + r.kills, 0) / (rs.reduce((s, r) => s + r.life, 0) / 60);
  const ph = rs.reduce((s, r) => [s[0]! + r.pHit[0]!, s[1]! + r.pHit[1]!], [0, 0]);
  const bh = rs.reduce((s, r) => [s[0]! + r.bomb[0]!, s[1]! + r.bomb[1]!], [0, 0]);
  console.log(
    `${atk.join('+').padEnd(18)} ${pct(surv, rs.length).padStart(8)}  ${f1(life).padStart(6)}  ${kpm.toFixed(2).padStart(9)}  ${pct(mean(rs.map((r) => r.siegedFrac)) * 100, 100).padStart(6)}  ${pct(ph[0]!, ph[1]!).padStart(14)}  ${pct(bh[0]!, bh[1]!).padStart(15)}`,
  );
}

// ---- 5v5 Bot matches on the real map (Bases on) ----
function match(skill: BotSkill, seed: number) {
  const sim = createSim(RUSTWATER_CANYONS, { rapier: RAPIER, authoritative: true });
  const pilots: Pilot[] = [];
  const tally = new Map<ShipId, Tally>();
  const lineup: FrameId[] = ['wasp', 'anvil', 'halo', 'bulwark', 'wasp'];
  for (let i = 0; i < 10; i++) {
    const nation = i % 2 ? 'vex' : 'concord';
    const id = `m${i}`;
    sim.addShip(id, {
      nation,
      frame: lineup[i >> 1]!,
      name: id,
      isBot: true,
      tier: 1,
      upgrade: 0,
    });
    pilots.push({
      id,
      mem: createBotMemory(fullHf, seed * 97 + i, RUSTWATER_CANYONS.launchDecks[nation], skill),
      wasHot: false,
    });
    tally.set(id, new Tally());
  }
  const kd = new Map<FrameId, { k: number; d: number }>();
  let kills = 0,
    crashes = 0;
  for (let t = 0; t < MATCH_SEC * TICK_HZ; t++) {
    for (const e of tick(sim, pilots, tally)) {
      if (e.type !== 'shipDestroyed') continue;
      const vf = sim.getShip(e.victim)!.frame;
      const v = kd.get(vf) ?? { k: 0, d: 0 };
      v.d++;
      kd.set(vf, v);
      if (!e.killer || !sim.getShip(e.killer)) {
        crashes++;
        continue;
      }
      kills++;
      const kf = sim.getShip(e.killer)!.frame;
      const k = kd.get(kf) ?? { k: 0, d: 0 };
      k.k++;
      kd.set(kf, k);
    }
  }
  sim.dispose();
  return { kills, crashes, kd, tally };
}
for (const [label, skill] of [
  ['stock Bots', BOT_SKILL],
  ['ace Bots', ACE],
] as const) {
  const kd = new Map<FrameId, { k: number; d: number }>();
  const W5 = new Map<string, { shots: number; hits: number }>();
  let kills = 0,
    crashes = 0,
    oh = 0;
  const runs = 3;
  for (let s = 0; s < runs; s++) {
    const r = match(skill, s + 1);
    kills += r.kills;
    crashes += r.crashes;
    for (const [f, v] of r.kd) {
      const e = kd.get(f) ?? { k: 0, d: 0 };
      e.k += v.k;
      e.d += v.d;
      kd.set(f, e);
    }
    for (const t of r.tally.values()) {
      oh += t.overheats;
      for (const [k, v] of t.shots) {
        const e = W5.get(k) ?? { shots: 0, hits: 0 };
        e.shots += v;
        e.hits += t.hits.get(k) ?? 0;
        W5.set(k, e);
      }
    }
  }
  console.log(
    `\n== 5v5 ${label} (${runs} x ${MATCH_SEC} s, Bases on): ${f1(kills / runs)} kills/match, ${f1(crashes / runs)} other deaths, overheats/pilot ${(oh / (10 * runs)).toFixed(1)} ==`,
  );
  console.log(
    '  K/D per Frame: ' +
      FRAME_IDS.map((f) => {
        const v = kd.get(f) ?? { k: 0, d: 0 };
        return `${f} ${v.k}/${v.d}`;
      }).join('  '),
  );
  console.log(
    '  hit%: ' +
      [...W5]
        .sort()
        .map(([k, v]) => `${k} ${pct(v.hits, v.shots)}`)
        .join('  '),
  );
}
