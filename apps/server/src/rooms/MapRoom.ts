import { Room, type Client } from '@colyseus/core';
import * as RAPIER from '@dimforge/rapier3d-compat';
import {
  BOTS_PER_NATION,
  FRAMES,
  MAPS,
  MAX_SHIPS_PER_INSTANCE,
  MSG,
  RUSTWATER_CANYONS,
  SNAPSHOT_HZ,
  TICK_HZ,
  createSim,
  generateHeightfield,
  mulberry32,
  sanitizeInput,
  type ChatMessage,
  type FrameId,
  type Heightfield,
  type JoinOptions,
  type MapDef,
  type NationId,
  type PilotInput,
  type Sim,
  type ShipId,
  type Snapshot,
  type Welcome,
} from '@skyriot/shared';
import { botBrain, createBotMemory, type BotMemory } from '../bots/botBrain';
import { runDevCommand } from './devCommands';

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
const NATIONS: NationId[] = ['concord', 'vex'];
const FRAME_IDS = Object.keys(FRAMES) as FrameId[];

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

  onCreate(options: { mapId?: string }) {
    this.map = MAPS[options.mapId ?? ''] ?? RUSTWATER_CANYONS;
    this.hf = generateHeightfield(this.map);
    this.sim = createSim(this.map, { rapier: RAPIER, authoritative: true });
    this.rng = mulberry32(this.map.seed);
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
        },
        client.sessionId,
        text,
      );
      client.send(MSG.console, { text: reply });
    });

    this.setSimulationInterval((deltaMs) => this.loop(deltaMs), LOOP_INTERVAL_MS);
    console.log(`[MapRoom] created map=${this.map.id}`);
  }

  onJoin(client: Client, options: Partial<JoinOptions>) {
    const nation: NationId = options.nation === 'vex' ? 'vex' : 'concord';
    const frame: FrameId = FRAME_IDS.includes(options.frame as FrameId)
      ? (options.frame as FrameId)
      : 'wasp';
    const name =
      (typeof options.name === 'string' ? options.name : 'Pilot').slice(0, MAX_NAME_LENGTH) ||
      'Pilot';
    this.makeSlot(nation);
    const id = client.sessionId;
    this.sim.addShip(id, { nation, frame, name, isBot: false, tier: 1, upgrade: 0 });
    this.humans.set(id, { queue: [], last: null, ack: 0, buffering: true });
    this.byId.set(id, client);
    const welcome: Welcome = {
      shipId: id,
      mapId: this.map.id,
      tick: this.sim.tick,
      serverTimeMs: Date.now(),
      dev: isDevAllowed(client),
    };
    client.send(MSG.welcome, welcome);
    console.log(`[MapRoom] join ${id} ${nation}/${frame} ships=${[...this.sim.ships()].length}`);
  }

  onLeave(client: Client, code?: number) {
    const id = client.sessionId;
    console.log(`[MapRoom] leave ${id} code=${code ?? '-'}`);
    this.sim.removeShip(id);
    this.humans.delete(id);
    this.byId.delete(id);
    this.fillBots();
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
        if (e.type === 'shipDestroyed' && this.humans.has(e.victim))
          console.log(`[MapRoom] ${e.victim} destroyed by ${e.killer ?? 'terrain'}`);
        else if (e.type === 'shipRespawned' && this.humans.has(e.id))
          console.log(`[MapRoom] ${e.id} respawned`);
      }
    }
    const ms = performance.now() - t0;
    if (ms > SLOW_TICK_MS && t0 - this.lastSlowLog > SLOW_LOG_INTERVAL_MS) {
      this.lastSlowLog = t0;
      console.warn(
        `[MapRoom] slow tick ${ms.toFixed(1)} ms (ships=${[...this.sim.ships()].length})`,
      );
    }
  }

  private sendSnapshots(): void {
    const all = [...this.sim.ships()];
    const missiles = this.sim.missiles();
    const base = { tick: this.sim.tick, serverTimeMs: Date.now() };
    for (const [id, client] of this.byId) {
      const me = this.sim.getShip(id);
      let ships = all;
      if (me) {
        // Radar: allies always, enemies only within this Frame's radar range.
        const range2 = FRAMES[me.frame].radarRangeM ** 2;
        ships = all.filter(
          (o) =>
            o.id === id ||
            o.nation === me.nation ||
            (o.pos[0] - me.pos[0]) ** 2 +
              (o.pos[1] - me.pos[1]) ** 2 +
              (o.pos[2] - me.pos[2]) ** 2 <=
              range2,
        );
      }
      const range2 = me ? FRAMES[me.frame].radarRangeM ** 2 : Infinity;
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
      const snapshot: Snapshot = {
        ...base,
        ack: this.humans.get(id)?.ack ?? 0,
        ships,
        missiles: visible,
      };
      client.send(MSG.snapshot, snapshot);
    }
  }
}
