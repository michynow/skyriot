import type { ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { COSMETICS, ITEMS, type EquipSlot, type ItemDefId } from '@skyriot/shared';
import { IconDefs, iconArt } from '../../hud/icons';

/** Empty-slot silhouettes: every equipment slot (charm0–2 share one), a Consumable cell, and a generic one. */
export type GhostSlot = EquipSlot | 'consumable' | 'generic';

// Windows can open where the HUD (which owns the shared gradients) is not mounted: make sure they exist.
// Ids are identical to the HUD's copy, so a duplicate is harmless.
if (typeof document !== 'undefined' && !document.getElementById('item-icon-defs')) {
  const host = document.createElement('div');
  host.id = 'item-icon-defs';
  document.body.appendChild(host);
  createRoot(host).render(<IconDefs />);
}

const INK = '#222a36';
/** Tier trim: T1 steel, T2 bronze, T3 gold (T4+ later adds an emissive line). */
const TRIM = ['#aab4c4', '#c9803c', '#f6c443'];
const trimOf = (tier: number) => TRIM[Math.min(Math.max(tier, 1), TRIM.length) - 1]!;

const S = { stroke: INK, strokeWidth: 1.5, strokeLinejoin: 'round' } as const;

/** Glyph per item line, drawn on the 48 grid inside the plate (nose/front to the right). */
const GLYPH: Record<string, ReactNode> = {
  // Engines
  'kestrel-jet': (
    <>
      <path d="M14 20h16l8 4-8 4H14z" fill="url(#g-steel)" {...S} />
      <path d="M8 18l6 2v8l-6 2z" fill="url(#g-dark)" {...S} />
      <path d="M8 24C2 22 2 26 2 24c0-2 0-2 6 0z" fill="url(#g-fire)" />
      <path d="M2 24l8-5v10z" fill="url(#g-fire)" />
      <path d="M16 22h14" stroke="#fff" strokeWidth="1.5" opacity=".7" />
    </>
  ),
  'mule-turbine': (
    <>
      <rect x="6" y="12" width="30" height="24" rx="4" fill="url(#g-dark)" {...S} />
      <circle cx="21" cy="24" r="9" fill="#0a1018" stroke="url(#g-steel)" strokeWidth="2" />
      {[0, 60, 120].map((a) => (
        <path
          key={a}
          d="M21 24L21 16"
          stroke="url(#g-steel)"
          strokeWidth="3"
          transform={`rotate(${a} 21 24)`}
        />
      ))}
      <circle cx="21" cy="24" r="2.5" fill="url(#g-gold)" />
      <path d="M36 17h6v14h-6z" fill="url(#g-steel)" {...S} />
    </>
  ),
  'lantern-drive': (
    <>
      <circle cx="24" cy="24" r="16" fill="none" stroke="url(#g-cyan)" strokeWidth="3" />
      <circle cx="24" cy="24" r="10" fill="url(#g-dark)" {...S} />
      <circle cx="24" cy="24" r="5" fill="url(#g-cyan)" />
      <circle cx="24" cy="24" r="2" fill="#fff" />
      <path d="M24 3v6M24 39v6M3 24h6M39 24h6" stroke="url(#g-steel)" strokeWidth="3" />
    </>
  ),
  'crawler-rig': (
    <>
      <rect x="5" y="28" width="38" height="12" rx="6" fill="url(#g-dark)" {...S} />
      {[12, 24, 36].map((x) => (
        <circle key={x} cx={x} cy="34" r="3" fill="url(#g-steel)" />
      ))}
      <rect x="10" y="14" width="22" height="14" fill="url(#g-steel)" {...S} />
      <rect x="14" y="6" width="5" height="8" fill="url(#g-dark)" {...S} />
      <rect x="23" y="8" width="5" height="6" fill="url(#g-dark)" {...S} />
      <path d="M32 18h8v6h-8z" fill="url(#g-fire)" />
    </>
  ),
  // Armor
  'armor-wasp': (
    <>
      <path d="M8 8h32l-2 14c-1 10-7 16-14 19C17 38 11 32 10 22z" fill="url(#g-dark)" {...S} />
      {[0, 1, 2].flatMap((r) =>
        Array.from({ length: 4 - (r === 1 ? 1 : 0) }, (_, c) => (
          <path
            key={`${r}${c}`}
            d={`M0 0h8v4a4 4 0 01-8 0z`}
            transform={`translate(${12 + c * 8 + (r === 1 ? 4 : 0)} ${12 + r * 8})`}
            fill="url(#g-steel)"
            stroke={INK}
            strokeWidth="1"
          />
        )),
      )}
    </>
  ),
  'armor-anvil': (
    <>
      <rect x="6" y="8" width="36" height="32" fill="url(#g-steel)" {...S} />
      <path d="M6 24h36M24 8v32" stroke={INK} strokeWidth="1.5" />
      {[10, 38].flatMap((x) =>
        [12, 36].map((y) => <circle key={`${x}${y}`} cx={x} cy={y} r="2" fill="url(#g-dark)" />),
      )}
      <path d="M8 10h12v12H8z" fill="#fff" opacity=".18" />
    </>
  ),
  'armor-halo': (
    <>
      <circle cx="24" cy="24" r="18" fill="none" stroke="url(#g-steel)" strokeWidth="9" />
      <circle cx="24" cy="24" r="18" fill="none" stroke={INK} strokeWidth="1.5" />
      <circle cx="24" cy="24" r="13.5" fill="none" stroke={INK} strokeWidth="1.5" />
      <path d="M24 3v8M24 37v8M3 24h8M37 24h8" stroke="url(#g-dark)" strokeWidth="4" />
      <circle cx="24" cy="24" r="4" fill="url(#g-cyan)" />
    </>
  ),
  'armor-bulwark': (
    <>
      <path d="M4 38l6-22h28l6 22z" fill="url(#g-dark)" {...S} />
      <path d="M12 16l-4 22M36 16l4 22" stroke={INK} strokeWidth="1.5" />
      <path
        d="M10 30l14-8 14 8M10 38l14-8 14 8"
        fill="none"
        stroke="url(#g-steel)"
        strokeWidth="3"
      />
      <rect x="14" y="8" width="20" height="8" fill="url(#g-steel)" {...S} />
    </>
  ),
  // Radars
  'radar-wasp': (
    <>
      <path d="M24 44V30" stroke="url(#g-dark)" strokeWidth="5" />
      <path d="M6 14c0 12 8 18 18 18s18-6 18-18C36 20 12 20 6 14z" fill="url(#g-steel)" {...S} />
      <path d="M24 24l12-14" stroke="url(#g-gold)" strokeWidth="2.5" />
      <circle cx="36" cy="10" r="3" fill="url(#g-green)" />
    </>
  ),
  'radar-anvil': (
    <>
      <rect x="8" y="34" width="32" height="8" fill="url(#g-dark)" {...S} />
      <path d="M14 34l4-22h12l4 22z" fill="url(#g-steel)" {...S} />
      <ellipse
        cx="24"
        cy="12"
        rx="6"
        ry="3"
        fill="#0a1018"
        stroke="url(#g-steel)"
        strokeWidth="2"
      />
      <path d="M24 12v22" stroke={INK} strokeWidth="1.5" />
      <circle cx="24" cy="26" r="3" fill="url(#g-green)" />
    </>
  ),
  'radar-halo': (
    <>
      <circle cx="24" cy="24" r="17" fill="none" stroke="url(#g-steel)" strokeWidth="4" />
      <circle
        cx="24"
        cy="24"
        r="8"
        fill="none"
        stroke="url(#g-cyan)"
        strokeWidth="2.5"
        opacity=".85"
      />
      {[270, 30, 150].map((a) => (
        <circle
          key={a}
          cx="24"
          cy="7"
          r="4"
          fill="url(#g-cyan)"
          stroke={INK}
          strokeWidth="1.5"
          transform={`rotate(${a + 90} 24 24)`}
        />
      ))}
      <circle cx="24" cy="24" r="2.5" fill="#fff" />
    </>
  ),
  'radar-bulwark': (
    <>
      <path d="M24 43V8" stroke="url(#g-steel)" strokeWidth="4" />
      <path
        d="M13 20h22M16 28h16M19 12h10"
        stroke="url(#g-steel)"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <path d="M8 40h32l-4-6H12z" fill="url(#g-dark)" {...S} />
      <circle cx="24" cy="6" r="3.5" fill="url(#g-red)" />
      <path
        d="M10 8a20 20 0 000 14M38 8a20 20 0 010 14"
        fill="none"
        stroke="url(#g-green)"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </>
  ),
  // Charms
  'mentors-coin': (
    <>
      <circle cx="24" cy="24" r="17" fill="url(#g-gold)" stroke="#5a3a08" strokeWidth="2" />
      <circle cx="24" cy="24" r="12" fill="none" stroke="#8a5608" strokeWidth="1.5" />
      <path
        d="M13 28l11-12 11 12M16 32h16"
        fill="none"
        stroke="#5a3a08"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  'ledger-charm': (
    <>
      <path d="M9 7h26a4 4 0 014 4v28H13a4 4 0 01-4-4z" fill="#6a3b1e" {...S} />
      <path d="M13 7v32" stroke="#2a140a" strokeWidth="3" />
      <rect x="18" y="12" width="17" height="6" fill="url(#g-gold)" />
      <path
        d="M18 24h17M18 29h17M18 34h11"
        stroke="#e8d7a8"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </>
  ),
  'magpie-charm': (
    <>
      <path
        d="M6 30c2-10 10-16 20-14l8-5-2 8c4 3 6 8 4 14l-4-4-8 8-4-8-10 5z"
        fill="url(#g-dark)"
        {...S}
      />
      <path d="M20 24c4-2 8 0 10 4-5 2-9 1-12-1z" fill="#eef3fa" />
      <path d="M34 11l8 3-8 3z" fill="url(#g-gold)" stroke="#5a3a08" strokeWidth="1" />
      <circle cx="31" cy="16" r="1.6" fill="#fff" />
      <path d="M8 34l-4 8h8" fill="url(#g-cyan)" opacity=".9" />
    </>
  ),
  'laurel-charm': (
    <>
      <path
        d="M24 42C10 40 6 28 8 14c6 2 8 8 8 14M24 42c14-2 18-14 16-28-6 2-8 8-8 14"
        fill="none"
        stroke="url(#g-green)"
        strokeWidth="5"
        strokeLinecap="round"
      />
      {[
        [10, 20],
        [11, 30],
        [16, 38],
        [38, 20],
        [37, 30],
        [32, 38],
      ].map(([x, y]) => (
        <circle
          key={`${x}${y}`}
          cx={x}
          cy={y}
          r="3"
          fill="url(#g-green)"
          stroke="#17803a"
          strokeWidth="1"
        />
      ))}
      <polygon
        points="24,12 27,19 34,19 28,24 30,31 24,27 18,31 20,24 14,19 21,19"
        fill="url(#g-gold)"
        stroke="#5a3a08"
        strokeWidth="1"
      />
    </>
  ),
  'grudge-charm': (
    <>
      <path
        d="M24 6c11 0 16 8 14 18-1 6-4 8-4 14H14c0-6-3-8-4-14C8 14 13 6 24 6z"
        fill="#e9e4d8"
        {...S}
      />
      <path
        d="M15 22l8 4-8 3zM33 22l-8 4 8 3z"
        fill="url(#g-red)"
        stroke="#4a0a10"
        strokeWidth="1"
      />
      <path d="M24 30v4M19 38v-4M29 38v-4" stroke={INK} strokeWidth="2" strokeLinecap="round" />
    </>
  ),
  'ward-charm': (
    <>
      <path d="M24 4l16 6v12c0 11-7 18-16 22C15 40 8 33 8 22V10z" fill="url(#g-blue)" {...S} />
      <path d="M24 4v40C15 40 8 33 8 22V10z" fill="#000" opacity=".18" />
      <path
        d="M24 12l8 3v7c0 6-4 10-8 12-4-2-8-6-8-12v-7z"
        fill="none"
        stroke="#e6f4ff"
        strokeWidth="2"
      />
    </>
  ),
};

/** Fallback so a def with no art is still visible rather than blank. */
const UNKNOWN = <path d="M24 10l12 14-12 14-12-14z" fill="url(#g-dark)" {...S} />;

/** Cosmetic: a Ship silhouette in the paint colour with its trail streaming behind. */
function CosmeticArt({ paint, trail }: { paint: string; trail: string }) {
  return (
    <>
      <path
        d="M12 38L22 24M24 40V28M36 38L26 24"
        stroke={trail}
        strokeWidth="3"
        strokeLinecap="round"
        opacity=".9"
      />
      <g transform="translate(24 21) scale(1.35)">
        <path
          d="M0-13L4-3 14 5v4L4 6 3 13 0 11-3 13-4 6-14 9V5L-4-3z"
          fill={paint}
          stroke={INK}
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
        <path d="M0-12L2-3H-2z" fill="#fff" opacity=".55" />
      </g>
    </>
  );
}

function Pips({ tier }: { tier: number }) {
  return (
    <>
      {Array.from({ length: Math.min(tier, 3) }, (_, i) => (
        <rect
          key={i}
          x={5 + i * 5}
          y="5"
          width="3.5"
          height="3.5"
          fill={trimOf(tier)}
          stroke="#000"
          strokeWidth=".8"
        />
      ))}
    </>
  );
}

/** Item icon on a 48-unit grid (rpg-ui.md §7): square plate, glyph, tier trim (band + pips). */
export function ItemIcon({ def, tier }: { def: ItemDefId; tier?: number }) {
  const d = ITEMS[def];
  const t = tier ?? d?.tier ?? 1;
  const cos = COSMETICS[def];
  let art: ReactNode;
  if (cos) art = <CosmeticArt paint={cos.paint} trail={cos.trail} />;
  else if (d?.kind === 'weapon' || d?.kind === 'consumable') {
    // existing painted art is full-bleed: shrink into the plate
    art = <g transform="translate(5 5) scale(.79)">{iconArt(d.icon ?? def) ?? UNKNOWN}</g>;
  } else art = (d?.icon && GLYPH[d.icon]) || UNKNOWN;
  const trimmed = d?.kind !== 'cosmetic' && d?.kind !== 'consumable' && d?.kind !== 'charm';
  return (
    <svg viewBox="0 0 48 48" data-def={def} data-tier={t} aria-hidden>
      <rect
        x="1"
        y="1"
        width="46"
        height="46"
        fill="url(#i-tile)"
        stroke="#000"
        strokeWidth="1.5"
      />
      <g style={{ filter: 'drop-shadow(0 1px 1px #000c)' }}>
        <g transform="translate(24 23) scale(.84) translate(-24 -24)">{art}</g>
      </g>
      {trimmed && (
        <>
          <rect x="1" y="42" width="46" height="5" fill={trimOf(t)} />
          <path d="M1 42h46" stroke="#000" strokeOpacity=".5" />
          <Pips tier={t} />
        </>
      )}
    </svg>
  );
}

/** Empty-slot silhouettes: outline only, drawn in currentColor so the cell tints them. */
const CHARM_GHOST = <path d="M24 10l11 7v11l-11 8-11-8V17zM24 10v26M13 17l22 11M35 17L13 28" />;
const GHOST: Record<GhostSlot, ReactNode> = {
  armor: <path d="M12 12h24l-2 12c-1 8-6 12-10 14-4-2-9-6-10-14z" />,
  engine: <path d="M12 18h16l8 6-8 6H12zM12 18v12M6 21l6 3-6 3" />,
  primary: <path d="M8 21h20l6 3-6 3H8zM14 17h8v4M36 24h4" />,
  secondary: <path d="M14 19h16l8 5-8 5H14zM14 19l-6-5v10M14 29l-6 5V24" />,
  radar: <path d="M12 16c0 9 5 13 12 13s12-4 12-13c-5 4-19 4-24 0zM24 29v8M18 37h12" />,
  cosmetic: <path d="M24 10c6 8 10 12 10 17a10 10 0 01-20 0c0-5 4-9 10-17zM19 28a5 5 0 005 5" />,
  charm0: CHARM_GHOST,
  charm1: CHARM_GHOST,
  charm2: CHARM_GHOST,
  consumable: <path d="M19 10h10M21 10v8l-8 14a4 4 0 003 6h16a4 4 0 003-6l-8-14v-8M16 30h16" />,
  generic: <path d="M24 11l13 13-13 13-13-13z" />,
};

/** Faint silhouette shown in an empty Slot. */
export function SlotGhost({ slot }: { slot: GhostSlot }) {
  return (
    <svg className="rpg-ghost" viewBox="0 0 48 48" data-slot={slot} aria-hidden>
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      >
        {GHOST[slot]}
      </g>
    </svg>
  );
}
