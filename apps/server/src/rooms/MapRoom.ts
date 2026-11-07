import { Room, type Client } from '@colyseus/core';
import * as RAPIER from '@dimforge/rapier3d-compat';
import {
  BOTS_PER_NATION,
  CLOAK_REVEAL_M,
  FRAMES,
  MAPS,
  MAX_SHIPS_PER_INSTANCE,
  MSG,
  RUSTWATER_CANYONS,
  SKILLS,
  SNAPSHOT_HZ,
  TICK_HZ,
  chargesOf,
  createSim,
  gearOf,
  generateHeightfield,
  isCloaked,
  mulberry32,
  sanitizeInput,
  type ChatMessage,
  type FrameId,
  type Heightfield,
  type JoinOptions,
  type MapDef,
  type NationId,
  type PilotInput,
  type PilotProfile,
  type Sim,
  type ShipId,
  type Snapshot,
  type TravelOrder,
  type Vec3,
  type Welcome,
} from '@skyriot/shared';
import { botBrain, createBotMemory, type BotMemory } from '../bots/botBrain';
import {
  awardKill,
  buy,
  canTrade,
  chooseMod,
  discard,
  equip,
  giveItem,
  moveItem,
  sell,
  setHotbar,
  spendConsumable,
  upgrade,
} from '../economy';
import { tickCharms } from '../charms';
import { loadProfile, saveProfile } from '../profiles';
import { runDevCommand } from './devCommands';
import { packShared, snapshotFrame } from './snapshotFrame';
import { signTravel, verifyTravel } from '../travel';

const TICK_MS = 1000 / TICK_HZ;
const SNAPSHOT_MS = 1000 / SNAPSHOT_HZ;
const LOOP_INTERVAL_MS = 5;
const MAX_CATCHUP_TICKS = 4;
/** Inputs to accumulate before (re)starting consumption, so one late packet doesn't stall the Ship. */
const JITTER_BUFFER = 2;
/** Above this many queued inputs, one extra input is run per tick to catch up (never dropped). */
const CATCHUP_BUFFER = 4;
const MAX_INPUT_QUEUE = 30;
const SLOW_TICK_MS = 8;
const SLOW_LOG_INTERVAL_MS = 5000;
const MAX_NAME_LENGTH = 16;
const PROFILE_FLUSH_MS = 60_000;
const CHARM_TICK_MS = 60_000;
const NATIONS: NationId[] = ['concord', 'vex'];
const FRAME_IDS = Object.keys(FRAMES) as FrameId[];
/** Arrivals appear this far past the Gate's rim, toward the map centre, so they don't fly straight back. */
const GATE_EXIT_M = 80;

await RAPIER.init();

export function isDevAllowed(client: Client): boolean {
  return (
    process.env.NODE_ENV === 'development' ||
    (client.auth as { role?: string } | undefined)?.role === 'admin'
  );
}

interface HumanSlot {
  queue: PilotInput[];
  last: PilotInput | null;
  ack: number;
  buffering: boolean;
}

// Colyseus API code: this class is a Map Instance.
export class MapRoom extends Room {
  maxClients = MAX_SHIPS_PER_INSTANCE;

  private map: MapDef = RUSTWATER_CANYONS;
  private hf!: Heightfield;
  private sim!: Sim;
  private humans = new Map<ShipId, HumanSlot>();
  private byId = new Map<ShipId, Client>();
  private bots = new Map<ShipId, BotMemory>();
  private botsPerNation = BOTS_PER_NATION;
  private rng = mulberry32(1);
  private botCounter = 0;
  private accTick = 0;
  private accSnapshot = 0;
  private lastSlowLog = 0;
  private frozen = new Set<ShipId>();
  private stepInputs = new Map<ShipId, PilotInput>();
  /** Live Pilot profile per human Ship. Mutate in place, then send MSG.profile; saved on leave + every 60 s. */
  private profiles = new Map<ShipId, PilotProfile>();
  /** Wall time each Pilot's Charms were last ticked (logged-in time only). */
  private charmTick = new Map<ShipId, number>();

  onCreate(options: { mapId?: string }) {
    this.map = MAPS[options.mapId ?? ''] ?? RUSTWATER_CANYONS;
    this.hf = generateHeightfield(this.map);
    this.sim = createSim(this.map, { rapier: RAPIER, authoritative: true });
    this.rng = mulberry32(this.map.seed);
    if (this.map.city) this.botsPerNation = 0;
    this.fillBots();

    this.onMessage(MSG.input, (client, raw: unknown) => {
      const slot = this.humans.get(client.sessionId);
      const input = sanitizeInput(raw);
      if (!slot || !input || input.seq <= slot.ack) return;
      slot.queue.push(input);
      if (slot.queue.length > MAX_INPUT_QUEUE) slot.queue.shift();
    });

    this.onMessage(MSG.chat, (client, msg: ChatMessage) => {
      const text = typeof msg?.text === 'string' ? msg.text.slice(0, 200) : '';
      if (!text.startsWith('/')) return;
      if (!isDevAllowed(client)) return client.send(MSG.console, { text: 'dev commands disabled' });
      const reply = runDevCommand(
        {
          sim: this.sim,
          setBotsPerNation: (n) => {
            this.botsPerNation = Math.min(n, MAX_SHIPS_PER_INSTANCE / 2);
            this.fillBots();
            return this.botsPerNation;
          },
          grant: (credits, scrap) => {
            const p = this.profiles.get(client.sessionId);
            if (!p) return false;
            p.wallet.credits = Math.max(0, p.wallet.credits + credits);
            p.wallet.scrap = Math.max(0, p.wallet.scrap + scrap);
            this.sendProfile(client.sessionId);
            return true;
          },
          give: (def, opts) => {
            const p = this.profiles.get(client.sessionId);
            if (!p || !giveItem(p, def, opts)) return false;
            this.sendProfile(client.sessionId);
            return true;
          },
          equipCharm: (def) => {
            const p = this.profiles.get(client.sessionId);
            if (!p || !giveItem(p, def)) return 'bag full or unknown Charm';
            const item = p.items.filter((i) => i.def === def).pop()!;
            const slot = p.charms.findIndex((c) => c === null);
            const err = equip(
              p,
              { frame: 'wasp', slot: `charm${slot < 0 ? 0 : slot}`, item: item.id },
              { city: true, docked: true },
            );
            this.sendProfile(client.sessionId);
            return err;
          },
          charmTime: (ms) => {
            const p = this.profiles.get(client.sessionId);
            if (!p) return 0;
            let n = 0;
            for (const i of p.items)
              if (i.kind === 'charm' && i.msLeft !== undefined) {
                i.msLeft = ms;
                n++;
              }
            this.tickCharmsOf(client.sessionId, 0);
            this.sendProfile(client.sessionId);
            return n;
          },
        },
        client.sessionId,
        text,
      );
      client.send(MSG.console, { text: reply });
    });

    type Handler = (p: PilotProfile, raw: unknown, id: ShipId) => string | null;
    const vendor =
      (fn: (p: PilotProfile, raw: unknown) => string | null): Handler =>
      (p, raw) =>
        canTrade(this.map) ? fn(p, raw) : 'Vendor only in a City';
    const handlers: [string, Handler][] = [
      [MSG.buy, vendor(buy)],
      [MSG.upgrade, vendor(upgrade)],
      [MSG.sell, vendor(sell)],
      [MSG.discard, discard],
      [MSG.moveItem, moveItem],
      [MSG.hotbar, setHotbar],
      [MSG.chooseMod, chooseMod],
      [
        MSG.equip,
        (p, raw, id) =>
          equip(p, raw, {
            city: this.map.city !== undefined,
            docked: this.sim.getShip(id)?.docked === true,
          }),
      ],
    ];
    for (const [type, handler] of handlers) {
      this.onMessage(type, (client, raw: unknown) => {
        const profile = this.profiles.get(client.sessionId);
        if (!profile) return;
        const error = handler(profile, raw, client.sessionId);
        if (error) return client.send(MSG.console, { text: error });
        this.sendProfile(client.sessionId);
      });
    }

    this.setSimulationInterval((deltaMs) => this.loop(deltaMs), LOOP_INTERVAL_MS);
    this.clock.setInterval(() => this.profiles.forEach(saveProfile), PROFILE_FLUSH_MS);
    this.clock.setInterval(() => {
      for (const id of this.profiles.keys()) if (this.tickCharmsOf(id)) this.sendProfile(id);
    }, CHARM_TICK_MS);
    console.log(`[MapRoom] created map=${this.map.id}`);
  }

  async onJoin(client: Client, options: Partial<JoinOptions>) {
    // A valid travel token carries the Pilot over unchanged and lands them at the Gate they came through.
    const claim = verifyTravel(options.travel, this.map.id);
    const opts = claim ?? options;
    const nation: NationId = opts.nation === 'vex' ? 'vex' : 'concord';
    const frame: FrameId = FRAME_IDS.includes(opts.frame as FrameId)
      ? (opts.frame as FrameId)
      : 'wasp';
    const name =
      (typeof opts.name === 'string' ? opts.name : 'Pilot').slice(0, MAX_NAME_LENGTH) || 'Pilot';
    const profile = await loadProfile(options.token, name, nation).catch((err: Error) => {
      console.warn(`[MapRoom] profile load failed, joining as guest: ${err.message}`);
      return loadProfile(undefined, name, nation);
    });
    this.makeSlot(profile.nation);
    const id = client.sessionId;
    this.profiles.set(id, profile);
    this.charmTick.set(id, Date.now());
    const gate = claim && this.map.gates?.find((g) => g.to === claim.from);
    this.sim.addShip(
      id,
      { nation: profile.nation, frame, name: profile.name, isBot: false, tier: 1, upgrade: 0 },
      gate ? gateExit(gate.pos, gate.radius) : undefined,
    );
    this.humans.set(id, { queue: [], last: null, ack: 0, buffering: true });
    this.byId.set(id, client);
    this.sendProfile(id);
    const welcome: Welcome = {
      shipId: id,
      mapId: this.map.id,
      tick: this.sim.tick,
      serverTimeMs: Date.now(),
      dev: isDevAllowed(client),
    };
    client.send(MSG.welcome, welcome);
    console.log(
      `[MapRoom] join ${id} ${profile.nation}/${frame}${profile.guest ? ' guest' : ''}${claim ? ` via gate from ${claim.from}` : ''} ships=${[...this.sim.ships()].length}`,
    );
  }

  onLeave(client: Client, code?: number) {
    const id = client.sessionId;
    console.log(`[MapRoom] leave ${id} code=${code ?? '-'}`);
    this.sim.removeShip(id);
    this.humans.delete(id);
    this.byId.delete(id);
    const profile = this.profiles.get(id);
    this.tickCharmsOf(id);
    this.profiles.delete(id);
    this.charmTick.delete(id);
    if (profile) void saveProfile(profile);
    this.fillBots();
  }

  /** Re-equip the Ship from the profile (gear applies at once, vitals on the next spawn) and send it. */
  private sendProfile(id: ShipId): void {
    const profile = this.profiles.get(id);
    const ship = this.sim.getShip(id);
    if (!profile || !ship) return;
    this.sim.setGear(id, gearOf(profile, ship.frame));
    this.sim.setCharges(id, chargesOf(profile));
    this.byId.get(id)?.send(MSG.profile, profile);
  }

  /**
   * Charm time since the last tick (or `elapsedMs`); spent Charms go with a chat line. True if any went.
   * ponytail: a Charm counts the time since the last minute tick, so it can run up to a minute over.
   */
  private tickCharmsOf(id: ShipId, elapsedMs?: number): boolean {
    const profile = this.profiles.get(id);
    if (!profile) return false;
    const now = Date.now();
    const gone = tickCharms(profile, elapsedMs ?? now - (this.charmTick.get(id) ?? now));
    if (elapsedMs === undefined) this.charmTick.set(id, now);
    for (const name of gone) this.byId.get(id)?.send(MSG.console, { text: `${name} has run out.` });
    if (gone.length) void saveProfile(profile);
    return gone.length > 0;
  }

  onDispose() {
    this.sim.dispose();
  }

  // ---- bots ----

  private count(nation: NationId): number {
    let n = 0;
    for (const s of this.sim.ships()) if (s.nation === nation) n++;
    return n;
  }

  /** Free one Ship slot for a joining human: drop a bot of their nation, or any bot if full. */
  private makeSlot(nation: NationId): void {
    let total = 0;
    for (const _ of this.sim.ships()) total++;
    if (total < MAX_SHIPS_PER_INSTANCE && this.count(nation) >= this.botsPerNation) {
      this.removeBot(nation);
    } else if (total >= MAX_SHIPS_PER_INSTANCE) {
      this.removeBot(nation) || this.removeBot(null);
    }
  }

  private removeBot(nation: NationId | null): boolean {
    for (const s of this.sim.ships()) {
      if (s.isBot && (nation === null || s.nation === nation)) {
        this.sim.removeShip(s.id);
        this.bots.delete(s.id);
        return true;
      }
    }
    return false;
  }

  private fillBots(): void {
    let total = 0;
    for (const _ of this.sim.ships()) total++;
    for (const nation of NATIONS) {
      while (this.count(nation) < this.botsPerNation && total < MAX_SHIPS_PER_INSTANCE) {
        const id = `bot-${++this.botCounter}`;
        const frame = FRAME_IDS[Math.floor(this.rng() * FRAME_IDS.length)]!;
        this.sim.addShip(id, {
          nation,
          frame,
          name: `Bot ${this.botCounter}`,
          isBot: true,
          tier: 1,
          upgrade: 0,
        });
        this.bots.set(
          id,
          createBotMemory(this.hf, this.botCounter * 7919, this.map.launchDecks[nation]),
        );
        total++;
      }
      while (this.count(nation) > this.botsPerNation && this.removeBot(nation));
    }
  }

  // ---- loop ----

  private loop(deltaMs: number): void {
    this.accTick += deltaMs;
    this.accSnapshot += deltaMs;
    let steps = 0;
    while (this.accTick >= TICK_MS && steps < MAX_CATCHUP_TICKS) {
      this.accTick -= TICK_MS;
      steps++;
      this.tickOnce();
    }
    if (this.accTick > TICK_MS) this.accTick = 0; // drop backlog rather than spiral
    if (this.accSnapshot >= SNAPSHOT_MS) {
      this.accSnapshot %= SNAPSHOT_MS;
      this.sendSnapshots();
    }
  }

  private tickOnce(): void {
    const t0 = performance.now();
    const cpu0 = process.cpuUsage();
    const inputs = this.stepInputs;
    inputs.clear();
    const frozen = this.frozen;
    frozen.clear();
    for (const [id, slot] of this.humans) {
      if (slot.buffering && slot.queue.length >= JITTER_BUFFER) slot.buffering = false;
      const next = slot.buffering ? undefined : slot.queue.shift();
      if (next) {
        slot.last = next;
        slot.ack = next.seq;
        inputs.set(id, next);
      } else {
        // Late input: freeze this Ship for the tick so server and prediction stay seq-for-seq in step.
        frozen.add(id);
        slot.buffering = true;
      }
    }
    for (const [id, mem] of this.bots) inputs.set(id, botBrain(this.sim, id, mem));
    const events = this.sim.step(inputs, frozen);
    this.checkGates();
    for (const [id, slot] of this.humans) {
      if (slot.queue.length > CATCHUP_BUFFER) {
        const extra = slot.queue.shift()!;
        this.sim.stepLocal(id, extra);
        slot.ack = extra.seq;
      }
    }
    if (events.length > 0) {
      this.broadcast(MSG.events, events);
      // Humans' deaths/respawns are logged so a "mystery" return to deck can be traced.
      for (const e of events) {
        if (e.type === 'shipDestroyed' && e.killer && this.profiles.has(e.killer)) {
          const victim = this.sim.getShip(e.victim);
          if (victim && victim.nation !== this.sim.getShip(e.killer)?.nation) {
            awardKill(this.profiles.get(e.killer)!);
            this.sendProfile(e.killer);
          }
        }
        if (e.type === 'skillUsed' && SKILLS[e.skill]?.kind === 'consumable') {
          const p = this.profiles.get(e.id);
          if (p && spendConsumable(p, e.skill)) this.sendProfile(e.id);
        }
        if (e.type === 'shipDestroyed' && this.humans.has(e.victim))
          console.log(`[MapRoom] ${e.victim} destroyed by ${e.killer ?? 'terrain'}`);
        else if (e.type === 'shipRespawned' && this.humans.has(e.id))
          console.log(`[MapRoom] ${e.id} respawned`);
        else if (e.type === 'catapult' && this.humans.has(e.id))
          console.log(`[MapRoom] ${e.id} catapulted from tunnel ${e.tunnel}`);
        else if (e.type === 'structureDestroyed')
          console.log(`[MapRoom] ${e.structure} destroyed by ${e.killer ?? 'dev'}`);
        else if (e.type === 'shieldDown') console.log(`[MapRoom] ${e.nation} shield down`);
        else if (e.type === 'matchEnded') console.log(`[MapRoom] battle won by ${e.winner}`);
        else if (e.type === 'matchStarted') console.log('[MapRoom] battle started');
      }
    }
    const ms = performance.now() - t0;
    const cpu = process.cpuUsage(cpu0);
    if (ms > SLOW_TICK_MS && t0 - this.lastSlowLog > SLOW_LOG_INTERVAL_MS) {
      this.lastSlowLog = t0;
      console.warn(
        // cpu << wall means the process was descheduled (machine load), not slow code.
        `[MapRoom] slow tick ${ms.toFixed(1)} ms, cpu ${((cpu.user + cpu.system) / 1000).toFixed(1)} ms (ships=${[...this.sim.ships()].length})`,
      );
    }
  }

  /** A human flying into a Gate gets a TravelOrder and leaves this Map Instance. */
  private checkGates(): void {
    const gates = this.map.gates;
    if (!gates) return;
    for (const id of this.humans.keys()) {
      const s = this.sim.getShip(id);
      if (!s || !s.alive || s.launchPhase !== 'none') continue;
      const gate = gates.find(
        (g) =>
          (s.pos[0] - g.pos[0]) ** 2 + (s.pos[1] - g.pos[1]) ** 2 + (s.pos[2] - g.pos[2]) ** 2 <=
          g.radius ** 2,
      );
      if (!gate || !MAPS[gate.to]) continue;
      const order: TravelOrder = {
        mapId: gate.to,
        travel: signTravel({
          shipId: id,
          name: s.name,
          nation: s.nation,
          frame: s.frame,
          from: this.map.id,
          to: gate.to,
        }),
      };
      this.byId.get(id)?.send(MSG.travel, order);
      console.log(`[MapRoom] ${id} through gate to ${gate.to}`);
      this.sim.removeShip(id);
      this.humans.delete(id);
      this.byId.delete(id);
    }
  }

  /** Squared radar range of a Ship: its radar gear, else the Frame's. */
  private radarRange2(id: ShipId, frame: FrameId): number {
    return (this.sim.frameDef(id)?.radarRangeM ?? FRAMES[frame].radarRangeM) ** 2;
  }

  private sendSnapshots(): void {
    const all = [...this.sim.ships()];
    const shared = packShared(all, this.sim.structures(), this.sim.match());
    const packed = shared.ships;
    const missiles = this.sim.missiles();
    const base = { tick: this.sim.tick, serverTimeMs: Date.now() };
    for (const [id, client] of this.byId) {
      const me = this.sim.getShip(id);
      let ships = packed;
      if (me) {
        // Radar: allies always, enemies only within this Frame's radar range (a veiled one: reveal range).
        const range2 = this.radarRange2(id, me.frame);
        const reveal2 = CLOAK_REVEAL_M ** 2;
        // Ships in the enemy hangar are hidden.
        ships = packed.filter((_, i) => {
          const o = all[i]!;
          return (
            o.id === id ||
            o.nation === me.nation ||
            (o.launchPhase !== 'hangar' &&
              (o.pos[0] - me.pos[0]) ** 2 +
                (o.pos[1] - me.pos[1]) ** 2 +
                (o.pos[2] - me.pos[2]) ** 2 <=
                (isCloaked(o) ? reveal2 : range2))
          );
        });
      }
      const range2 = me ? this.radarRange2(id, me.frame) : Infinity;
      const visible = missiles
        .filter(
          (k) =>
            k.target === id ||
            !me ||
            (k.pos[0] - me.pos[0]) ** 2 +
              (k.pos[1] - me.pos[1]) ** 2 +
              (k.pos[2] - me.pos[2]) ** 2 <=
              range2,
        )
        .map((k) => ({ id: k.id, pos: k.pos, vel: k.vel, guided: k.guided }));
      const per = { ...base, ack: this.humans.get(id)?.ack ?? 0, missiles: visible };
      client.raw(snapshotFrame(MSG.snapshot, per, shared, ships));
    }
  }
}

/** Point just outside a Gate, toward the map centre (the Ship spawns facing the centre). */
function gateExit(pos: Vec3, radius: number): Vec3 {
  const d = Math.hypot(pos[0], pos[2]) || 1;
  const k = (radius + GATE_EXIT_M) / d;
  return [pos[0] - pos[0] * k, pos[1], pos[2] - pos[2] * k];
}
