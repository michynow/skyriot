import { Client, type Room } from '@colyseus/sdk';
import {
  MSG,
  type JoinOptions,
  type PilotInput,
  type ShipState,
  type SimEvent,
  type Snapshot,
  type Vec3,
  type Welcome,
} from '@skyriot/shared';
import { throughLag } from './lagSim';

export interface ConnectionHandlers {
  onWelcome(welcome: Welcome): void;
  onSnapshot(snapshot: Snapshot): void;
  onEvents(events: SimEvent[]): void;
  onConsole(text: string): void;
  onClose(reason: string): void;
}

export interface Connection {
  sendInput(input: PilotInput): void;
  sendChat(text: string): void;
  close(): void;
  /** Smoothed round-trip estimate in ms (input send -> snapshot ack). */
  readonly rtt: number;
}

const SERVER_URL: string = import.meta.env.VITE_SERVER_URL ?? 'ws://localhost:2567';
const WELCOME_TIMEOUT_MS = 8000;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isVec = (v: unknown, n: number): boolean =>
  Array.isArray(v) && v.length === n && v.every(isNum);

function parseWelcome(m: unknown): Welcome | null {
  if (!isObj(m) || typeof m.shipId !== 'string' || typeof m.mapId !== 'string') return null;
  return {
    shipId: m.shipId,
    mapId: m.mapId,
    tick: isNum(m.tick) ? m.tick : 0,
    serverTimeMs: isNum(m.serverTimeMs) ? m.serverTimeMs : Date.now(),
    dev: m.dev === true,
  };
}

function validShip(s: unknown): s is ShipState {
  return (
    isObj(s) &&
    typeof s.id === 'string' &&
    typeof s.frame === 'string' &&
    isVec(s.pos, 3) &&
    isVec(s.rot, 4) &&
    isVec(s.vel, 3) &&
    isNum(s.hp) &&
    isNum(s.shield)
  );
}

function parseSnapshot(m: unknown): Snapshot | null {
  if (!isObj(m) || !isNum(m.tick) || !isNum(m.serverTimeMs) || !Array.isArray(m.ships)) return null;
  const ships = m.ships.filter(validShip).map((s) => ({
    ...s,
    cooldowns: Array.isArray(s.cooldowns) ? s.cooldowns : [],
    lockTarget: typeof s.lockTarget === 'string' ? s.lockTarget : null,
    ammo1: isNum(s.ammo1) ? s.ammo1 : 0,
    ammo2: isNum(s.ammo2) ? s.ammo2 : 0,
    docked: s.docked === true,
    siegePending: s.siegePending === true,
    incomingDist: isNum(s.incomingDist) ? s.incomingDist : -1,
    incomingTti: isNum(s.incomingTti) ? s.incomingTti : -1,
    canLock: s.canLock === true,
    lockProgress: isNum(s.lockProgress) ? s.lockProgress : 0,
    rollPhase: isNum(s.rollPhase) ? s.rollPhase : -1,
    rollDir: isNum(s.rollDir) ? s.rollDir : 0,
    outOfBounds: s.outOfBounds === true,
    buffs: Array.isArray(s.buffs)
      ? s.buffs.filter(
          (b): b is ShipState['buffs'][number] =>
            isObj(b) && typeof b.skill === 'string' && typeof b.source === 'string' && isNum(b.ticksLeft),
        )
      : [],
    toggles: isObj(s.toggles) ? (s.toggles as Record<string, string>) : {},
  }));
  const isVec3 = (v: unknown): v is Vec3 => Array.isArray(v) && v.length === 3 && v.every(isNum);
  const missiles = Array.isArray(m.missiles)
    ? m.missiles.filter(
        (x): x is Snapshot['missiles'][number] => isObj(x) && isNum(x.id) && isVec3(x.pos) && isVec3(x.vel),
      )
    : [];
  const structures = Array.isArray(m.structures)
    ? m.structures.filter(
        (x): x is Snapshot['structures'][number] =>
          isObj(x) && typeof x.id === 'string' && isVec3(x.pos) && isNum(x.hp),
      )
    : [];
  const match = isObj(m.match) ? (m.match as unknown as Snapshot['match']) : NO_MATCH;
  return { tick: m.tick, serverTimeMs: m.serverTimeMs, ack: isNum(m.ack) ? m.ack : -1, ships, missiles, structures, match };
}

const NO_MATCH: Snapshot['match'] = {
  phase: 'battle',
  winner: null,
  restartAtTick: 0,
  shielded: { concord: false, vex: false },
  queues: { concord: [], vex: [] },
};

function parseEvents(m: unknown): SimEvent[] {
  if (!Array.isArray(m)) return [];
  return m.filter((e): e is SimEvent => isObj(e) && typeof e.type === 'string');
}

export async function connect(options: JoinOptions, h: ConnectionHandlers): Promise<Connection> {
  const client = new Client(SERVER_URL);
  const room: Room = await client.joinOrCreate<unknown>('map', options as unknown as never);

  let rtt = 0;
  let closed = false;
  const sentAt = new Map<number, number>();
  let lastMeasuredAck = -1;
  let gotWelcome = false;

  const timeout = setTimeout(() => {
    if (!gotWelcome && !closed) h.onClose('Server did not send a welcome message.');
  }, WELCOME_TIMEOUT_MS);

  room.onMessage(MSG.welcome, (m: unknown) =>
    throughLag(() => {
      const w = parseWelcome(m);
      if (!w) return console.warn('[net] bad welcome', m);
      gotWelcome = true;
      clearTimeout(timeout);
      h.onWelcome(w);
    }),
  );
  room.onMessage(MSG.snapshot, (m: unknown) =>
    throughLag(() => {
      const s = parseSnapshot(m);
      if (!s) return;
      const sent = sentAt.get(s.ack);
      if (sent !== undefined && s.ack > lastMeasuredAck) {
        lastMeasuredAck = s.ack;
        const sample = performance.now() - sent;
        rtt = rtt === 0 ? sample : rtt + (sample - rtt) * 0.1;
      }
      h.onSnapshot(s);
    }),
  );
  room.onMessage(MSG.events, (m: unknown) =>
    throughLag(() => {
      const events = parseEvents(m);
      if (events.length) h.onEvents(events);
    }),
  );
  room.onMessage(MSG.console, (m: unknown) =>
    throughLag(() => {
      if (isObj(m) && typeof m.text === 'string') h.onConsole(m.text);
    }),
  );
  room.onLeave((code: number) => {
    clearTimeout(timeout);
    if (!closed) h.onClose(`Disconnected (code ${code}).`);
  });
  room.onError((code: number, message?: string) => h.onClose(`Connection error ${code}: ${message ?? ''}`));

  return {
    get rtt() {
      return rtt;
    },
    sendInput(input) {
      sentAt.set(input.seq, performance.now());
      sentAt.delete(input.seq - 120);
      throughLag(() => {
        if (!closed) room.send(MSG.input, input);
      });
    },
    sendChat(text) {
      const t = text.trim().slice(0, 200);
      if (t) throughLag(() => !closed && room.send(MSG.chat, { text: t }));
    },
    close() {
      closed = true;
      clearTimeout(timeout);
      void room.leave();
    },
  };
}
