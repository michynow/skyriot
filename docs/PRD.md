# SKYRIOT — Product Requirements Document

Working title. Original browser game in the nation-vs-nation arcade flight-combat MMO genre. Inspired by the *feel* of that genre — not a recreation of any existing title. All names, lore, maps, ships, skills and art are our own.

## 1. Vision

Fast, readable, skill-heavy 3D aerial combat in the browser. Two nations at war, four ship Frames any pilot can fly, short punchy missions with a crude-comedy story, and scheduled nation-wide war events that feed a Glory rank ladder. The full vertical climb (level 1 → 100) takes **8–10 hours**, not months. No pay-to-win. No gambling upgrades.

### Pillars
1. **Flight feel first.** Mouse-aim, momentum, boost, barrel rolls, dodgeable projectiles. If flying an empty map isn't fun, nothing else matters.
2. **PvP is the point.** Server-authoritative from day one. Every system serves the nation war.
3. **Respect the player's time.** Every mission 5–10 min. Every level-up unlocks something.
4. **Fair.** Power comes from play, never from a wallet. Upgrades are deterministic.

### Non-goals (v1)
- Single-player / offline mode.
- Player trading / market (expansion — needs anti-dupe economy backend).
- Gamepad (v1.1), mobile.
- Photoreal graphics.
- Premium currency of any kind.

## 2. World & factions

| Nation | Identity | Colours | City |
|---|---|---|---|
| **Aurelian Concord** | Smug corporate theocracy; shareholders are saints | Gold, white, cyan | **Gildspire** |
| **Vex Freehold** | Scrapper punk republic; votes by bar fight | Red, black, orange | **Rivet Harbor** |

A pilot picks a nation at character creation (switching nation = expansion feature, with cooldown/penalty).

### Story & tone
- Crude adult comedy (Borderlands / Deadpool register): swearing, innuendo, gross-out, morally rotten commanders on both sides, self-mocking propaganda.
- **No** explicit sexual content or nudity. Nothing sexual involving anything that reads as a minor.
- 17+ age gate at signup. "Clean comms" toggle bleeps profanity.
- Delivered as **radio-chatter cutscenes over gameplay** (20–40 s). No text walls.
- 10 chapters per nation (one per 10 levels). Each nation tells its own side; campaigns converge on a shared twist around ch. 7–8.

## 3. Frames (ships)

Every pilot owns all four Frames and swaps in the hangar. Each Frame has its own loadout and skill kit. Frames are brick-built ("lego-like") from modular parts in v1; GLB loading kept as a seam for real models later.

| Frame | Role | Handling | Signature |
|---|---|---|---|
| **Wasp** | Agile fighter | Fastest turn rate & speed, lowest HP | Highest Deflect stacking, burst evasion skills |
| **Anvil** | Heavy bomber | Slow turns, high HP/armor | Siege barrages, carpet bombing, ground strike |
| **Halo** | Support | Medium | Heals, shields, buffs, debuff fields, resurrection beacon |
| **Bulwark** | Armored hover-gunship | Hovers, **lands and drives on terrain** (hull in space), slow | **Siege mode** (grounded only, rooted, first-person gunner view, Target lock for mortar, +damage/+range), artillery, area denial |

Skill kits are our own designs covering these roles (no 1:1 renames of any existing game's skills). Each Frame: ~12 skills unlocked across levels, player slots up to 10 on the hotbar alongside consumables.

## 4. Controls

| Input | Action |
|---|---|
| Mouse | Aim cursor; ship steers toward it at Frame turn rate |
| W / S | Throttle up / down (stall floor on atmospheric maps) |
| A / D | Strafe (visual bank) |
| **Double-tap A / D** | **Barrel roll** — lateral burst, 0.25 s invulnerability, costs fuel, 3 s cooldown |
| Q / E | Vertical strafe down / up |
| Space | Booster (fuel, regenerates) |
| Shift | Hover/brake; Bulwark: toggle Siege mode |
| R | Launch from a Launch Deck |
| LMB / RMB | Primary / secondary weapon |
| 1–0 | 10-slot hotbar: skills, Flares (a skill), consumables (shield kit, repair kit, fuel cell) |
| Tab | Cycle target (one locked target at a time unless a Skill says otherwise) |
| Alt (hold) | Free-look |
| Scroll | Camera zoom |

Close third-person chase camera with slight lag. Mouse steering is deliberately damped (sensitivity setting + deadzone).

## 5. Combat

- **All projectiles are real.** Primaries: fast tracer rounds (dodgeable at range by strafing). Secondaries: missiles, rockets, bombs — slower; homing missiles have a turn-rate limit and can be outflown.
- **Flares** skill breaks missile locks.
- **Deflect** stat: chance (hard cap 15%) for a hit to glance for 30% damage. Wasp stacks highest.
- **Shield → HP.** Shield regenerates after 4 s without damage.
- Server-authoritative hit detection with **lag compensation** (rewind targets to shooter's view time, capped 200 ms).
- Death → respawn at nation's nearest spawn point after 5 s. Small credit/XP loss? **No** — no death penalty beyond the timer.
- Terrain/structure impact above a speed threshold: **with shield up the Ship bounces**, shield is emptied and a 15% max-HP chunk is lost; **with no shield the Ship is destroyed.** Low-speed scrapes are harmless.
- **Ammo**: Primary and Secondary have finite rounds per Frame (counter in HUD). Refill by docking on your Nation's **Launch Deck** (floating platform near spawn): slow down over it, dock, resupply in ~2 s, press **R** to launch. Respawn happens docked on a Launch Deck.
- **Damage feedback**: floating damage numbers on hits dealt (deflected hits marked), hit markers.

### HUD
- Circular HP/shield gauge around the reticle area, fuel arc, ammo counters for Primary/Secondary.
- **Radar**: circular, heading-up, range per Frame (`radarRangeM`); blips above/below marked. Enemies beyond radar range are neither shown nor sent by the server.
- **Crosshair range**: shows distance to what's under the aim; changes state when inside Primary range / missile lock range.
- Hotbar slots show icons (original art), cooldown sweep, key number.
- Other Ships: name only — **red = enemy, white = ally** — plus distance. No heavy brackets; the single locked target gets one clear marker.

## 6. Progression

- **Pilot level 1–100**, 8–10 h total. ~70% XP from story missions, rest from PvP/events. Early levels fast.
- **10 gear tiers**, one per chapter (every 10 levels).
- **Upgrades +0 → +10** per item. Deterministic: costs Credits + Scrap, **never fails, never breaks**. Every step is visible (glow, trail colour, extra brick plating). T10+10 looks outrageous.
- **Shop** in each city sells base gear for all unlocked tiers.
- **Rare drops**: modded variants; player picks 1 of 3 rolled fixed bonuses (e.g. +8% projectile speed).
- **Glory**: PvP currency & rank ladder (kills, assists, objectives, event wins; bonus for defending). Unlocks ranks, titles, cosmetics, sidegrade variants, command abilities in events.

### Currencies
| Name | Purpose |
|---|---|
| **Credits** | Spending money (shop, upgrades) |
| **Scrap** | Upgrade material (missions, mobs, events) |
| **Glory** | PvP rank currency |

## 7. Maps

Each map has an **environment profile** (gravity, stall speed, ground behaviour) read by the flight model — new map types are mostly data.

| Map | Profile | Content | Story |
|---|---|---|---|
| **Gildspire** / **Rivet Harbor** | City (safe zone) | Shop, hangar, mission board, enemy-proof | — |
| **Rustwater Canyons** | Atmospheric, desert canyons | Low-altitude gorge dogfights; **Strategic Point war** | Ch. 1–3 |
| **Shatterwave Archipelago** | Atmospheric, stormy ocean, floating islands, lightning hazards | **Base war**, **Capture the Flag** | Ch. 4–6 |
| **The Graveyard Belt** | Space: zero-G, no stall, asteroids & capital wrecks; Bulwark siege-locks to hulls | **Mothership raid** | Ch. 7–10 |

**Gate graph:** `Gildspire ↔ Canyons ↔ Archipelago ↔ Belt ↔ Rivet Harbor`, plus a shortcut gate from each city to its frontline. Each map has a home side per nation.

**Instances:** max **60 pilots** per map instance (30/nation). Overflow opens a new channel. Bots top each nation up to 20 when humans are scarce. Story missions run in **private instanced pockets** (no griefing).

## 8. Events (scheduled)

| Event | Map | Win condition |
|---|---|---|
| Strategic Point war | Canyons | Hold majority of capture points when timer ends |
| Base war | Archipelago | Destroy enemy forward base core |
| Capture the Flag | Archipelago | First to N captures |
| Mothership raid | Belt | Destroy (or defend) the nation mothership |

All award Glory; defenders get a bonus.

## 9. Art direction

- Stylized PBR, "high quality stylized" — not photoreal.
- Frames: modular instanced brick parts, emissive nation accents; upgrade tiers bolt on parts/glow/trails.
- Terrain: deterministic procedural heightfields from seed; CC0 PBR textures (Poly Haven, ambientCG) splat-blended; instanced rocks/structures; HDRI or procedural skies; fog; bloom.
- Space: starfield, nebula, planet backdrops.
- Perf target: **60 fps at 1080p on M1 integrated / GTX 1060**. Low/Med/High presets.

## 10. Tech (summary — see ARCHITECTURE.md)

pnpm monorepo · Vite + React + react-three-fiber + drei + postprocessing · zustand · Rapier (WASM, shared client/server) · Node + Colyseus (Fly.io) · Postgres (Neon) + Drizzle · Discord OAuth + email magic link · client on Vercel.

## 11. Dev tooling (local only)

- **Leva** panel: live-tweak flight constants, weapon stats, camera, lighting, post-fx; export JSON.
- **Rapier debug** wireframe (colliders, hitboxes, projectile sweeps).
- **Server slash commands**: `/spawn <item> [+n]`, `/level <n>`, `/glory <n>`, `/god`, `/tp <map>`, `/bots <n>`, `/event start <type>`, `/timescale <x>`.
- **Lag simulator**: latency / jitter / packet loss.
- Enabled only when `NODE_ENV=development` or account has admin role; stripped from prod client build.

## 12. Milestones

| Milestone | Scope |
|---|---|
| **M0 — Starter repo** | Monorepo, client/server/shared, Docker Postgres + Drizzle schema stub, Leva + debug commands, `pnpm dev` |
| **M1 — Vertical slice** | Rustwater Canyons; all 4 Frames flyable with distinct handling + Bulwark siege; primary tracers, homing missiles, barrel roll, Flares, Deflect, death/respawn; server-authoritative netcode with prediction, interpolation, lag compensation, lag sim; bots to 20/nation; HUD (HP/shield/fuel, crosshair, lead indicator, 10-slot hotbar, minimap); hangar stub (pick nation + Frame) |
| **M2 — Economy** | Cities, shop, inventory, upgrades (+visuals), persistence, auth |
| **M3 — Campaign** | Story missions & cutscenes ch. 1–10, levels 1–100, full skill kits |
| **M4 — War** | Archipelago, Belt, 4 events, Glory rank |
| Expansion | Trading, nation switch, more maps, 100-pilot war instances, gamepad, real models |

## 13. Success criteria (M1)

- 20 v 20 (bots) on one instance, client holds 60 fps on target hardware, server tick ≤ 8 ms at 30 Hz.
- With 150 ms simulated latency, own ship feels instant; hits register where the shooter saw them.
- Each Frame is distinguishable blind by handling alone.
