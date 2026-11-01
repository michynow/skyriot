# SKYRIOT

Nation-vs-nation arcade flight-combat game. This glossary is the ubiquitous language for code, docs and conversation.

## People & factions

**Pilot**:
A player's persistent character: nation, level, inventory, Glory. Owns all four Frames.
_Avoid_: character, player (when meaning the persistent entity), user

**Nation**:
One of the two warring factions — Aurelian Concord or Vex Freehold.
_Avoid_: faction, team, side

**Bot**:
A server-driven Pilot that fills a Nation's ranks in a Map Instance when humans are scarce.
_Avoid_: AI, NPC (NPCs are story characters / mobs)

**Mob**:
A hostile non-Pilot enemy (drones, turrets) in missions and maps.
_Avoid_: monster, creep

## Ships & combat

**Frame**:
A flyable ship class: Wasp, Anvil, Halo or Bulwark.
_Avoid_: gear, ship class, vehicle

**Ship**:
A Frame being flown in the world right now — the live entity with position, HP, shield, fuel.
_Avoid_: player entity, avatar

**Loadout**:
The gear items and hotbar assignments a Pilot has equipped on one Frame.
_Avoid_: build, kit

**Primary / Secondary**:
The two weapon slots fired by LMB / RMB.

**Skill**:
An active ability on the hotbar with a cooldown, specific to a Frame (Flares is a Skill).
_Avoid_: ability, spell, power

**Consumable**:
A single-use hotbar item: shield kit, repair kit, fuel cell.
_Avoid_: potion, item (too broad)

**Hotbar**:
The 10 slots bound to keys 1–0, holding Skills and Consumables.

**Projectile**:
Any fired thing that travels through the world and can be dodged: tracer round, missile, rocket, bomb.
_Avoid_: bullet (only for tracers), shot

**Barrel Roll**:
Double-tap A/D lateral burst with a short invulnerability window.
_Avoid_: dodge roll, evade

**Deflect**:
The capped chance for a hit to glance and deal reduced damage.
_Avoid_: evasion, dodge chance

**Ammo**:
Finite rounds for a Ship's Primary and Secondary, refilled on a Launch Deck.

**Launch Deck**:
A Nation's floating platform where Ships Dock, resupply and launch.
_Avoid_: pad, hangar (Hangar is the City loadout screen)

**Base**:
A Nation's fortress on a Map: Core, two Shield Stations, Turrets and Launch Tunnels. Destroying the enemy Core wins the Battle.
_Avoid_: HQ, fort, city (City is the safe-zone hub)

**Core**:
The Base's main building. Invulnerable under its shield dome while any Shield Station stands.

**Shield Station**:
One of two Base structures that keep the Core's shield dome up.
_Avoid_: generator, pylon

**Turret**:
A Base anti-air gun that fires at enemy Ships in range; can be destroyed.
_Avoid_: AA, tower

**Launch Tunnel**:
A tunnel in a Base with a hidden catapult runway; Ships are thrown out of it into flight.

**Launch Queue**:
The order in which Ships waiting in a Base's hangar (after spawning or dying) get staged into a Launch Tunnel. One Ship per tunnel every few seconds.

**Battle**:
One round on a Map Instance, from Bases intact until one Core falls; then the Bases rebuild and a new Battle starts.
_Avoid_: match, round

**Stall**:
Flying slower than the Map's stall speed: the nose drops and steering is weak until speed recovers.

**Docked**:
A Ship resting on a Launch Deck, stationary and resupplying until it launches.

**Target**:
The single enemy Ship a Pilot has selected; missiles can only lock onto it.

**Grounded**:
A Bulwark that has landed and drives on terrain (or a hull in space).

**Siege Mode**:
Bulwark toggle that roots the Ship (full strength when Grounded, weaker hover-locked in the air), switches to first-person gunner view and extends damage, range and lock.

## Progression & economy

**Level**:
Pilot level, 1–100.

**Tier**:
Gear generation, 1–10, one unlocked per Chapter.

**Upgrade**:
A deterministic +0 → +10 enhancement of one gear item; never fails.
_Avoid_: enchant, refine

**Mod**:
A fixed bonus on a rare-drop gear item, chosen by the Pilot from three rolled options.
_Avoid_: affix, prefix, suffix

**Credits**:
Spending currency.

**Scrap**:
Upgrade material currency.

**Glory**:
PvP currency and rank ladder score.
_Avoid_: fame, honor

## World

**Map**:
A playable zone definition (terrain, Environment Profile, spawn points, gates).
_Avoid_: zone, level (Level means Pilot level)

**Map Instance**:
One running copy of a Map on the server, capped at 60 Ships.
_Avoid_: room (implementation term), server, shard

**Channel**:
An additional public Map Instance opened when the first is full.

**Pocket**:
A private Map Instance for a story Mission.

**City**:
A Nation's safe-zone hub Map with shop, hangar and mission board.
_Avoid_: town, base

**Gate**:
A warp link between two Maps.
_Avoid_: portal, warp point

**Environment Profile**:
Map data that tunes physics: gravity, stall speed, what counts as ground.

## Story & events

**Mission**:
A 5–10 minute objective run in a Pocket, part of a Chapter.
_Avoid_: quest

**Chapter**:
A block of Missions spanning 10 Levels, ending in a Tier unlock.

**Event**:
A scheduled nation-wide battle: Strategic Point war, Base war, Capture the Flag, Mothership raid.
_Avoid_: war (alone), raid (alone)
