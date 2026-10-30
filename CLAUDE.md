# SKYRIOT — agent guide

Browser nation-vs-nation flight-combat game. Read before coding:

- `CONTEXT.md` — domain glossary. Use its terms exactly (Frame, Ship, Pilot, Map Instance…).
- `docs/PRD.md` — what we're building and milestone scope.
- `docs/ARCHITECTURE.md` — module shapes, netcode, ownership map (§7).
- `docs/CODING_STANDARDS.md` — rules.
- `docs/adr/` — decisions not to relitigate.

Commands: `pnpm dev` (server :2567 + client :5173), `pnpm typecheck`, `pnpm format`, `pnpm db:up`.

Hard rules:
- `packages/shared/src/types.ts` and `content/**` are shared contracts — don't change shape without the orchestrator.
- No unit/integration tests. Verify by running the game.
- Original IP only (ADR 0005). Never copy names/assets/text from existing games.
