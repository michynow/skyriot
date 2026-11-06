# RPG UI rework — plan

Status: **proposal, awaiting review.** Nothing here is implemented. Visual reference: [`rpg-ui-mockup.html`](rpg-ui-mockup.html) (open it in a browser).

Goal: turn the M2 economy (weapons + engines, a text-list Hangar inside the Esc menu, a fixed 3×10 Hotbar) into a proper MMORPG layer: a Pilot owns **Items** with sprites, rarity, Mods and +N Upgrades; each Frame wears them in nine **equipment slots** on a paper-doll; the Hotbar is the Pilot's own layout; every window looks hand-made and reads well at a glance.

Pillars carried over from the PRD and not reopened: no premium currency, no pay-to-win, Upgrades are deterministic (ADR 0004), server is the only writer of inventory (ARCHITECTURE §5).

---

## 1. Equipment slots

Equipped per **Frame** (each Frame keeps its own Loadout), except Charms, which are per **Pilot** because their main effects (XP, Credits) are Pilot-wide.

| Slot          | Fits                                       | Swap where                           | What it does in the sim                                                                                                                                 |
| ------------- | ------------------------------------------ | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Armor**     | that Frame's armor line (like engines)     | City or Docked                       | Sets `maxHp`, `maxShield`, `shieldRegenPerSec` and the new **Defence** stat (damage taken ×(1 − Defence), cap 30%). May add Deflect (still capped 15%). |
| **Engine**    | that Frame's engine line (exists today)    | City or Docked                       | Speed envelope and handling (`EngineDef`, unchanged).                                                                                                   |
| **Primary** (STD) | any gun (`fitsSlot` by projectile kind, as today) | City or Docked               | Primary weapon, damage scaled by Upgrade.                                                                                                               |
| **Secondary** (ADV) | same kind as the Frame's stock Secondary | City or Docked                    | Secondary weapon.                                                                                                                                       |
| **Radar**     | any Frame                                  | City or Docked                       | Multiplies the Frame's stock `radarStdM`, `radarAdvM`, `radarRangeM` (minimap radius and visibility), and may add Valid Angle degrees. Shown to the player as absolute metres for the Frame. |
| **Cosmetic**  | any Frame                                  | Anywhere                             | Visual only: paint scheme + trail colour on the Ship model, seen by everyone. Zero stats, ever.                                                         |
| **Charm I–III** | any (Pilot-wide)                         | Anywhere                             | Percentage buffs for N hours of **real time**: XP, Credits, Scrap, Glory (server-side rewards) and small combat buffs (Primary/Secondary damage, Defence). |

Why radar is universal but armor/engine are per Frame: armor and engines change the Frame's body (its HP class and handling identity, PRD §3), so each Frame gets its own line. A radar is a sensor box; multiplying the Frame's stock ranges keeps the Wasp long-sighted and the Bulwark short-sighted while one item works on all four.

**Swap where.** Gear that changes combat numbers (armor, engine, weapons, radar) swaps only in a City or while Docked on a Launch Deck (Docked is new: today it's City only). Charms, Cosmetic and the Hotbar layout change anywhere, including mid-flight; the Ship keeps flying straight while a window is open (§6).

### Charms

- Up to 3 Charm slots. Slot I from Level 1, slot II at Level 30, slot III at Level 60.
- Timer starts the first time the Charm is equipped (**activation**) and runs in real time from then on: offline, unequipped, in a City. Unequipping doesn't pause it. When `expiresAt` passes, the item is deleted and the Pilot gets a chat line.
- Same effect doesn't stack: two XP Charms → the higher one counts (the tooltip says so, the second shows "inactive").
- Durations: 1 h, 5 h, 24 h. Magnitudes: reward Charms +10% / +25% / +50%; combat Charms +3% / +5% (kept small on purpose: fairness pillar).
- Sources: Mission rewards, Event rewards, a Glory vendor, and a Credits vendor for the 1 h reward Charms. No real money.
- Server: on join and once a minute per Map Instance, `expireCharms(profile, now)`; when a combat Charm expires it calls `sim.setGear` again. The sim never reads the clock (CODING_STANDARDS).

---

## 2. Item model

### Def vs. instance

- **ItemDef** (content, static): what an item *is*. Id, kind, name, tier, required Level, Frame it fits, sprite id, flavour text, shop price, stack size, and the kind's stat record (existing `WEAPONS` / `ENGINES`, new `ARMORS`, `RADARS`, `CHARMS`, `COSMETICS`, consumables stay in `SKILLS`).
- **ItemInstance** (profile, per Pilot): one owned thing. Id, def, Upgrade, rarity, chosen Mods, stack count, charm expiry, bag position.

### Kinds

`'weapon' | 'engine' | 'armor' | 'radar' | 'cosmetic' | 'charm' | 'consumable'` — `weapon` stays one kind; `fitsSlot` already decides Primary vs. Secondary.

### Tier and Upgrade

- Tier 1–10 (one per Chapter, PRD §6). The shop sells Standard rarity of every unlocked tier.
- Upgrade +0..+10, deterministic, unchanged formula (`upgradeCost`, `upgradeMul` = +3% per step). What it scales per kind:
  weapon damage · engine speeds · armor HP and shield · radar ranges (+1.5% per step, half rate) · charm, cosmetic, consumable: not upgradable.

### Rarity and Mods

Rarity only decides how many **Mods** an item carries; base stats don't change with rarity. Rarer items drop (missions, Mobs, Events); the shop sells Standard only.

| Rarity        | Colour (§7) | Mods |
| ------------- | ----------- | ---- |
| Standard      | parchment white | 0 |
| Tuned         | green       | 1    |
| Custom        | blue        | 2    |
| Prototype     | violet      | 3    |
| Relic         | amber       | 3 + one Relic Mod (a stronger, item-specific line) |

Mods follow CONTEXT.md: each Mod slot rolls **three options** server-side on drop; the Pilot picks one, once, from the item's tooltip ("Choose Mod"). Until picked the slot shows "Unchosen Mod" in grey. Mod values scale with tier. Mod pool per kind (fixed values, no random ranges, so no reroll gambling):

- weapon: +damage %, +fire rate %, +projectile speed %, +accuracy (Primary), +Valid Angle (Secondary), +ammo %
- engine: +max speed %, +boost speed %, +turn rate %, −fuel burn %
- armor: +HP %, +shield %, +shield regen %, +Defence, +Deflect
- radar: +STD range %, +ADV range %, +Valid Angle

### Stacks

- Only Consumables stack (Repair Kit, Shield Kit, Fuel Cell; max 20 per stack). Everything else is 1 per bag cell.
- Consumables become **finite**: one cast uses one from the stack; the server decrements and resends the profile. They keep their cooldown. Buying is cheap (Credits) so the fairness pillar holds; an empty stack greys the Hotbar slot and shows 0.
- New Pilots start with 5 of each.

### Bag

- 48 cells (8 × 6). Each instance has a `bag` index (null = equipped). Drag to rearrange, "Sort" button orders by kind → tier → rarity. A full bag blocks buying; drops overflow to a "Salvage" mail line (later). Bag expansion is out of scope.
- Sell to a vendor for 25% of the Credits price (Upgrades not refunded, said in the confirm). Discard = sell for 0, confirm required.

### Sprite id

`ItemDef.icon` names an entry in the client icon registry; default is the def id. Variants of one line share a glyph and differ by tier trim (§8), so 36 shop items need 12 drawings, not 36.

---

## 3. Contract changes (all additive)

`packages/shared/src/types.ts` (orchestrator-owned, so session 0 lands these before anything else):

```ts
export type ItemKind = 'weapon' | 'engine' | 'armor' | 'radar' | 'cosmetic' | 'charm' | 'consumable';
export type Rarity = 'standard' | 'tuned' | 'custom' | 'prototype' | 'relic';
export type ArmorId = string; export type RadarId = string; export type CharmId = string; export type CosmeticId = string;
export type ItemDefId = WeaponId | EngineId | ArmorId | RadarId | CharmId | CosmeticId | SkillId; // widened

export interface ItemDef {
  id: ItemDefId;
  kind: ItemKind;
  name: string;
  tier: number;
  levelReq: number;
  /** Frame it fits (armor, engine); absent = any. Weapons keep using fitsSlot. */
  frame?: FrameId;
  /** Icon registry key; defaults to id. */
  icon?: string;
  flavor?: string;
  credits: number;
  /** Max per bag cell; 1 = doesn't stack. */
  stack: number;
}

export interface ArmorDef { id: ArmorId; maxHp: number; maxShield: number; shieldRegenPerSec: number; defence: number; deflectAdd?: number }
export interface RadarDef { id: RadarId; stdMul: number; advMul: number; rangeMul: number; validAngleAdd?: number }
export interface CharmDef { id: CharmId; hours: number; effect: CharmEffect }
export interface CharmEffect { xpPct?: number; creditsPct?: number; scrapPct?: number; gloryPct?: number; primaryDamagePct?: number; secondaryDamagePct?: number; defenceAdd?: number }
export interface CosmeticDef { id: CosmeticId; paint: string; trail: string }
export interface ModDef { id: string; kind: ItemKind; label: string; /** value at tier 1; scaled by tier */ base: number; perTier: number; stat: ModStat }
export type ModStat = 'damagePct' | 'fireRatePct' | 'projectileSpeedPct' | 'accuracyAdd' | 'validAngleAdd' | 'ammoPct'
  | 'maxSpeedPct' | 'boostSpeedPct' | 'turnRatePct' | 'fuelBurnPct' | 'hpPct' | 'shieldPct' | 'shieldRegenPct'
  | 'defenceAdd' | 'deflectAdd' | 'stdRangePct' | 'advRangePct';

export interface ItemInstance {
  id: ItemId;
  def: ItemDefId;
  kind: ItemKind;            // widened from 'weapon' | 'engine'
  upgrade: number;
  rarity?: Rarity;           // absent = 'standard'
  /** One entry per Mod slot: chosen Mod id, or the three offered ids until the Pilot picks. */
  mods?: (string | [string, string, string])[];
  count?: number;            // stacks; absent = 1
  expiresAt?: number;        // charm, epoch ms, set on activation
  bag?: number | null;       // bag cell; null/absent while equipped
}

export interface Loadout {
  primary?: ItemId; secondary?: ItemId; engine?: ItemId;   // existing
  armor?: ItemId; radar?: ItemId; cosmetic?: ItemId;       // new
  /** HOTBAR_BARS × HOTBAR_BAR_SLOTS Skill / Consumable ids; absent = the Frame's default FrameDef.hotbar. */
  hotbar?: (SkillId | null)[];
}

export interface PilotProfile { /* existing fields */ charms: (ItemId | null)[] }   // length 3

export interface FrameDef { /* existing */ defence?: number }                        // 0 when absent
export interface ShipState { /* existing */ cosmetic: CosmeticId | '' }              // seen by all clients
export interface ShipSpawn { /* existing */ cosmetic?: CosmeticId }

// Wire (MSG gains): sell, discard, moveItem, hotbar, chooseMod
export interface EquipRequest { frame: FrameId; slot: EquipSlot; item: ItemId | null }  // slot widened
export type EquipSlot = Exclude<keyof Loadout, 'hotbar'> | 'charm0' | 'charm1' | 'charm2';
export interface SellRequest { item: ItemId; count?: number }
export interface MoveItemRequest { item: ItemId; bag: number }          // swap if occupied; split stacks later
export interface HotbarRequest { frame: FrameId; slots: (SkillId | null)[] }
export interface ChooseModRequest { item: ItemId; slot: number; mod: string }
```

`packages/shared/src/content/**`:

- `items.ts` (new): `ITEMS: Record<ItemDefId, ItemDef>` for every ownable def. `SHOP` becomes `Object.values(ITEMS).filter(sold)`; `ShopEntry` stays as a derived shape so existing callers keep working.
- `armors.ts`, `radars.ts`, `charms.ts`, `cosmetics.ts`, `mods.ts` (new). Armor lines: 4 Frames × T1–T3 like engines; T1 = today's stock Frame numbers, so nothing gets weaker. Radar lines: Picket (balanced, ×1.0/1.0 at T1), Spyglass (long ADV, −STD), Brushfire (long STD, +Valid Angle). Charms: Mentor's Coin (XP), Ledger Charm (Credits), Magpie Charm (Scrap), Laurel Charm (Glory), Grudge Charm (damage), Ward Charm (Defence) × 1 h / 5 h / 24 h.
- `economy.ts`: `fitsSlot` widened to the new slots; `gearOf` returns armor/radar/cosmetic too and the Pilot's charms; new `BAG_SIZE = 48`, `CHARM_SLOT_LEVELS = [1, 30, 60]`, `SELL_RATE = 0.25`, `CONSUMABLE_STACK = 20`, `STARTING_CONSUMABLES`.
- `frames.ts`: `hotbar` stays as the **default** layout only; comment updated.
- Consumables keep living in `SKILLS` (kind `'consumable'`) and get `ITEMS` entries with `stack: 20`.

Sim (`packages/shared/src/sim`):

- `gear.ts` `resolveGear` lays armor, radar, Mods, combat Charms and the Pilot's hotbar onto `over` (it already does this for engine and weapons). `defence` is read in `damage.ts`.
- `skills.ts` reads `rec.fd.hotbar` (per Ship) instead of `ctx.frames[frame].hotbar`. Same in the toggle-group cooldown loop.
- **Cooldowns follow the Skill, not the slot.** When `setGear` changes the hotbar, remap `s.cooldowns` by Skill id (old slot → new slot). Otherwise dragging a Skill to another slot would reset its cooldown.
- Duplicate Skills on the hotbar are rejected server-side (the second copy becomes null): two copies would mean two cooldowns.
- Consumable charges: `Sim.setCharges(id, Record<SkillId, number>)`; `castSkill` refuses a consumable with 0 charges. Server decrements the profile on the `skillUsed` event and calls `setCharges`.
- Client prediction builds the same gear from the same profile (`gearOf`), as today.

### DB (`apps/server/src/db/schema.ts`, one migration, additive)

| Table     | Change                                                                                                 |
| --------- | ------------------------------------------------------------------------------------------------------ |
| `item`    | + `rarity text not null default 'standard'`, + `mods jsonb not null default '[]'`, + `count integer not null default 1`, + `expires_at timestamp null`, + `bag integer null` |
| `pilot`   | + `charms jsonb not null default '[null,null,null]'`                                                   |
| `loadout` | none: `slots` jsonb gains `armor`, `radar`, `cosmetic`, `hotbar` keys                                  |

Existing rows load unchanged: missing keys mean stock gear and the default hotbar. Bag positions are assigned on load for items with `bag = null` that aren't equipped.

---

## 4. Free Hotbar

- 3 bars × 10 slots (unchanged `HOTBAR_BARS`, `HOTBAR_BAR_SLOTS`). Any kit Skill or Consumable can go on any slot of any bar. Nothing is fixed to bar 1/2/3; `FrameDef.hotbar` is just the first layout a new Pilot gets.
- Saved per Pilot per Frame in `Loadout.hotbar`, sent with `HotbarRequest` (debounced 500 ms after the last drop). Guests keep it for the session.
- **Drag sources**: Skill book rows, Inventory Consumable stacks, other hotbar slots. **Drop**: on a slot replaces (the old entry swaps to the source slot when the source was a hotbar slot); dragging a slot off the bar clears it. Right-click a Skill book row: put it in the first empty slot.
- Bar lock (padlock button on the bar): when locked, slots can't be dragged off by accident. Default locked in flight, unlocked while any window is open.
- Keys: 1–0 fire the visible bar. TAB cycles bars (today's behaviour). New option "Show all bars" stacks bars 2 and 3 above bar 1 (keys Shift+1–0 and Alt+1–0 for those). Off by default.
- Consumable slots show the stack count bottom-right; 0 greys out the icon.
- Bots ignore all of this: they keep `FRAMES[frame].hotbar`.

---

## 5. Windows

Shared chrome for all of them (§7). Windows are draggable by the title bar, remember position per window in `localStorage`, close with their key, Esc or the × button. Several can be open at once (Character + Inventory side by side is the main pairing). Esc closes the top window first; with none open it opens the Esc menu, as today.

| Window | Key | Contents |
| ------ | --- | -------- |
| **Character** | **P** (Pilot) | Paper-doll: live Frame model (reuse `FramePreview.tsx`) in the centre, slots around it — left column Armor, Engine, Radar; right column Primary (STD), Secondary (ADV), Cosmetic; Charm I–III row below with countdowns. Frame tabs (Wasp/Anvil/Halo/Bulwark) on top to edit any Frame's Loadout. Right pane: resolved stats grouped as **Hull** (HP, Shield, Regen, Defence, Deflect), **Flight** (Max, Boost, Min speed, Turn), **Arms** (STD dmg/DPS, ADV dmg/salvo, Valid Angle), **Sensors** (STD, ADV, Radar range). Level, XP bar, Nation crest, wallet. |
| **Inventory** | **I** | 8×6 bag grid of 52 px cells. Filter tabs: All · Gear · Consumables · Charms · Cosmetics. Footer: Credits, Scrap, Glory, used cells "31/48", Sort. Right-click equips (to the Frame shown in Character, else the flown Frame) or uses; Shift-click links the item in chat (later). |
| **Skill book** | **K** | Frame kit list, one row per Skill: 44 px icon, name, category colour, cooldown, duration, one-line description, "On bar 1·3" marker. Grouped: Frame Skills, Shared Skills, Consumables. Drag to Hotbar. |
| **Vendor** | interact at a City shop kiosk (or **V** in a City) | Tabs Buy · Sell · Workshop (Upgrade). Buy list filtered "fits current Frame" by default; Workshop shows the +N ladder with the exact Credits + Scrap cost and before → after numbers. Opens the Inventory beside it. |
| **Tooltip** | hover | See below. |

The Hangar tab inside the Esc menu is removed once these land.

### Item tooltip

Top to bottom, fixed order so players learn where to look:

1. Name in rarity colour, `+N` after it.
2. Kind · slot · Tier · Frame fit, e.g. "Secondary · Missile · Tier 2 · any Frame". Red if it doesn't fit the shown Frame or Level is too low.
3. Core stats as label / value rows, tabular numerals, right-aligned.
4. **Comparison column** against the item in the same slot of the shown Frame: green `+42` / red `−8` per row, plus a one-word verdict at the bottom ("Upgrade", "Sidegrade", "Downgrade") from the kind's headline stat. Holding Shift shows the equipped item's tooltip next to it.
5. Mods, one line each, in the rarity colour; unchosen ones grey with "Choose Mod".
6. Charm: effect, duration or remaining time ("4 h 12 m left").
7. Flavour line, italic, muted.
8. Footer: sell price, "Right-click to equip".

### In flight vs. City

- **City**: everything open and editable. Vendor only here.
- **Flight**: P, I, K open. Opening a window releases pointer lock, the virtual stick re-centres (Ship flies straight, throttle held) and a small "FLIGHT HELD — windows open" line shows under the crosshair. Gear slots are view-only unless Docked; Charms, Cosmetic, Hotbar are editable. Closing the last window re-captures the mouse on the next click.
- Halt (B) panel: replaced by the Character window opened read-only.

---

## 6. Readability rules

- **Type.** Two families, both Google Fonts, self-host before ship:
  - *Display / window titles / slot captions*: **Saira Condensed** 600–700, uppercase, tracking +0.06em. Used only at ≥ 13 px.
  - *Body, stats, tooltips*: **Barlow** 500/600, `font-variant-numeric: tabular-nums` for every number.
  - Scale (px): 11 caption (slot labels, key hints; minimum, never smaller) · 13 body / stat rows · 15 item name / row titles · 18 window title · 24 headline (Pilot name, verdict). Line-height 1.35 body, 1.1 titles.
  - Rajdhani and Orbitron stay in the flight HUD for now; the windows don't use them (Rajdhani is too thin at 12–13 px for long stat lists).
- **Contrast.** Body text ≥ 7:1 on panel fill, secondary text ≥ 4.5:1, rarity colours tuned to ≥ 4.5:1 on the tooltip fill. No text over the 3D scene without a panel behind it.
- **Panel chrome.** Gunmetal plate (`#1b1e23` → `#14161a`), 1 px inner highlight, 2 px brass rim (`#9a7a45`) with chamfered (45°) corners, rivet dots at corners only. Title bar is a darker inset strip with the title stamped left and × right. Content wells (slots, lists) are inset: darker fill, inner shadow, 1 px dark rim. No glass, no blur, no rounded "cards". Nation tint only in the title-bar crest and the selected-tab underline (Concord gold / Vex red).
- **Rarity colours** (text and slot frame): Standard `#e6dcc6`, Tuned `#7fd46b`, Custom `#5aa8ff`, Prototype `#b98cff`, Relic `#ffa640`. Slot frame = 2 px border in that colour at 70%; Relic adds a slow 4 s glint, nothing else animates.
- **Stat deltas**: better `#7fd46b`, worse `#ff6b5a`, equal muted. Always with a sign, never colour alone.
- **Icon sizes**: bag / equipment slot 52 px cell with a 44 px icon; Hotbar 48 px; Skill book rows 40 px; buff/charm strip in HUD 28 px. Icons are drawn on a 48-unit grid, no stroke thinner than 1.5 units (current `icons.tsx` rule).
- **Hit targets** ≥ 32 px; keyboard focus ring = 2 px brass outline offset 2 px.
- **UI scale** setting 85–130% in Settings (one CSS variable), for 1080p vs. 4K.

---

## 7. Sprite plan

**Decision: one authored SVG system, extended from `apps/client/src/hud/icons.tsx`,** not rendered model thumbnails. Reasons: the brick models turn to mush at 44 px; SVG stays crisp at every UI scale; tier and rarity can be layered in code instead of drawn 3× each; it matches the painted Skill icons already in the game. Thumbnails are used only where the model *is* the point: the Character window's centre (live `FramePreview`) and Cosmetic icons (a small render of the Frame in that paint, cached as a data URL at first open).

Layers of one item icon (all in code):

1. **Tile**: dark plate (as Skill icons) — gear icons get a square plate, Skills keep their chamfered plate, so the two read differently on the Hotbar.
2. **Glyph**: one silhouette per item **line**, steel/dark gradients from `IconDefs`.
3. **Tier trim**: an accent band on the glyph — T1 steel, T2 bronze, T3 gold, T4+ (later) adds an emissive line in the Nation colour.
4. **Rarity frame**: drawn by the slot, not the icon (so an icon is reusable in the shop list).
5. **Badges** (slot, not icon): `+N` top-right, stack count bottom-right, Charm timer bottom strip.

Icons needed (drawings, not counting tier variants):

| Group | Count | List |
| ----- | ----- | ---- |
| Primary lines | 4 (exist) | needle, flak, pulse, twin autocannon — reuse `WeaponIcon` art, add tier trim |
| Secondary lines | 4 (exist) | sting missile, seeker pod, brick bomb, mortar battery — same |
| Engine lines | 4 new | Kestrel/Falcon/Gyre jet (Wasp), Mule/Ox/Bison turbine (Anvil), Lantern/Beacon/Pharos drive (Halo), Crawler/Tread/Titan rig (Bulwark) |
| Armor lines | 4 new | one plating silhouette per Frame (light scale, riveted slab, halo ring plate, tank hull plate) |
| Radar lines | 3 new | Picket (dish), Spyglass (long horn), Brushfire (wide phased panel) |
| Charms | 6 new | coin (XP), ledger (Credits), magpie (Scrap), laurel (Glory), grudge (damage), ward (Defence) |
| Consumables | 3 (exist as Skills) | repair kit, shield kit, fuel cell — square-plate variant |
| Cosmetics | rendered | paint schemes, trails |
| Empty-slot ghosts | 9 new | armor, engine, STD, ADV, radar, cosmetic, charm (one shape), consumable, generic |
| Currency / UI | 6 new | Credits, Scrap, Glory coins; padlock; sort; close |

Total new drawings: ~36. Skill icons (41) exist and stay.

---

## 8. Implementation sessions

Session 0 lands first (contracts are orchestrator-owned and everybody imports them). Sessions 1–4 then run in parallel with disjoint files.

| # | Session | Owns (writes) | Depends | Done when |
| - | ------- | ------------- | ------- | --------- |
| 0 | **rpg-contracts** | `packages/shared/src/types.ts`, `content/{items,armors,radars,charms,cosmetics,mods}.ts` (new), `content/economy.ts`, `content/frames.ts` comment, `apps/client/src/ui/rpg/{tokens.css,Window.tsx,Slot.tsx,dnd.ts}` (UI kit skeleton: chrome, slot well, drag store), fonts | — | `pnpm typecheck` passes; old saves load; a blank Window renders. |
| 1 | **rpg-server-sim** | `apps/server/src/{economy,profiles}.ts`, `db/schema.ts` + migration, `rooms/**` handlers, `packages/shared/src/sim/{gear,skills,damage,createSim,index}.ts`, `net/sanitize.ts` | 0 | Armor/radar/charm stats felt in play (`/` dev command to grant items and charms); hotbar request moves Skills with cooldowns kept; consumables count down; charm expires on time. |
| 2 | **rpg-windows** | `apps/client/src/ui/rpg/{Character,Inventory,Vendor,Tooltip,windows}.tsx`, `rpg.css`, remove `ui/Hangar.tsx` + its Esc tab, window keys P / I / V | 0 | All three windows work against the live profile; tooltip comparison correct; drag in bag works. |
| 3 | **rpg-hotbar-skillbook** | `apps/client/src/hud/Hotbar.tsx` (extracted from `Hud.tsx`), `ui/rpg/SkillBook.tsx`, HUD charm/buff strip, `input/input.ts` (read own layout, K key, show-all-bars), pointer release on window open | 0 (uses kit `dnd.ts`) | Drag Skill book → bar → bar → off; layout survives reconnect; keys fire the right Skill. |
| 4 | **rpg-icons** | `apps/client/src/hud/icons.tsx`, new `apps/client/src/ui/rpg/itemIcons.tsx`, cosmetic thumbnail renderer | 0 | Every `ITEMS` entry and empty-slot ghost has an icon; tier trim visible; reviewed at 44 px and 28 px. |
| — | Cosmetic paint on Ship model | `apps/client/src/frames/**` | 0 | Small; can fold into 4 or run later. |

Hand-off between 2 and 3: both drop into `dnd.ts` (owned by 0, frozen API: `startDrag(payload)`, `useDropTarget(accept, onDrop)`). Session 2 renders `<ItemIcon>` / session 3 renders `<SkillIcon>` from session 4; until 4 lands they use placeholder plates.

Every session that runs the client follows the mute rule (`VITE_MUTE=1` / `?mute`).

---

## 9. Glossary additions (for CONTEXT.md, once agreed)

- **Item**: one owned piece of gear, Consumable, Charm or Cosmetic (an instance of an Item def).
- **Armor**: equipment slot setting a Frame's HP, shield and Defence. _Avoid_: hull (Ship body), plating (item name only).
- **Defence**: % of incoming damage removed, capped 30%. Separate from Deflect.
- **Radar** (item): sensor gear scaling the Frame's Primary/Secondary radar ranges.
- **Cosmetic**: visual-only slot (paint, trail).
- **Charm**: timed Pilot-wide buff item that expires in real time after activation. _Avoid_: booster (Booster is the boost engine), potion.
- **Rarity**: Standard / Tuned / Custom / Prototype / Relic; sets the number of Mods.
- **Bag**: the Pilot's 48-cell inventory grid. _Avoid_: backpack, stash.
- **Skill book**: the window listing a Frame's Skill Kit.

---

## 10. Open questions for the user

1. **Consumables finite?** Plan makes Repair/Shield Kit and Fuel Cell finite stacks (bought cheap, 20 per stack). Today they're infinite on a cooldown. Keep infinite instead?
2. **Gear swap while Docked** on a Launch Deck (not only in a City) — OK? It makes swapping weapons between Battles practical.
3. **Charm clock**: runs from activation even offline (as proposed), or only while logged in?
4. **Radar universal** (multiplies each Frame's own ranges) vs. per-Frame radar lines like armor/engine?
5. **Combat Charms** (+3–5% damage / Defence) at all, or reward Charms only (XP/Credits/Scrap/Glory) to keep PvP clean?
6. **Character key = P** (C is Land). Fine, or another key?
7. Rarity names (Standard / Tuned / Custom / Prototype / Relic) and the five colours — keep?
