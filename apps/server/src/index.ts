import { Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { MapRoom } from './rooms/MapRoom';

const port = Number(process.env.PORT ?? 2567);
const server = new Server({ transport: new WebSocketTransport() });
server.define('map', MapRoom).filterBy(['mapId']);
await server.listen(port);
console.log(`[skyriot] game server on ws://localhost:${port}`);
