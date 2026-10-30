import { Room, type Client } from '@colyseus/core';
import { MAX_SHIPS_PER_INSTANCE } from '@skyriot/shared';

// M0 stub — one Map Instance. Sim ownership, input handling, snapshots, Bots: see docs/ARCHITECTURE.md §2.2.
export class MapRoom extends Room {
  maxClients = MAX_SHIPS_PER_INSTANCE;

  onCreate(options: { mapId?: string }) {
    console.log('[MapRoom] created', options.mapId);
  }

  onJoin(client: Client) {
    console.log('[MapRoom] join', client.sessionId);
  }

  onLeave(client: Client) {
    console.log('[MapRoom] leave', client.sessionId);
  }
}
