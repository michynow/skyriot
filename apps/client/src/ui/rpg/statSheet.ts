import {
  ARMORS,
  CHARMS,
  ENGINES,
  FRAMES,
  GEAR_SLOTS,
  ITEMS,
  RADARS,
  SKILLS,
  STOCK_ARMOR,
  STOCK_RADAR,
  WEAPONS,
  fitsSlot,
  resolveGear,
  upgradeMul,
  type FrameId,
  type GearSlot,
  type ItemInstance,
  type ShipGear,
} from '@skyriot/shared';

/** One numeric stat row. `low` = smaller is better (reattack time, fuel burn). */
export interface Line {
  key: string;
  label: string;
  value: number;
  unit: string;
  dec: number;
  low?: boolean;
}
export interface StatGroup {
  title: string;
  rows: Line[];
}

const L = (key: string, label: string, value: number, unit = '', dec = 0, low = false): Line => ({
  key,
  label,
  value,
  unit,
  dec,
  low,
});

/** Radar upgrade rate is half the weapon/engine rate (rpg-ui.md §2). */
const radarMul = (upgrade: number) => 1 + 0.015 * upgrade;

export function fmt(v: number, dec = 0): string {
  return v.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}
export const withUnit = (l: Pick<Line, 'value' | 'unit' | 'dec'>) =>
  fmt(l.value, l.dec) + (!l.unit ? '' : /^[%°/]/.test(l.unit) ? l.unit : ` ${l.unit}`);

// ---------- per-item stat lines (tooltip rows) ----------

/** Stat rows an item shows, upgrade applied. Same maths the sheet uses, so deltas agree with it. */
export function itemLines(item: Pick<ItemInstance, 'def' | 'upgrade'>): Line[] {
  const m = upgradeMul(item.upgrade);
  const w = WEAPONS[item.def];
  if (w) {
    const dmg = w.damage * m;
    const salvo = w.pattern.count * w.pattern.series;
    const rows = [L('dmg', 'Damage', dmg, '', 0)];
    if (w.pattern.series > 1 || w.pattern.count > 1)
      rows.push(L('salvo', 'Per trigger', dmg * salvo, '', 0));
    rows.push(
      L('dps', 'Damage / s', (dmg * w.pattern.count) / w.fireIntervalSec, '', 0),
      L('reattack', 'Reattack', w.fireIntervalSec, 's', 1, true),
    );
    if (w.inductionDegPerSec > 0)
      rows.push(L('induction', 'Induction rate', w.inductionDegPerSec, '°/s'));
    if (w.validAngleDeg > 0) rows.push(L('valid', 'Valid Angle', w.validAngleDeg, '°', 1));
    rows.push(L('pspeed', 'Projectile speed', w.speed, 'm/s'), L('range', 'Range', w.rangeM, 'm'));
    return rows;
  }
  const e = ENGINES[item.def];
  if (e)
    return [
      L('max', 'Max speed', e.maxSpeed * m, 'm/s'),
      L('boost', 'Boost speed', e.boostSpeed * m, 'm/s'),
      L('min', 'Min speed', e.minSpeed * m, 'm/s'),
      L('turn', 'Turn rate', (e.turnRate * 180) / Math.PI, '°/s'),
    ];
  const a = ARMORS[item.def];
  if (a)
    return [
      L('hp', 'Hit points', a.maxHp * m, ''),
      L('shield', 'Shield', a.maxShield * m, ''),
      L('regen', 'Shield regen', a.shieldRegenPerSec, '/s'),
      L('defence', 'Defence', a.defence * 100, '%', 1),
    ];
  const r = RADARS[item.def];
  if (r) {
    const rm = radarMul(item.upgrade);
    return [
      L('std', 'STD radar', r.radarStdM * rm, 'm'),
      L('adv', 'ADV radar', r.radarAdvM * rm, 'm'),
      L('range', 'Radar range', r.radarRangeM * rm, 'm'),
    ];
  }
  return [];
}

/** The one number a verdict compares, per slot. */
function headline(slot: GearSlot, item: Pick<ItemInstance, 'def' | 'upgrade'>): number {
  const rows = itemLines(item);
  const get = (k: string) => rows.find((r) => r.key === k)?.value ?? 0;
  switch (slot) {
    case 'primary':
      return get('dps');
    case 'secondary':
      return get('salvo') || get('dmg');
    case 'engine':
      return get('max') + get('boost');
    case 'armor':
      return get('hp') + get('shield');
    case 'radar':
      return get('range');
    default:
      return 0;
  }
}

/** Slot of `frame` an item goes in (null = not gear for that Frame). Charms use 'charm'. */
export function slotFor(frame: FrameId, def: string): GearSlot | 'charm' | null {
  if (CHARMS[def]) return 'charm';
  return GEAR_SLOTS.find((s) => fitsSlot(frame, s, def)) ?? null;
}

const stockDef = (frame: FrameId, slot: GearSlot): string | null => {
  const f = FRAMES[frame];
  switch (slot) {
    case 'primary':
      return f.primary;
    case 'secondary':
      return f.secondary;
    case 'engine':
      return f.engine;
    case 'armor':
      return STOCK_ARMOR[frame] ?? null;
    case 'radar':
      return STOCK_RADAR[frame] ?? null;
    default:
      return null;
  }
};

export interface Comparison {
  slot: GearSlot;
  /** What it is compared with: the equipped item, else the stock part. */
  vs: { name: string; upgrade: number; stock: boolean };
  rows: { line: Line; delta: number | null }[];
  verdict: 'Upgrade' | 'Sidegrade' | 'Downgrade' | 'Equipped';
}

/** Compare `item` against what the shown Frame has in its slot. null when it doesn't fit (or has no stats). */
export function compare(
  item: Pick<ItemInstance, 'id' | 'def' | 'upgrade'>,
  frame: FrameId,
  gear: ShipGear,
): Comparison | null {
  const slot = slotFor(frame, item.def);
  if (!slot || slot === 'charm' || slot === 'cosmetic') return null;
  const equipped = gear[slot];
  let base: Pick<ItemInstance, 'def' | 'upgrade'> | null = equipped ?? null;
  let stock = false;
  if (!base) {
    const d = stockDef(frame, slot);
    if (d) {
      base = { def: d, upgrade: 0 };
      stock = true;
    }
  }
  if (!base) return null;
  const baseRows = new Map(itemLines(base).map((l) => [l.key, l]));
  const rows = itemLines(item).map((line) => {
    const b = baseRows.get(line.key);
    return { line, delta: b ? line.value - b.value : null };
  });
  const h = headline(slot, item);
  const hb = headline(slot, base);
  const pct = hb ? (h - hb) / hb : 0;
  const same = equipped?.id === item.id;
  return {
    slot,
    vs: { name: ITEMS[base.def]?.name ?? base.def, upgrade: base.upgrade, stock },
    rows,
    verdict: same ? 'Equipped' : pct > 0.005 ? 'Upgrade' : pct < -0.005 ? 'Downgrade' : 'Sidegrade',
  };
}

/** Plain-text effect lines of a Charm. */
export function charmLines(def: string): string[] {
  const e = CHARMS[def]?.effect;
  if (!e) return [];
  const out: string[] = [];
  if (e.xpPct) out.push(`+${e.xpPct}% XP`);
  if (e.creditsPct) out.push(`+${e.creditsPct}% Credits`);
  if (e.scrapPct) out.push(`+${e.scrapPct}% Scrap`);
  if (e.gloryPct) out.push(`+${e.gloryPct}% Glory`);
  if (e.primaryDamagePct) out.push(`+${e.primaryDamagePct}% Primary damage`);
  if (e.secondaryDamagePct) out.push(`+${e.secondaryDamagePct}% Secondary damage`);
  if (e.defenceAdd) out.push(`+${Math.round(e.defenceAdd * 100)}% Defence`);
  return out;
}

export const consumableText = (def: string): string => SKILLS[def]?.description ?? '';

export function timeLeft(ms: number): string {
  const min = Math.ceil(ms / 60000);
  const h = Math.floor(min / 60);
  return h ? `${h} h ${String(min % 60).padStart(2, '0')} m` : `${min} m`;
}

// ---------- the Frame's stat sheet ----------

/**
 * Resolved numbers for `frame` wearing `gear` (Character window). Armor and radar are laid on here when
 * `resolveGear` hasn't (it learns them in the sim session); once it does, its values win.
 */
export function statSheet(frame: FrameId, gear: ShipGear): StatGroup[] {
  const r = resolveGear(frame, gear);
  const f = { ...FRAMES[frame], ...r.over };
  const armor = gear.armor && ARMORS[gear.armor.def];
  if (armor && r.over.maxHp === undefined) {
    const m = upgradeMul(gear.armor!.upgrade);
    f.maxHp = armor.maxHp * m;
    f.maxShield = armor.maxShield * m;
    f.shieldRegenPerSec = armor.shieldRegenPerSec;
    f.defence = armor.defence;
  }
  const radar = gear.radar && RADARS[gear.radar.def];
  if (radar && r.over.radarRangeM === undefined) {
    const m = radarMul(gear.radar!.upgrade);
    f.radarStdM = radar.radarStdM * m;
    f.radarAdvM = radar.radarAdvM * m;
    f.radarRangeM = radar.radarRangeM * m;
  }
  const [std, adv] = r.weapons;
  return [
    {
      title: 'Hull',
      rows: [
        L('hp', 'Hit points', f.maxHp),
        L('shield', 'Shield', f.maxShield),
        L('regen', 'Shield regen', f.shieldRegenPerSec, '/s'),
        L('defence', 'Defence', (f.defence ?? 0) * 100, '%', 1),
        L('deflect', 'Deflect', f.deflectChance * 100, '%', 1),
      ],
    },
    {
      title: 'Flight',
      rows: [
        L('max', 'Max speed', f.maxSpeed, 'm/s'),
        L('boost', 'Boost', f.boostSpeed, 'm/s'),
        L('min', 'Min speed', f.minSpeed, 'm/s'),
        L('turn', 'Turn rate', (f.turnRate * 180) / Math.PI, '°/s'),
      ],
    },
    {
      title: 'Arms',
      rows: [
        L('stdDmg', 'STD damage', std.damage),
        L('stdDps', 'STD damage / s', (std.damage * std.pattern.count) / std.fireIntervalSec),
        L('advDmg', 'ADV damage', adv.damage),
        L('advSalvo', 'ADV per salvo', adv.damage * adv.pattern.count * adv.pattern.series),
        L('valid', 'Valid Angle', adv.validAngleDeg, '°', 1),
      ],
    },
    {
      title: 'Sensors',
      rows: [
        L('stdRadar', 'STD radar', f.radarStdM, 'm'),
        L('advRadar', 'ADV radar', f.radarAdvM, 'm'),
        L('radar', 'Radar range', f.radarRangeM, 'm'),
      ],
    },
  ];
}
