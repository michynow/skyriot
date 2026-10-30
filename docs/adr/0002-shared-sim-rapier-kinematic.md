# One shared simulation on Rapier, Ships kinematic, Projectiles as sweeps

The same `packages/shared/sim` runs on server (truth) and client (prediction), so it uses `@dimforge/rapier3d-compat` (WASM, identical in browser and Node, deterministic). Ships are kinematic bodies driven by our arcade flight integrator plus Rapier's character controller for terrain — dynamic rigid bodies are hostile to prediction/replay. Projectiles are not Rapier bodies: swept ray vs static world plus our own swept test vs lag-compensated Ship capsules, so they can't tunnel and are cheap at hundreds per second.

## Considered Options
- cannon-es: JS, not deterministic across engines, slower; rejected.
- Writing physics from scratch: rejected by product owner.
