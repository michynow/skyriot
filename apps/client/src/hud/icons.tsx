import type { ReactElement } from 'react';

/** Original Skill / Consumable icons. 48x48 viewBox, drawn with currentColor + a bright accent. */
const A = 'var(--accent, #7fe7ff)';
const sw = { fill: 'none', stroke: 'currentColor', strokeWidth: 3.5, strokeLinejoin: 'round', strokeLinecap: 'round' } as const;

const ICONS: Record<string, ReactElement> = {
  flares: (
    <>
      <path {...sw} d="M24 6v10M10 14l7 7M38 14l-7 7M6 28h10M32 28h10" />
      <path d="M24 22l5 7-5 13-5-13z" fill={A} />
      <path {...sw} d="M17 40l-4 4M31 40l4 4" />
    </>
  ),
  'afterburn-dash': (
    <>
      <path d="M6 24L24 8l-5 12h13L14 40l6-14H6z" fill="currentColor" />
      <path {...sw} stroke={A} d="M30 12l12-4M34 22h8M30 32l10 5" />
    </>
  ),
  'ghost-skin': (
    <>
      <path {...sw} d="M10 42V22a14 14 0 0128 0v20l-5-5-5 5-4-5-4 5-5-5z" />
      <circle cx="19" cy="23" r="3" fill={A} />
      <circle cx="29" cy="23" r="3" fill={A} />
    </>
  ),
  'carpet-drop': (
    <>
      <path {...sw} d="M4 12h40" />
      {[10, 24, 38].map((x) => (
        <g key={x}>
          <path d={`M${x - 4} 20h8v10l-4 6-4-6z`} fill="currentColor" />
          <path {...sw} stroke={A} d={`M${x} 40v5`} />
        </g>
      ))}
    </>
  ),
  'iron-hide': (
    <>
      <path d="M24 4l16 6v12c0 10-7 17-16 22C15 39 8 32 8 22V10z" fill="currentColor" />
      <path {...sw} stroke={A} d="M16 20h16M16 28h16M24 12v26" />
    </>
  ),
  'mend-beam': (
    <>
      <path d="M18 8h12v10h10v12H30v10H18V30H8V18h10z" fill="currentColor" />
      <path {...sw} stroke={A} d="M4 44L16 32M44 44L32 32" />
    </>
  ),
  'aegis-bubble': (
    <>
      <circle cx="24" cy="24" r="18" {...sw} strokeDasharray="6 4" />
      <circle cx="24" cy="24" r="10" fill="currentColor" />
      <path {...sw} stroke={A} d="M24 6v6M24 36v6M6 24h6M36 24h6" />
    </>
  ),
  'siege-anchor': (
    <>
      <circle cx="24" cy="10" r="5" {...sw} />
      <path {...sw} d="M24 15v28M14 24h20M8 32c0 8 8 11 16 11s16-3 16-11" />
      <path {...sw} stroke={A} d="M6 44h36" />
    </>
  ),
  'scrap-wall': (
    <>
      <path d="M4 10h18v10H4zM26 10h18v10H26zM4 26h10v10H4zM18 26h12v10H18zM34 26h10v10H34z" fill="currentColor" />
      <path {...sw} stroke={A} d="M4 42h40" />
    </>
  ),
  'repair-kit': (
    <>
      <rect x="6" y="12" width="36" height="28" rx="4" fill="currentColor" />
      <path {...sw} d="M17 12V8h14v4" />
      <path d="M21 18h6v6h6v6h-6v6h-6v-6h-6v-6h6z" fill={A} transform="translate(0 -2) scale(1)" />
    </>
  ),
  'shield-kit': (
    <>
      <path d="M24 5l15 6v11c0 9-6 16-15 21C15 38 9 31 9 22V11z" fill="currentColor" />
      <path d="M26 12l-8 14h6l-2 10 9-15h-6z" fill={A} />
    </>
  ),
  'fuel-cell': (
    <>
      <rect x="12" y="10" width="24" height="32" rx="4" fill="currentColor" />
      <path {...sw} d="M18 10V5h12v5" />
      <path d="M26 16l-8 12h5l-2 8 8-12h-5z" fill={A} />
    </>
  ),
};

export function SkillIcon({ id }: { id: string }) {
  return (
    <svg viewBox="0 0 48 48" className="skill-icon" aria-hidden>
      {ICONS[id] ?? <circle cx="24" cy="24" r="10" fill="currentColor" />}
    </svg>
  );
}

const WEAPON_ICONS: Record<string, ReactElement> = {
  // tracer gun: long barrel with rounds
  'needle-cannon': (
    <>
      <path d="M4 20h30l6 4-6 4H4z" fill="currentColor" />
      <path {...sw} stroke={A} d="M38 12l8-2M38 36l8 2M42 24h4" />
    </>
  ),
  // flak: wide burst with shrapnel
  'flak-repeater': (
    <>
      <path d="M4 26h16v8H4z" fill="currentColor" />
      <circle cx="32" cy="24" r="6" fill={A} />
      <path {...sw} d="M32 8v8M32 32v8M16 24h8M40 12l-5 5M40 36l-5-5M24 12l5 5" />
    </>
  ),
  // pulse blaster: energy bolts
  'pulse-blaster': (
    <>
      <path d="M4 20h12v8H4z" fill="currentColor" />
      <circle cx="26" cy="24" r="4" fill={A} />
      <circle cx="38" cy="24" r="3" fill={A} opacity=".7" />
      <circle cx="46" cy="24" r="2" fill={A} opacity=".4" />
    </>
  ),
  // twin autocannon: two barrels
  'twin-autocannon': (
    <>
      <path d="M4 14h30l6 3-6 3H4zM4 28h30l6 3-6 3H4z" fill="currentColor" />
      <path {...sw} stroke={A} d="M42 17h4M42 31h4" />
    </>
  ),
  // missile: tapered body with fins and flame
  'sting-missile': (
    <>
      <path d="M44 24L30 17H12v14h18z" fill="currentColor" />
      <path d="M12 17L5 10v8zM12 31l-7 7v-8z" fill="currentColor" />
      <path d="M12 24H3" {...sw} stroke={A} />
    </>
  ),
  // seeker pod: tube cluster
  'seeker-pod': (
    <>
      <rect x="6" y="8" width="36" height="32" rx="4" fill="currentColor" />
      {[16, 32].flatMap((x) => [16, 32].map((y) => <circle key={`${x}${y}`} cx={x} cy={y} r="4.5" fill="#06121f" stroke={A} strokeWidth="2" />))}
    </>
  ),
  // bomb: teardrop with fins
  'brick-bomb': (
    <>
      <ellipse cx="24" cy="28" rx="11" ry="14" fill="currentColor" />
      <path d="M17 12h14l-3 6H20z" fill={A} />
      <path {...sw} d="M24 4v6" />
    </>
  ),
  // mortar: angled tube with arcing shell
  'mortar-battery': (
    <>
      <path d="M8 40l10-18 8 5-6 13z" fill="currentColor" />
      <path {...sw} d="M4 42h20" />
      <path {...sw} stroke={A} strokeDasharray="3 5" d="M24 20Q34 4 44 28" />
      <circle cx="44" cy="30" r="3.5" fill={A} />
    </>
  ),
};

export function WeaponIcon({ id }: { id: string }) {
  return (
    <svg viewBox="0 0 48 48" className="wpn-icon" aria-hidden>
      {WEAPON_ICONS[id] ?? <circle cx="24" cy="24" r="8" fill="currentColor" />}
    </svg>
  );
}
