import { Protocol, getMessageBytes } from '@colyseus/core';
import { Packr } from 'msgpackr';
import type { ShipState, Snapshot } from '@skyriot/shared';

// Same settings as Colyseus' own encoder, so the client decodes these frames like any client.send().
const packr = new Packr({ useRecords: false });
const KEYS = ['tick', 'serverTimeMs', 'ack', 'missiles', 'structures', 'match', 'ships'] as const;
const KEY_BYTES = Object.fromEntries(KEYS.map((k) => [k, pack(k)])) as Record<
  (typeof KEYS)[number],
  Buffer
>;
const MAP_HEADER = Buffer.from([0x80 | KEYS.length]);

function pack(value: unknown): Buffer {
  return Buffer.from(packr.pack(value));
}

/** Parts of a snapshot round that are the same for every receiver, packed once. */
export interface SharedSnapshot {
  ships: Buffer[];
  structures: Buffer;
  match: Buffer;
}

export function packShared(
  ships: ShipState[],
  structures: Snapshot['structures'],
  match: Snapshot['match'],
): SharedSnapshot {
  return { ships: ships.map(pack), structures: pack(structures), match: pack(match) };
}

/**
 * A ROOM_DATA frame equal to client.send(type, snapshot), built from pre-packed parts. Ships are
 * ~95% of the bytes; packing them once per round instead of once per receiver keeps the cost
 * flat as humans join.
 */
export function snapshotFrame(
  type: string,
  per: Pick<Snapshot, 'tick' | 'serverTimeMs' | 'ack' | 'missiles'>,
  shared: SharedSnapshot,
  ships: Buffer[],
): Buffer {
  const n = ships.length;
  const shipsHeader =
    n < 16 ? Buffer.from([0x90 | n]) : Buffer.from([0xdc, (n >> 8) & 0xff, n & 0xff]);
  const payload = Buffer.concat([
    MAP_HEADER,
    KEY_BYTES.tick,
    pack(per.tick),
    KEY_BYTES.serverTimeMs,
    pack(per.serverTimeMs),
    KEY_BYTES.ack,
    pack(per.ack),
    KEY_BYTES.missiles,
    pack(per.missiles),
    KEY_BYTES.structures,
    shared.structures,
    KEY_BYTES.match,
    shared.match,
    KEY_BYTES.ships,
    shipsHeader,
    ...ships,
  ]);
  return getMessageBytes.raw(Protocol.ROOM_DATA, type, undefined, payload);
}
