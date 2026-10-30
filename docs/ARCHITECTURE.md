# Architecture

Vocabulary: see `CONTEXT.md` (domain) — module / interface / seam / adapter / depth are used in the codebase-design sense.

## 1. Shape

```
skyriot/
├── apps/
│   ├── client/          Vite + React + R3F. Renders, reads input, predicts own Ship.
│   └── server/          Node + Colyseus. Owns truth. One Colyseus room = one Map Instance.
├── packages/
│   └── shared/          Pure TS, no DOM, no Node APIs. Runs in both.
│       ├── content/     Data: Frames, weapons, Skills, Maps, Environment Profiles.
│       ├── sim/         The simulation: flight, collision, Projectiles, damage.
│       ├── net/         Wire message types + encode/decode.
│       └── terrain/     Deterministic heightfield from Map seed.
└── docs/
```

Dependency direction: `client → shared`, `server → shared`. `shared` depends on nothing in the repo. `client` never imports `server` and vice versa.

## 2. The deep modules

Five modules carry almost all complexity. Everything else is thin.

### 2.1 `sim` — the simulation (shared)

The single most important module. Same code runs on the server (authoritative) and on the client (prediction of own Ship). Small interface:

```ts
createSim(map: MapDef, opts?: { rapier: typeof RAPIER }): Sim

interface Sim {
  addShip(id: ShipId, pilot: ShipSpawn): void
  removeShip(id: ShipId): void
  step(inputs: ReadonlyMap<ShipId, PilotInput>): SimEvents   // advances exactly one tick (1/30 s)
  getShip(id: ShipId): ShipState | undefined
  ships(): Iterable<ShipState>
  setShipState(id: ShipId, s: ShipState): void                // reconciliation / snapshot apply
  tick: number
}
```

Hidden inside: Rapier world, static terrain heightfield collider, kinematic character controller per Ship, arcade flight integrator, Environment Profile application, Barrel Roll / boost / Siege state machines, Projectile pool and swept tests, lag-compensation history ring, damage + Deflect + shield, Skill effects, respawn timers.

`SimEvents` is a plain list (`projectileSpawned`, `hit`, `shipDestroyed`, `skillUsed`, …) the caller forwards to the network / FX. Sim never does I/O.

**Rules**
- Fixed tick `TICK_HZ = 30`. Never variable dt inside sim.
- All tuning numbers come from `content/` (overridable at runtime by the dev Leva panel via `sim.tuning`).
- Deterministic given same inputs & same Rapier build. Use `@dimforge/rapier3d-compat` everywhere.
- Ships are **kinematic** bodies moved by our flight integrator + Rapier's `KinematicCharacterController` for terrain collision. No dynamic-body physics for Ships (prediction-hostile).
- Projectiles are **not** Rapier bodies. Each tick: swept segment vs Rapier static world (`castRay`) + swept segment vs Ship capsules (our code, against lag-compensated historical positions).

### 2.2 `MapRoom` — a Map Instance (server)

Colyseus room. Owns one `Sim`. Interface to the outside = Colyseus join/leave + `PilotInput` messages in, snapshots + events out.

- Fixed loop: collect latest input per Ship → `sim.step()` → broadcast events immediately. Snapshots go out at **20 Hz** via a time accumulator (not tied to tick count).
- Input source is a **seam**: humans send `PilotInput` over the wire; **Bots** produce `PilotInput` from `botBrain(view)`. Sim cannot tell them apart. (Two adapters → real seam.)
- Bot fill: keep each Nation at ≥ `BOTS_PER_NATION` (default 20) Ships.
- Cap: 60 Ships (`maxClients = 60`). Bots aren't clients but count toward the 60-Ship cap; a bot is removed whenever a human needs the slot.
- Dev commands (`/god`, `/bots`, `/timescale`, …) handled here only when `isDevAllowed(client)`.

### 2.3 `Predictor` — client-side prediction & reconciliation (client)

```ts
createPredictor(sim: Sim, ownId: ShipId): {
  applyLocal(input: PilotInput): void          // runs sim.step locally, stores input in buffer
  onServerSnapshot(snap: Snapshot): void       // rewinds own Ship to server state, replays unacked inputs
  ownState(): ShipState                        // for rendering
}
```

Hidden: input ring buffer keyed by `seq`, ack handling, replay, small-error visual smoothing (offset decays over ~100 ms instead of snapping).

### 2.4 `Interpolator` — remote Ships (client)

```ts
createInterpolator(delayMs = 100): {
  push(snap: Snapshot): void
  sample(nowMs: number): ReadonlyMap<ShipId, RenderShip>
}
```

Hidden: snapshot buffer, time sync with server clock, slerp/lerp, extrapolation cap (≤ 250 ms), teleport detection.

### 2.5 `FrameBuilder` — brick-kit Ships (client)

```ts
<FrameModel frame="wasp" nation="concord" tier={3} upgrade={7} />
```

Hidden: part catalogue, instanced meshes, nation palette, tier/upgrade → extra parts / emissive / trail. Seam for the future: same props, a GLB adapter when real models arrive.

## 3. Netcode

| Channel | Direction | Rate | Content |
|---|---|---|---|
| `input` | C → S | every client tick (30 Hz) | `PilotInput { seq, aim: dir vec3, throttle, strafe, vertical, boost, brake, fire1, fire2, hotbar, rollL, rollR }` |
| `snapshot` | S → C | 20 Hz | server tick, server time, per-Ship compact state, `lastProcessedSeq` for the receiving client |
| `events` | S → C | on occurrence | `SimEvents` (Projectile spawns, hits, deaths, Skill casts) |

- Messages are compact plain objects encoded with Colyseus' msgpack (`room.send` / `client.send`). We **do not** use Colyseus Schema state sync for Ships — our own snapshot gives control over rate, quantization, and per-client `lastProcessedSeq`. ponytail: full snapshot of all Ships to every client; ~60 Ships × ~40 B × 20 Hz ≈ 48 KB/s. Add interest management (distance-tiered rates) when bandwidth bites.
- Projectiles: server sends spawn (origin, dir, speed, type, tick). Clients simulate their visuals locally; server sends `hit` / `expire` authoritatively.
- **Lag compensation**: server keeps 300 ms history ring of Ship positions. A Projectile fired at client-view time `t` is tested against Ships at `t` for the segment of flight that precedes the current tick. Rewind capped at 200 ms.
- Own Projectiles appear instantly client-side (cosmetic), reconciled with server spawn by `seq`.

## 4. Client composition

```
<App>
  <Lobby/>               nation + Frame pick (hangar stub, M1)
  <Game>                 when joined
    <Canvas>             R3F
      <MapScene/>        terrain, sky, fog, props, lights
      <Ships/>           own (Predictor) + remotes (Interpolator) → <FrameModel/>
      <ProjectilesFx/>   instanced tracers/missiles, trails, explosions
      <ChaseCamera/>
      <PostFx/>          bloom, vignette
      {dev && <PhysicsDebug/>}
    </Canvas>
    <Hud/>               DOM overlay: HP/shield/fuel, crosshair, lead marker, hotbar, minimap, killfeed
    {dev && <DevPanel/>} Leva + lag sim + command console
  </Game>
</App>
```

- Game loop: one `useFrame` in `<Game>` runs fixed-step accumulator: sample input → `predictor.applyLocal` → send. Rendering reads state; no per-component sim logic.
- High-frequency state (Ship transforms) lives in refs / mutable stores, **never React state**. zustand only for UI-rate data (HP numbers at 10 Hz, menus).

## 5. Persistence (M2)

Postgres via Drizzle. Server is the only writer. Tables: `account`, `pilot`, `item`, `loadout`, `progress`, `glory_ledger`. Writes happen at well-defined moments (mission complete, purchase, upgrade, logout, periodic 60 s flush) — never per tick. M0 ships schema stub + `docker compose` only.

## 6. Dev mode

`DEV = import.meta.env.DEV` (client), `isDevAllowed(client) = NODE_ENV==='development' || client.auth.role==='admin'` (server). Client dev code lives under `apps/client/src/dev/` and is imported only behind `import.meta.env.DEV` so Vite tree-shakes it from prod.

## 7. Ownership map (for parallel work)

| Area | Paths |
|---|---|
| Sim + server | `packages/shared/src/{sim,net}`, `apps/server/**` |
| Rendering & art | `apps/client/src/{scene,frames,fx}`, `packages/shared/src/terrain` (read-only consumer) |
| HUD, UI, input, client net, dev tools | `apps/client/src/{hud,ui,input,net,dev}`, `apps/client/src/App.tsx`, `Game.tsx` |
| Shared contracts (orchestrator) | `packages/shared/src/{types.ts,content/**}` — change only by agreement |

## 8. Scaling path (not built now)

- Interest management per client.
- Multiple Map Instances per process → one process per Map → Colyseus presence (Redis) for cross-process matchmaking.
- Gate travel = leave room, join target room with a signed travel token.
- 100-Ship war instances: raise snapshot quantization, lower remote rates beyond 800 m.
