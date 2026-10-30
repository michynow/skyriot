# Coding Standards

Short on purpose. If a rule isn't here, match the surrounding code.

## Language & tooling
- TypeScript everywhere, `strict: true`, ESM only.
- Formatting: Prettier with `singleQuote: true`, semicolons on, 2 spaces, width 100. Don't hand-format; run `pnpm format`.
- `pnpm typecheck` must pass before any commit. No unit/integration tests in this project; verification is manual play + smoke scripts.

## Naming
- Domain terms come from `CONTEXT.md` exactly. `Frame` not `gear`, `Ship` not `player`, `Map Instance` not `room` (except Colyseus API code).
- Files: `camelCase.ts` for modules, `PascalCase.tsx` for React components.
- Types: `PascalCase`. Constants: `SCREAMING_SNAKE` only for true compile-time constants (`TICK_HZ`).
- No abbreviations except well-known ones (`id`, `hp`, `dt`, `fx`, `ui`). Write `projectile`, not `proj`.

## Module design
- Prefer **deep modules**: small interface, lots hidden. Before adding an exported function, ask whether a caller really needs it.
- No interface/abstract class with one implementation. A seam needs two adapters.
- Accept dependencies (e.g. Rapier instance, clock), don't construct them inside.
- `packages/shared` must never import DOM, React, three, Node built-ins, or Colyseus.

## Simulation rules
- Sim code is pure TS: no `Date.now()`, no `Math.random()` — use the tick and a seeded RNG passed in.
- Fixed timestep only. `dt` is `1 / TICK_HZ`.
- All gameplay numbers live in `packages/shared/src/content/`. No magic numbers in sim logic.
- Allocate in hot loops never: reuse vectors (`_tmpVec`) at module scope.

## React / R3F rules
- Never put per-frame data in React state. Use refs, `useFrame`, or a mutable store.
- zustand for UI-rate state only.
- Instancing for anything with > 10 copies (bricks, tracers, rocks).
- Dispose geometries/materials you create imperatively.
- Dev-only UI goes in `apps/client/src/dev/` behind `import.meta.env.DEV`.

## Server rules
- Server is the only source of truth for HP, damage, inventory, currency, XP, Glory.
- Validate every client message (shape + ranges). Clamp, don't trust.
- Dev commands must check `isDevAllowed(client)`.

## Comments
- Explain *why*, not *what*. No commented-out code.
- Deliberate simplifications with a known ceiling get a `ponytail:` comment naming the ceiling and the upgrade path.

## Dependencies
- Before adding one: is it in the stdlib, the platform, or already installed? Add only when a few lines can't do it.
- Pin exact versions in `package.json`.

## Git
- Conventional commits: `feat(sim): barrel roll invulnerability window`.
- One logical change per commit. Don't commit generated files or `.env`.
