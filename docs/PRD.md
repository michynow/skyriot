# SKYRIOT — Product Requirements Document

Working title. Original browser game in the nation-vs-nation arcade flight-combat MMO genre. Inspired by the _feel_ of that genre — not a recreation of any existing title. All names, lore, maps, ships, skills and art are our own.

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

| Nation               | Identity                                          | Colours            | City             |
| -------------------- | ------------------------------------------------- | ------------------ | ---------------- |
| **Aurelian Concord** | Smug corporate theocracy; shareholders are saints | Gold, white, cyan  | **Gildspire**    |
| **Vex Freehold**     | Scrapper punk republic; votes by bar fight        | Red, black, orange | **Rivet Harbor** |

A pilot picks a nation at character creation (switching nation = expansion feature, with cooldown/penalty).

### Story & tone

- Crude adult comedy (Borderlands / Deadpool register): swearing, innuendo, gross-out, morally rotten commanders on both sides, self-mocking propaganda.
- **No** explicit sexual content or nudity. Nothing sexual involving anything that reads as a minor.
- 17+ age gate at signup. "Clean comms" toggle bleeps profanity.
- Delivered as **radio-chatter cutscenes over gameplay** (20–40 s). No text walls.
- 10 chapters per nation (one per 10 levels). Each nation tells its own side; campaigns converge on a shared twist around ch. 7–8.

## 3. Frames (ships)

Every pilot owns all four Frames and swaps in the hangar. Each Frame has its own loadout and skill kit. Frames are brick-built ("lego-like") from modular parts in v1; GLB loading kept as a seam for real models later.

| Frame       | Role                  | Handling                                                      | Signature                                                                                                                                                                                |
| ----------- | --------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Wasp**    | Agile fighter         | Fastest engines, agile, lowest HP/shield                      | Highest Deflect stacking, burst evasion skills                                                                                                                                           |
| **Anvil**   | Bomber                | As agile as the Wasp but a little slower; all-round HP/shield | Siege barrages, carpet bombing, ground strike                                                                                                                                            |
| **Halo**    | Support               | Best turn rate, can hover; highest HP/defence                 | Heals, shields, buffs, debuff fields, resurrection beacon                                                                                                                                |
| **Bulwark** | Armored hover-gunship | Hovers, **lands and drives on terrain** (hull in space), slow | **Siege mode** (grounded = full strength; airborne = hover-locked, weaker multipliers; rooted, first-person gunner view, Target lock for mortar, +damage/+range), artillery, area denial |

### Core kits (v1)

Kits follow the genre's four gear classes (fighter / bomber / support / tank) for mechanics: effect types, magnitudes, durations and cooldowns (compressed for match length). Names, descriptions and icon art are our own.

| Frame   | Skill Kit (bars 1–2 of the default Hotbar)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Wasp    | **Afterburn Dash** (2.5 s straight boost), **Overdrive** (Secondary +damage, +1 missile, wider lock cone), **Quiver Surge** (+2 missiles, faster Secondary refire, short), **Trim Tabs** (+turn rate), **Roll Cascade** (no Barrel Roll cooldown, 8 s), **Shield Damper** (shield takes less damage), **Blind Tag** (enemy ahead: no missile warning, its rolls don't shake missiles)                                                                                                                                                                                                                                                                                                 |
| Anvil   | **Air Barrage Mode** / **Ground Strike Mode** / **Wide Lock Mode** (bombing modes changing the Secondary; off by default, press the active one again to turn it off; rockets and bombs burst on proximity; Wide Lock widens the Secondary lock cone by ~22°, +45% lock/fire range, and each salvo sends a guided rocket at up to 3 enemy Ships in the cone), **Overcharge Round** (next Primary round x10 damage, x2 range, no spread), **Chaff Screen** (4 decoys each soak a whole hit), **Shroud Veil** (stealth: off enemy radar beyond 180 m, unlockable, firing ends it), **Shield Damper**, **Core Breach** (self-destruct: your current HP as damage to enemies within 150 m) |
| Halo    | **Rally Field** / **Ward Lattice** / **Veer Field** (long ally auras: +damage / −damage taken / +Deflect), **Renewal Pulse** / **Recharge Pulse** (instant HP / shield to allies nearby), **Mend Beam** (instant heal on the most hurt ally), **Charge Beam** (instant shield refill on the ally with the lowest shield), **Lifeline** (full HP + shield on the most hurt ally), **Sanctum** (6 s invulnerable, weapons offline), **Purge** (allies shed debuffs and missile locks), **Dispel Lance** (strip an enemy's buffs), **Scan Pulse** (end enemy stealth nearby)                                                                                                             |
| Bulwark | **Ground Siege** / **Air Siege** (siege modes; sieged hull takes 25% / 15% less damage), **Quake Round** (heavy shell: 600 damage in a 70 m blast ahead), **Blast Ward** (immune to Secondary weapons, 10 s), **Shield Weave** (shield rebuilds over 8 s), **Snare Tag** (slow the enemy ahead), **Shield Breaker** (enemy ahead can't regenerate shield), **Track Drive** (landed: 2x drive speed), **Ground Shroud** (landed stealth), **Crash Frame** (half terrain-impact damage)                                                                                                                                                                                                 |

Every Frame also has the shared bar 3: **Pivot Flip**, **Backdraft**, the Consumables Repair Kit, Shield Kit and Fuel Cell, and five long buffs: **Gun Tune** (+Primary damage), **Warhead Tune** (+Secondary damage), **Steady Hands** (−spread, faster locks), **Hardened Hull** (−damage taken), **Jink Jets** (+Deflect). Dev: `/cast <skill-id>` casts any kit Skill. Numbers live in `content/weapons.ts` (`SKILLS`) and `sim/constants.ts`.

Long buffs last 1–2 minutes; active buffs show as timed icons in the HUD and as visual auras on the Ship. **Every Skill activation has its own animation** (Ship VFX + HUD flash). Hotbar icons are colour-coded: red attack, blue defence, green support, gold movement.

## 4. Controls

| Input                | Action                                                                                                                                                                                                                                               |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mouse                | Steers: ship turns toward the cursor at Frame turn rate. The **crosshair is fixed at screen centre (= Ship nose, where guns fire and missiles lock)**; a small arrow from centre shows the cursor direction                                          |
| W / S                | Throttle up / down (down to min speed: 0 = hover in place, Wasp 50 m/s; no stall)                                                                                                                                                                    |
| A / D                | Strafe (visual bank)                                                                                                                                                                                                                                 |
| **Double-tap A / D** | **Barrel roll** — full 360° spin with a 25–35 m lateral displacement, 0.25 s invulnerability, costs fuel, 3 s cooldown. Not available while Grounded/Docked or boosting                                                                              |
| Q / E                | Vertical strafe down / up                                                                                                                                                                                                                            |
| Space                | Booster (fuel, regenerates); wider turn while boosting, no Barrel Roll                                                                                                                                                                               |
| Shift                | Target: with no Target, hovering an enemy selects it, and it sticks. Shift switches the Target to the enemy under the cursor (one at a time). In Siege, Shift on a gun-locked Target drops the lock cleanly (no auto re-lock, no view snap)          |
| R                    | Launch from a Launch Deck                                                                                                                                                                                                                            |
| C                    | Land: onto the nearest own Launch Deck in range (autopilot), else "no landing pad in range". Bulwark: touch down on the terrain below; Grounded it drives with WASD and C lifts it off                                                               |
| B                    | Engine off (confirm B / Y): frozen exactly in place, weapons cold, Loadout open; W or boost restarts                                                                                                                                                 |
| LMB / RMB            | **Primary** (hold for continuous fire): hitscan roll against the Target within Primary radar range; zero damage with no Target in range; builds Overheat. **Secondary**: homes on the Target while LOCKED; without Lock it dumb-fires straight ahead |
| 1–0                  | Hotbar slot of the current set: skills, consumables (shield kit, repair kit, fuel cell)                                                                                                                                                              |
| Tab                  | Next of the 3 hotbar sets (F1–F3 pick one)                                                                                                                                                                                                           |
| Alt (hold)           | Free-look                                                                                                                                                                                                                                            |
| Scroll               | Camera zoom                                                                                                                                                                                                                                          |

Close third-person chase camera with slight lag. Mouse steering is deliberately damped (sensitivity setting + deadzone).

## 5. Combat

- **Easy to hit, hard to master.** Ships are large relative to the map. Primary is a hitscan roll: each round hits or misses by accuracy against the Target, so strafing does not dodge it. Accuracy falls beyond Primary range. The crosshair advises when the Secondary is lockable.
- **Missile lock is relative to the Ship's nose**, not the cursor. Evading missiles is a skill: a well-timed Barrel Roll makes a close missile overshoot, terrain breaks line of sight and eats missiles. There are no flares: defensive Skills (Purge, Blast Ward, Chaff Screen, Shroud Veil) cover the rest, and Blind Tag takes the roll away.
- **Target and Lock.** Pick a Target by hovering (when none) or with Shift. Lock is instant, with no lock timer: Target inside Secondary radar range and within Valid Angle of the nose. Leaving either bound drops to Target-only. Secondary salvos hold Lock through the whole volley. Without Lock a Secondary still fires, flying straight ahead (no homing); Anvil Ground Strike / Air Barrage bombs and the Bulwark salvo never need Lock.
- Siege Mode is a hotbar Skill (`Siege Anchor`), not a dedicated key.
- **Secondaries are real projectiles.** Missiles, rockets, bombs — slower; homing missiles visibly manoeuvre (pursuit guidance with a weave) under a turn-rate limit and can be outflown.
- **Deflect** stat: chance (hard cap 15%) for a hit to glance for 30% damage. Wasp stacks highest.
- **Shield → HP.** Shield regenerates after 4 s without damage.
- Server-authoritative hit detection with **lag compensation** (rewind targets to shooter's view time, capped 600 ms so 150 ms each way still registers).
- Death → respawn at nation's nearest spawn point after 5 s. Small credit/XP loss? **No** — no death penalty beyond the timer.
- Terrain/structure impact above a speed threshold: **with shield up the Ship bounces**, shield is emptied and a 15% max-HP chunk is lost; **with no shield the Ship is destroyed.** Low-speed scrapes are harmless.
- **Ammo**: Primary and Secondary have finite rounds per Frame (counter in HUD). Refill by docking on your Nation's **Launch Deck** (floating platform near spawn): slow down over it, dock, resupply in ~2 s, press **R** to launch. Respawn happens docked on a Launch Deck.
- **Damage feedback**: floating damage numbers on hits dealt (deflected hits marked), hit markers.

### HUD

- HP/shield/fuel panel top-left. Near the crosshair only Primary/Secondary rounds (icon + small weapon name). Incoming-missile warning with time-to-impact.
- **Radar**: circular, heading-up, range per Frame (`radarRangeM`); blips above/below marked. Enemies beyond radar range are neither shown nor sent by the server.
- **Crosshair range**: shows distance to what's under the aim; changes state when inside Primary range / Secondary lock range.
- Hotbar slots show icons (original art), cooldown sweep, key number.
- Other Ships: name only — **red = enemy, white = ally** — plus distance. No heavy brackets; the Target gets one clear frame marker, an edge arrow when off-screen, and a closing ring once LOCKED.
- **Missile alarm**: siren when a Secondary is fired at you (muted by Silence); radar flashes red; red edge arrows point at incoming missiles.
- **Removed**: no HUD pointers to Gates or Shield Stations.

## 6. Progression

- **Pilot level 1–100**, 8–10 h total. ~70% XP from story missions, rest from PvP/events. Early levels fast.
- **10 gear tiers**, one per chapter (every 10 levels).
- **Upgrades +0 → +10** per item. Deterministic: costs Credits + Scrap, **never fails, never breaks**. Every step is visible (glow, trail colour, extra brick plating). T10+10 looks outrageous.
- **Shop** in each city sells base gear for all unlocked tiers.
- **Rare drops**: modded variants; player picks 1 of 3 rolled fixed bonuses (e.g. +8% projectile speed).
- **Glory**: PvP currency & rank ladder (kills, assists, objectives, event wins; bonus for defending). Unlocks ranks, titles, cosmetics, sidegrade variants, command abilities in events.

### Currencies

| Name        | Purpose                                   |
| ----------- | ----------------------------------------- |
| **Credits** | Spending money (shop, upgrades)           |
| **Scrap**   | Upgrade material (missions, mobs, events) |
| **Glory**   | PvP rank currency                         |

## 7. Maps

Each map has an **environment profile** (gravity, ground behaviour) read by the flight model — new map types are mostly data.

| Map                              | Profile                                                                 | Content                                               | Story    |
| -------------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------- | -------- |
| **Gildspire** / **Rivet Harbor** | City (safe zone)                                                        | Shop, hangar, mission board, enemy-proof              | —        |
| **Rustwater Canyons**            | Atmospheric, desert canyons                                             | Low-altitude gorge dogfights; **Strategic Point war** | Ch. 1–3  |
| **Shatterwave Archipelago**      | Atmospheric, stormy ocean, floating islands, lightning hazards          | **Base war**, **Capture the Flag**                    | Ch. 4–6  |
| **The Graveyard Belt**           | Space: zero-G, asteroids & capital wrecks; Bulwark siege-locks to hulls | **Mothership raid**                                   | Ch. 7–10 |

**Gate graph:** `Gildspire ↔ Canyons ↔ Archipelago ↔ Belt ↔ Rivet Harbor`, plus a shortcut gate from each city to its frontline. Each map has a home side per nation.

**Instances:** max **60 pilots** per map instance (30/nation). Overflow opens a new channel. Bots top each nation up to 5 when humans are scarce (`/bots <n>` raises it for load tests). Story missions run in **private instanced pockets** (no griefing).

## 8. Events (scheduled)

| Event               | Map         | Win condition                                   |
| ------------------- | ----------- | ----------------------------------------------- |
| Strategic Point war | Canyons     | Hold majority of capture points when timer ends |
| Base war            | Archipelago | Destroy enemy forward base core                 |
| Capture the Flag    | Archipelago | First to N captures                             |
| Mothership raid     | Belt        | Destroy (or defend) the nation mothership       |

All award Glory; defenders get a bonus.

## 9. Art direction

- Stylized PBR, "high quality stylized" — not photoreal.
- Frames: modular instanced brick parts, emissive nation accents; upgrade tiers bolt on parts/glow/trails.
- Terrain: deterministic procedural heightfields from seed; CC0 PBR textures (Poly Haven, ambientCG) splat-blended; instanced rocks/structures; HDRI or procedural skies; fog; bloom.
- Space: starfield, nebula, planet backdrops.
- Perf target: **60 fps at 1080p on M1 integrated / GTX 1060**. Low/Med/High presets.

## 9b. Audio

- Procedural Web Audio SFX (no samples): positional weapons, missiles, hits, boost, rolls, locks/warnings, Skill activations, docking, impacts. Music is file-based per map: one looping track per map (warzone / Concord city / Vex city) from the gitignored `apps/client/public/music/`, faded between maps and on leaving; a missing file plays nothing; the Lobby is silent.
- Master/SFX/music volume + mute (M). Sample-file adapter can replace synth recipes later without caller changes.

## 10. Tech (summary — see ARCHITECTURE.md)

pnpm monorepo · Vite + React + react-three-fiber + drei + postprocessing · zustand · Rapier (WASM, shared client/server) · Node + Colyseus (Fly.io) · Postgres (Neon) + Drizzle · Discord OAuth + email magic link · client on Vercel.

## 11. Dev tooling (local only)

- **Leva** panel: live-tweak flight constants, weapon stats, camera, lighting, post-fx; export JSON.
- **Rapier debug** wireframe (colliders, hitboxes, projectile sweeps).
- **Server slash commands**: `/spawn <item> [+n]`, `/level <n>`, `/glory <n>`, `/god`, `/tp <map>`, `/bots <n>`, `/event start <type>`, `/timescale <x>`.
- **Lag simulator**: latency / jitter / packet loss.
- Enabled only when `NODE_ENV=development` or account has admin role; stripped from prod client build.

## 12. Milestones

| Milestone               | Scope                                                                                                                                                                                                                                                                                                                                                                                                     |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **M0 — Starter repo**   | Monorepo, client/server/shared, Docker Postgres + Drizzle schema stub, Leva + debug commands, `pnpm dev`                                                                                                                                                                                                                                                                                                  |
| **M1 — Vertical slice** | Rustwater Canyons; all 4 Frames flyable with distinct handling + Bulwark siege; primary tracers, homing missiles, barrel roll, Deflect, death/respawn; server-authoritative netcode with prediction, interpolation, lag compensation, lag sim; bots to 5/nation (`/bots <n>` for load tests); HUD (HP/shield/fuel, crosshair, lead indicator, 10-slot hotbar, minimap); hangar stub (pick nation + Frame) |
| **M2 — Economy**        | Cities, shop, inventory, upgrades (+visuals), persistence, auth                                                                                                                                                                                                                                                                                                                                           |
| **M3 — Campaign**       | Story missions & cutscenes ch. 1–10, levels 1–100, full skill kits                                                                                                                                                                                                                                                                                                                                        |
| **M4 — War**            | Archipelago, Belt, 4 events, Glory rank                                                                                                                                                                                                                                                                                                                                                                   |
| Expansion               | Trading, nation switch, more maps, 100-pilot war instances, gamepad, real models                                                                                                                                                                                                                                                                                                                          |

## 13. Success criteria (M1)

- 20 v 20 (bots via `/bots 20`) on one instance, client holds 60 fps on target hardware, server tick ≤ 8 ms at 30 Hz.
- With 150 ms simulated latency, own ship feels instant; hits register where the shooter saw them.
- Each Frame is distinguishable blind by handling alone.
