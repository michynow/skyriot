import type { ReactElement, ReactNode } from 'react';

/*
 * Original, painted-style icons: layered SVG with shared gradients (see IconDefs), a category backdrop
 * (offense red / defense blue / support green / utility gold), highlights, rim light and a drop shadow.
 */

/** Render once (hidden) so every icon can reference the shared gradients by id. */
export function IconDefs() {
  const lin = (id: string, stops: [number, string][], vertical = true) => (
    <linearGradient id={id} x1="0" y1="0" x2={vertical ? 0 : 1} y2={vertical ? 1 : 0}>
      {stops.map(([o, c]) => (
        <stop key={o} offset={o} stopColor={c} />
      ))}
    </linearGradient>
  );
  const rad = (id: string, stops: [number, string][]) => (
    <radialGradient id={id} cx="50%" cy="35%" r="80%">
      {stops.map(([o, c]) => (
        <stop key={o} offset={o} stopColor={c} />
      ))}
    </radialGradient>
  );
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden>
      <defs>
        {lin('g-steel', [
          [0, '#f2f6fb'],
          [0.45, '#97a4b5'],
          [1, '#3a4455'],
        ])}
        {lin('g-dark', [
          [0, '#8794a6'],
          [1, '#222a36'],
        ])}
        {lin('g-gold', [
          [0, '#fff6c0'],
          [0.5, '#f4b92c'],
          [1, '#8a5608'],
        ])}
        {lin('g-fire', [
          [0, '#fff8b8'],
          [0.4, '#ffa11f'],
          [1, '#e1301a'],
        ])}
        {lin('g-blue', [
          [0, '#c8f0ff'],
          [0.5, '#3da6ff'],
          [1, '#1a47a6'],
        ])}
        {lin('g-cyan', [
          [0, '#f0ffff'],
          [0.5, '#5ff0ff'],
          [1, '#1b8fb0'],
        ])}
        {lin('g-green', [
          [0, '#e0ffd8'],
          [0.5, '#4cf06a'],
          [1, '#17803a'],
        ])}
        {lin('g-red', [
          [0, '#ffc2b0'],
          [0.5, '#ff4a3a'],
          [1, '#85120e'],
        ])}
        {lin('g-magenta', [
          [0, '#ffffff'],
          [0.5, '#ff6ad5'],
          [1, '#86197a'],
        ])}
        {lin('g-yellow', [
          [0, '#ffffe0'],
          [0.5, '#ffd83a'],
          [1, '#d07f08'],
        ])}
        {lin('g-rust', [
          [0, '#d9946a'],
          [1, '#6a3a22'],
        ])}
        {rad('bg-red', [
          [0, '#8a2424'],
          [1, '#2a0a0e'],
        ])}
        {rad('bg-blue', [
          [0, '#2a5fa6'],
          [1, '#09162e'],
        ])}
        {rad('bg-green', [
          [0, '#26894e'],
          [1, '#082a18'],
        ])}
        {rad('bg-violet', [
          [0, '#6a3aa6'],
          [1, '#1a0a30'],
        ])}
        {rad('bg-gold', [
          [0, '#9a7620'],
          [1, '#2a1c06'],
        ])}
        {lin('i-red', [
          [0, '#ffb08a'],
          [0.5, '#ff6a3d'],
          [1, '#c8301c'],
        ])}
        {lin('i-blue', [
          [0, '#d8f8ff'],
          [0.5, '#5fe3ff'],
          [1, '#1f8fc0'],
        ])}
        {lin('i-green', [
          [0, '#e0ffe8'],
          [0.5, '#6fffa0'],
          [1, '#1f9a55'],
        ])}
        {lin('i-gold', [
          [0, '#fff1bd'],
          [0.5, '#f2c24b'],
          [1, '#b47a12'],
        ])}
        {lin('i-violet', [
          [0, '#ecd8ff'],
          [0.5, '#c28aff'],
          [1, '#6f3fc0'],
        ])}
        {rad('i-tile', [
          [0, '#17283e'],
          [1, '#06101a'],
        ])}
      </defs>
    </svg>
  );
}

/** red = attack, blue = defence, green = support, gold = movement. */
type Category = 'red' | 'blue' | 'green' | 'gold';
const star = (cx: number, cy: number, r1: number, r2: number, n: number) =>
  Array.from({ length: n * 2 }, (_, i) => {
    const a = (i * Math.PI) / n - Math.PI / 2;
    const r = i % 2 ? r2 : r1;
    return `${(cx + Math.cos(a) * r).toFixed(1)},${(cy + Math.sin(a) * r).toFixed(1)}`;
  }).join(' ');

/*
 * Skill glyphs: one bold silhouette per ability in the category colour, white for the "hot" part, dark
 * cut-outs for depth. Drawn for 44-58 px slots, so no detail thinner than ~1.5 units.
 */
const INK = '#06101a';
const WHITE = '#ffffff';
const G: Record<Category, string> = {
  red: 'url(#i-red)',
  blue: 'url(#i-blue)',
  green: 'url(#i-green)',
  gold: 'url(#i-gold)',
};

/** Heater shield outline, 48-unit tile. */
const shieldPath = 'M24 4l16 6v12c0 11-7 18-16 22C15 40 8 33 8 22V10z';
const shipPath = 'M0-13L4-3 14 5v4L4 6 3 13 0 11-3 13-4 6-14 9V5L-4-3z';
const ship = (x: number, y: number, k: number, fill: string, o = 1): ReactElement => (
  <path
    key={`${x}${y}`}
    transform={`translate(${x} ${y}) scale(${k})`}
    d={shipPath}
    fill={fill}
    opacity={o}
    strokeLinejoin="round"
  />
);
const bomb = (x: number, y: number, k: number, fill: string): ReactElement => (
  <g key={`${x}${y}`} transform={`translate(${x} ${y}) scale(${k})`}>
    <path d="M-5 -4h10v9c0 4-2 7-5 7s-5-3-5-7z" fill={fill} />
    <path d="M-5 -4l-4-4v6zM5 -4l4-4v6z" fill={fill} opacity=".7" />
    <path d="M-2 -8h4v4h-4z" fill={WHITE} />
  </g>
);
const rocket = (angle: number, fill: string): ReactElement => (
  <g key={angle} transform={`rotate(${angle} 24 40)`}>
    <path d="M21 40c0 5 6 5 6 0l-3-6z" fill={WHITE} opacity=".9" />
    <path d="M20 22h8v15h-8z" fill={fill} />
    <path d="M20 22l4-9 4 9z" fill={WHITE} />
    <path d="M20 33l-4 5v-6zM28 33l4 5v-6z" fill={fill} opacity=".7" />
  </g>
);

const SKILL: Record<string, { cat: Category; art: ReactNode }> = {
  'afterburn-dash': {
    cat: 'gold',
    art: (
      <>
        <path
          d="M6 18h10M4 24h8M6 30h10"
          stroke={G.gold}
          strokeWidth="3"
          strokeLinecap="round"
          opacity=".7"
        />
        <path d="M18 10l20 14-20 14 6-14z" fill={G.gold} />
        <path d="M18 10l20 14H27z" fill={WHITE} opacity=".55" />
        <path d="M40 24l6 0" stroke={WHITE} strokeWidth="3" strokeLinecap="round" />
      </>
    ),
  },
  'siege-anchor': {
    cat: 'red',
    art: (
      <>
        <path d="M6 40h36v4H6z" fill={G.red} />
        <path d="M24 40L15 26h18z" fill={G.red} />
        <path d="M20 26V12h8v14z" fill={G.red} />
        <path d="M20 12l-8-6h24l-8 6z" fill={WHITE} opacity=".9" />
        <circle cx="24" cy="19" r="2.5" fill={INK} />
      </>
    ),
  },
  'air-siege': {
    cat: 'red',
    art: (
      <>
        <path d="M8 30h32M12 36h24" stroke={G.red} strokeWidth="3" strokeLinecap="round" />
        <path d="M24 26L15 12h18z" fill={G.red} />
        <path d="M20 12V6h8v6z" fill={WHITE} opacity=".9" />
        <circle cx="24" cy="17" r="2.5" fill={INK} />
      </>
    ),
  },
  'repair-kit': {
    cat: 'green',
    art: (
      <>
        <path d="M8 40l16-16" stroke={G.green} strokeWidth="6" strokeLinecap="round" />
        <path d="M30 6a9 9 0 0 1 9 11l-5 4-5-5 4-5a9 9 0 0 0-3-5z" fill={G.green} />
        <path
          d="M28 10a9 9 0 0 0-5 10"
          fill="none"
          stroke={WHITE}
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path d="M7 41l6-6" stroke={WHITE} strokeWidth="2" strokeLinecap="round" />
        <path d="M33 30h6v5h5v6h-5v5h-6v-5h-5v-6h5z" fill={WHITE} />
      </>
    ),
  },
  'shield-kit': {
    cat: 'blue',
    art: (
      <>
        <rect x="14" y="10" width="20" height="32" rx="4" fill={G.blue} />
        <rect x="18" y="4" width="12" height="7" rx="1.5" fill={WHITE} />
        <path d="M24 16l7 3v6c0 5-3 8-7 10-4-2-7-5-7-10v-6z" fill={INK} />
        <path d="M24 20l4 1.5v4c0 3-2 5-4 6-2-1-4-3-4-6v-4z" fill={WHITE} />
      </>
    ),
  },
  'pivot-flip': {
    cat: 'gold',
    art: (
      <>
        {/* U-turn arc with the arrowhead coming back the other way */}
        <path
          d="M14 40V20a10 10 0 0 1 20 0v10"
          fill="none"
          stroke={G.gold}
          strokeWidth="6"
          strokeLinecap="round"
        />
        <path d="M26 28h16l-8 12z" fill={WHITE} />
        <circle cx="14" cy="40" r="3" fill={WHITE} />
      </>
    ),
  },
  backdraft: {
    cat: 'gold',
    art: (
      <>
        {/* Ship pointing up, chevrons streaming backwards beneath it */}
        <path d="M24 6l9 14H15z" fill={WHITE} />
        <path
          d="M14 26l10 7 10-7M14 34l10 7 10-7"
          fill="none"
          stroke={G.gold}
          strokeWidth="4"
          strokeLinejoin="round"
        />
      </>
    ),
  },
  'fuel-cell': {
    cat: 'gold',
    art: (
      <>
        <rect x="12" y="12" width="24" height="30" rx="5" fill={G.gold} />
        <rect x="18" y="5" width="12" height="8" rx="1.5" fill={WHITE} />
        <path d="M24 18c5 6 7 9 7 13a7 7 0 0 1-14 0c0-4 2-7 7-13z" fill={INK} />
        <path d="M24 25c2.5 3 3.5 5 3.5 7a3.5 3.5 0 0 1-7 0c0-2 1-4 3.5-7z" fill={WHITE} />
      </>
    ),
  },
  'air-barrage-mode': {
    cat: 'red',
    art: <>{[rocket(-28, G.red), rocket(0, G.red), rocket(28, G.red)]}</>,
  },
  'ground-strike-mode': {
    cat: 'red',
    art: (
      <>
        {bomb(24, 16, 1.7, G.red)}
        <path d="M4 44c5-8 8-8 12-2 4-7 8-7 12 0 4-6 8-6 12 2v2H4z" fill={WHITE} opacity=".85" />
      </>
    ),
  },
  'wide-lock-mode': {
    cat: 'red',
    art: (
      <>
        {/* Wide lock cone from the nose, three enemy Ships bracketed inside it */}
        <path d="M24 44L3 10a30 30 0 0 1 42 0z" fill={G.red} opacity=".35" />
        <path
          d="M24 44L3 10M24 44L45 10M3 10a30 30 0 0 1 42 0"
          fill="none"
          stroke={G.red}
          strokeWidth="3"
          strokeLinejoin="round"
        />
        {[ship(12, 17, 0.42, WHITE), ship(24, 12, 0.42, WHITE), ship(36, 17, 0.42, WHITE)]}
        <path d="M24 44l-4-8h8z" fill={WHITE} />
      </>
    ),
  },
  'rally-field': {
    cat: 'green',
    art: (
      <>
        <ellipse cx="24" cy="40" rx="17" ry="4" fill="none" stroke={G.green} strokeWidth="2.5" />
        <path d="M14 42V6" stroke={WHITE} strokeWidth="3" strokeLinecap="round" />
        <path d="M16 8h22l-6 8 6 8H16z" fill={G.green} />
        <polygon points={star(26, 16, 4.5, 2, 5)} fill={WHITE} />
      </>
    ),
  },
  purge: {
    cat: 'green',
    art: (
      <>
        <path
          d="M24 4v6M24 38v6M4 24h6M38 24h6"
          stroke={G.green}
          strokeWidth="3"
          strokeLinecap="round"
        />
        <circle
          cx="24"
          cy="24"
          r="14"
          fill="none"
          stroke={G.green}
          strokeWidth="3"
          strokeDasharray="16 6"
        />
        <polygon points={star(24, 24, 9, 3.5, 4)} fill={WHITE} />
      </>
    ),
  },
  'shroud-veil': {
    cat: 'blue',
    art: (
      <>
        <path
          transform="translate(24 25) scale(1.4)"
          d={shipPath}
          fill="none"
          stroke={G.blue}
          strokeWidth="1.6"
          strokeDasharray="3 2.2"
          strokeLinejoin="round"
        />
        <path d="M8 10c10 8 22 8 32 0v6c-10 8-22 8-32 0z" fill={G.blue} opacity=".8" />
        <path d="M8 36c10-8 22-8 32 0v-5c-10-8-22-8-32 0z" fill={G.blue} opacity=".45" />
        <path d="M6 42L42 6" stroke={WHITE} strokeWidth="3" strokeLinecap="round" />
      </>
    ),
  },
  'quiver-surge': {
    cat: 'red',
    art: (
      <>
        <path d="M10 14l22 0 6 4-6 4-22 0z" fill={G.red} />
        <path d="M10 26l22 0 6 4-6 4-22 0z" fill={G.red} />
        <path d="M6 18h4M6 30h4" stroke={WHITE} strokeWidth="3" strokeLinecap="round" />
        <path d="M38 8l4 4m0-4l-4 4M38 36l4 4m0-4l-4 4" stroke={WHITE} strokeWidth="2" />
      </>
    ),
  },
  'snare-tag': {
    cat: 'red',
    art: (
      <>
        <circle cx="24" cy="24" r="15" fill="none" stroke={G.red} strokeWidth="3" />
        <path
          d="M24 5v8M24 35v8M5 24h8M35 24h8"
          stroke={G.red}
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M15 15l18 18M33 15L15 33M24 12v24M12 24h24"
          stroke={WHITE}
          strokeWidth="1.6"
          opacity=".75"
        />
        <circle cx="24" cy="24" r="4" fill={WHITE} />
      </>
    ),
  },
  'renewal-pulse': {
    cat: 'green',
    art: (
      <>
        <path
          d="M6 24h8l4-9 6 18 4-9h14"
          fill="none"
          stroke={G.green}
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M24 4a20 20 0 0 1 20 20" fill="none" stroke={WHITE} strokeWidth="2" opacity=".6" />
        <path d="M24 44A20 20 0 0 1 4 24" fill="none" stroke={WHITE} strokeWidth="2" opacity=".6" />
        <path d="M33 31h4v4h4v4h-4v4h-4v-4h-4v-4h4z" fill={WHITE} />
      </>
    ),
  },
  'ward-lattice': {
    cat: 'green',
    art: (
      <>
        {[
          [16, 14],
          [32, 14],
          [8, 27],
          [24, 27],
          [40, 27],
          [16, 40],
          [32, 40],
        ].map(([x, y], i) => (
          <polygon
            key={i}
            points={star(x!, y!, 7.5, 7.5, 3)}
            transform={`rotate(30 ${x} ${y})`}
            fill={i === 3 ? WHITE : G.green}
            opacity={i === 3 ? 0.95 : 0.75}
          />
        ))}
      </>
    ),
  },
  'quake-round': {
    cat: 'red',
    art: (
      <>
        <ellipse cx="30" cy="30" rx="15" ry="6" fill="none" stroke={G.red} strokeWidth="2.5" />
        <ellipse cx="30" cy="30" rx="9" ry="3.5" fill="none" stroke={WHITE} strokeWidth="2" />
        <g transform="rotate(-40 16 18)">
          <path d="M10 14h10l4 4-4 4H10z" fill={G.red} />
          <path d="M6 15h4v6H6z" fill={WHITE} />
        </g>
        <path d="M22 22l6 6" stroke={WHITE} strokeWidth="2" strokeDasharray="2 2" />
      </>
    ),
  },

  // ---- Shared buffs ----
  'gun-tune': {
    cat: 'red',
    art: (
      <>
        <path d="M4 14h22l7 4-7 4H4z" fill={G.red} />
        <path d="M4 28h22l7 4-7 4H4z" fill={G.red} />
        <path d="M6 16h16M6 30h16" stroke={WHITE} strokeWidth="1.6" opacity=".7" />
        <path
          d="M40 42V10M33 17l7-8 7 8"
          fill="none"
          stroke={WHITE}
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </>
    ),
  },
  'warhead-tune': {
    cat: 'red',
    art: (
      <>
        <g transform="rotate(-45 20 28)">
          <path d="M8 24h18l8 4-8 4H8z" fill={G.red} />
          <path d="M8 24l-4-5v18l4-5z" fill={G.red} opacity=".7" />
          <path d="M26 24l8 4-8 4z" fill={WHITE} />
        </g>
        <polygon points={star(34, 14, 11, 4.5, 8)} fill={WHITE} />
        <polygon points={star(34, 14, 6, 2.5, 8)} fill={G.red} />
      </>
    ),
  },
  'steady-hands': {
    cat: 'red',
    art: (
      <>
        <circle cx="24" cy="24" r="16" fill="none" stroke={G.red} strokeWidth="3" />
        <path
          d="M24 2v12M24 34v12M2 24h12M34 24h12"
          stroke={G.red}
          strokeWidth="3"
          strokeLinecap="round"
        />
        <circle cx="24" cy="24" r="6" fill="none" stroke={WHITE} strokeWidth="2" />
        <circle cx="24" cy="24" r="2.4" fill={WHITE} />
      </>
    ),
  },
  'hardened-hull': {
    cat: 'blue',
    art: (
      <>
        <path d={shieldPath} fill={G.blue} />
        <path d="M11 17h26M10 25h28M12 33h24" stroke={INK} strokeWidth="2.5" />
        {[
          [16, 13],
          [32, 13],
          [16, 21],
          [32, 21],
          [16, 29],
          [32, 29],
        ].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="1.6" fill={WHITE} />
        ))}
        <path d="M24 5v38" stroke={WHITE} strokeWidth="1.5" opacity=".5" />
      </>
    ),
  },
  'jink-jets': {
    cat: 'blue',
    art: (
      <>
        {ship(14, 26, 0.8, G.blue, 0.45)}
        {ship(34, 26, 0.8, G.blue, 0.45)}
        {ship(24, 22, 1, WHITE)}
        <path
          d="M6 42q18-8 36 0"
          fill="none"
          stroke={G.blue}
          strokeWidth="3"
          strokeLinecap="round"
        />
      </>
    ),
  },
  // ---- Wasp ----
  overdrive: {
    cat: 'red',
    art: (
      <>
        <g transform="rotate(-90 24 24)">
          <path d="M6 14h22l10 5-10 5H6z" fill={G.red} />
          <path d="M6 26h22l10 5-10 5H6z" fill={G.red} />
          <path d="M28 14l10 5-10 5zM28 26l10 5-10 5z" fill={WHITE} />
        </g>
        <path
          d="M17 44c-3-5 0-6 2-10 2 4 4 6 1 10zM29 44c-3-5 0-6 2-10 2 4 4 6 1 10z"
          fill={G.gold}
        />
        <path d="M36 8h8M40 4v8" stroke={WHITE} strokeWidth="3" strokeLinecap="round" />
      </>
    ),
  },
  'trim-tabs': {
    cat: 'gold',
    art: (
      <>
        <path
          d="M8 36A18 18 0 0 1 36 12"
          fill="none"
          stroke={G.gold}
          strokeWidth="6"
          strokeLinecap="round"
        />
        <path d="M30 4l14 6-10 10z" fill={WHITE} />
        {ship(30, 32, 0.7, WHITE)}
      </>
    ),
  },
  'roll-cascade': {
    cat: 'gold',
    art: (
      <>
        <path
          d="M3 30c3-12 9-12 10 0s7 12 10 0 7-12 10 0"
          fill="none"
          stroke={G.gold}
          strokeWidth="4"
          strokeLinecap="round"
        />
        <path d="M33 30l4-4 2 6z" fill={G.gold} />
        <g transform="translate(40 24) rotate(90)">{ship(0, 0, 0.55, WHITE)}</g>
        <path
          d="M8 12h8M20 8h8M32 12h8"
          stroke={WHITE}
          strokeWidth="2.5"
          strokeLinecap="round"
          opacity=".7"
        />
      </>
    ),
  },
  'blind-tag': {
    cat: 'red',
    art: (
      <>
        <path d="M3 24c9-13 33-13 42 0-9 13-33 13-42 0z" fill={G.red} />
        <circle cx="24" cy="24" r="7" fill={INK} />
        <circle cx="26" cy="22" r="2.2" fill={WHITE} />
        <path d="M8 40L40 8" stroke={WHITE} strokeWidth="3.5" strokeLinecap="round" />
        <path d="M8 40L40 8" stroke={INK} strokeWidth="1.2" strokeLinecap="round" />
      </>
    ),
  },
  'shield-damper': {
    cat: 'blue',
    art: (
      <>
        <path d={shieldPath} fill={G.blue} />
        <path
          d="M14 18q5-5 10 0t10 0M14 26q5-5 10 0t10 0"
          fill="none"
          stroke={WHITE}
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M24 31v8M20 35l4 4 4-4"
          fill="none"
          stroke={INK}
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </>
    ),
  },
  // ---- Anvil ----
  'overcharge-round': {
    cat: 'red',
    art: (
      <>
        <path d="M16 44V18c0-8 4-13 8-15 4 2 8 7 8 15v26z" fill={G.red} />
        <path d="M16 38h16v6H16z" fill={WHITE} opacity=".8" />
        <path d="M27 9l-7 13h5l-4 12 9-15h-5l4-10z" fill={WHITE} />
        <path
          d="M6 14l4 3M42 14l-4 3M5 26h5M43 26h-5"
          stroke={G.gold}
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </>
    ),
  },
  'chaff-screen': {
    cat: 'blue',
    art: (
      <>
        {ship(32, 14, 0.75, WHITE)}
        {[
          [10, 38],
          [20, 30],
          [8, 26],
          [22, 42],
        ].map(([x, y], i) => (
          <g key={i} transform={`translate(${x} ${y}) rotate(45)`}>
            <rect x="-4" y="-4" width="8" height="8" fill={G.blue} />
            <rect x="-1.5" y="-1.5" width="3" height="3" fill={WHITE} />
          </g>
        ))}
        <path d="M28 22L14 34" stroke={G.blue} strokeWidth="1.6" strokeDasharray="2 2" />
      </>
    ),
  },
  'core-breach': {
    cat: 'red',
    art: (
      <>
        <polygon points={star(24, 24, 22, 9, 10)} fill={G.red} />
        <circle cx="24" cy="24" r="10" fill={G.gold} />
        <circle cx="24" cy="24" r="5" fill={WHITE} />
        <circle
          cx="24"
          cy="24"
          r="14"
          fill="none"
          stroke={WHITE}
          strokeWidth="1.5"
          strokeDasharray="3 3"
        />
      </>
    ),
  },
  // ---- Halo ----
  'veer-field': {
    cat: 'green',
    art: (
      <>
        <ellipse cx="24" cy="38" rx="18" ry="5" fill="none" stroke={G.green} strokeWidth="2.5" />
        {ship(24, 22, 0.85, WHITE)}
        <path
          d="M4 8q10 2 12 10M44 8q-10 2-12 10"
          fill="none"
          stroke={G.green}
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path d="M14 18l2 1 0-3zM34 18l-2 1 0-3z" fill={G.green} />
        <path d="M2 18l8 2M46 18l-8 2" stroke={WHITE} strokeWidth="2" strokeLinecap="round" />
      </>
    ),
  },
  'recharge-pulse': {
    cat: 'green',
    art: (
      <>
        <circle cx="24" cy="24" r="20" fill="none" stroke={G.green} strokeWidth="2" opacity=".6" />
        <path d={shieldPath} transform="translate(6 6) scale(.75)" fill={G.green} />
        <path d="M27 11l-8 13h5l-3 11 9-14h-5l3-10z" fill={WHITE} />
      </>
    ),
  },
  'mend-beam': {
    cat: 'green',
    art: (
      <>
        <path d="M8 40L28 20" stroke={G.green} strokeWidth="5" strokeLinecap="round" />
        <path d="M8 40L28 20" stroke={WHITE} strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="8" cy="40" r="4" fill={G.green} />
        <path d="M30 6h8v8h8v8h-8v8h-8v-8h-8v-8h8z" fill={WHITE} />
        <path d="M32 8h4v8h8v4h-8v8h-4v-8h-8v-4h8z" fill={G.green} />
      </>
    ),
  },
  'charge-beam': {
    cat: 'green',
    art: (
      <>
        <path d="M8 40L24 24" stroke={G.green} strokeWidth="5" strokeLinecap="round" />
        <path d="M8 40L24 24" stroke={WHITE} strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="8" cy="40" r="4" fill={G.green} />
        <path d={shieldPath} transform="translate(20 2) scale(.55)" fill={G.green} />
        <path d="M35 8l-5 9h4l-2 8 6-10h-4l2-7z" fill={WHITE} />
      </>
    ),
  },
  lifeline: {
    cat: 'green',
    art: (
      <>
        <path
          d="M24 43C8 31 4 23 4 15a10 10 0 0 1 20-3 10 10 0 0 1 20 3c0 8-4 16-20 28z"
          fill={G.green}
        />
        <path
          d="M6 24h9l3-7 5 14 4-9 3 2h12"
          fill="none"
          stroke={WHITE}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </>
    ),
  },
  sanctum: {
    cat: 'blue',
    art: (
      <>
        <circle cx="24" cy="26" r="18" fill={G.blue} opacity=".3" />
        <circle cx="24" cy="26" r="18" fill="none" stroke={G.blue} strokeWidth="3" />
        {ship(24, 28, 0.85, WHITE)}
        <ellipse cx="24" cy="6" rx="9" ry="3" fill="none" stroke={WHITE} strokeWidth="2.5" />
      </>
    ),
  },
  'dispel-lance': {
    cat: 'red',
    art: (
      <>
        <path d="M14 6h7v8h8v7h-8" fill={G.red} />
        <path d="M27 27h-8v-8M27 27v8h-7v8" fill="none" stroke={G.red} strokeWidth="3" />
        <path d="M4 44L40 8" stroke={WHITE} strokeWidth="3.5" strokeLinecap="round" />
        <path d="M44 4l-10 3 7 7z" fill={WHITE} />
      </>
    ),
  },
  'scan-pulse': {
    cat: 'green',
    art: (
      <>
        <circle cx="24" cy="24" r="19" fill="none" stroke={G.green} strokeWidth="2" opacity=".5" />
        <circle cx="24" cy="24" r="12" fill="none" stroke={G.green} strokeWidth="2" opacity=".7" />
        <path d="M24 24L24 5A19 19 0 0 1 41 16z" fill={G.green} opacity=".8" />
        <circle cx="24" cy="24" r="2.5" fill={WHITE} />
        <circle cx="33" cy="13" r="3" fill={WHITE} />
        <path d="M33 13l-3 6" stroke={WHITE} strokeWidth="1.5" strokeDasharray="1.5 1.5" />
      </>
    ),
  },
  // ---- Bulwark ----
  'blast-ward': {
    cat: 'blue',
    art: (
      <>
        <path d={shieldPath} fill={G.blue} />
        <g transform="rotate(-40 24 24)">
          <path d="M12 21h18l6 3-6 3H12z" fill={WHITE} />
          <path d="M12 21l-3-3v12l3-3z" fill={WHITE} opacity=".7" />
        </g>
        <path d="M10 38L38 10" stroke={INK} strokeWidth="4" strokeLinecap="round" />
      </>
    ),
  },
  'shield-weave': {
    cat: 'blue',
    art: (
      <>
        <path d={shieldPath} fill="none" stroke={G.blue} strokeWidth="3" />
        <path d="M9 24h30c-1 10-7 16-15 19C16 40 10 34 9 24z" fill={G.blue} />
        <path
          d="M17 22v-8M14 17l3-4 3 4M31 22v-8M28 17l3-4 3 4"
          fill="none"
          stroke={WHITE}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </>
    ),
  },
  'crash-frame': {
    cat: 'blue',
    art: (
      <>
        <path d="M2 42h44v4H2z" fill={G.blue} />
        <g transform="translate(26 22) rotate(150)">{ship(0, 0, 0.9, G.blue)}</g>
        <polygon points={star(18, 40, 9, 3.5, 6)} fill={WHITE} />
        <path
          d="M6 32l-3-4M12 30l-1-5M30 32l3-4"
          stroke={WHITE}
          strokeWidth="2"
          strokeLinecap="round"
        />
      </>
    ),
  },
  'track-drive': {
    cat: 'gold',
    art: (
      <>
        <rect
          x="12"
          y="26"
          width="32"
          height="14"
          rx="7"
          fill="none"
          stroke={G.gold}
          strokeWidth="4"
        />
        {[19, 28, 37].map((x) => (
          <circle key={x} cx={x} cy="33" r="3" fill={WHITE} />
        ))}
        <path d="M18 26l4-10h14l4 10z" fill={G.gold} />
        <path d="M2 28h7M4 34h5M2 40h7" stroke={WHITE} strokeWidth="2.5" strokeLinecap="round" />
      </>
    ),
  },
  'shield-breaker': {
    cat: 'red',
    art: (
      <>
        <path d="M23 4L8 10v12c0 10 6 17 14 21l3-9-4-6 4-6-3-6z" fill={G.red} />
        <path d="M27 4l13 6v12c0 10-6 17-14 21l3-9-4-6 4-6-3-6z" fill={G.red} opacity=".75" />
        <path d="M24 3l3 6-4 6 4 6-4 6 4 6-3 9" fill="none" stroke={WHITE} strokeWidth="2" />
      </>
    ),
  },
  'ground-shroud': {
    cat: 'blue',
    art: (
      <>
        <path d="M2 44c8-14 14-18 22-18s14 4 22 18z" fill={G.blue} opacity=".7" />
        <path
          transform="translate(24 18) scale(1.1)"
          d={shipPath}
          fill="none"
          stroke={WHITE}
          strokeWidth="1.6"
          strokeDasharray="3 2.2"
          strokeLinejoin="round"
        />
        <path d="M8 6c8 6 24 6 32 0" fill="none" stroke={G.blue} strokeWidth="2.5" />
      </>
    ),
  },
};

const RIM: Record<Category, string> = {
  red: '#ff6a3d',
  blue: '#5fe3ff',
  green: '#6fffa0',
  gold: '#f2c24b',
};

/** Icon tile: dark angular plate with the category colour as a bottom edge; the glyph sits on top. */
export function SkillIcon({ id }: { id: string }) {
  const def = SKILL[id];
  return (
    <svg viewBox="0 0 48 48" className="skill-icon" aria-hidden>
      {def ? (
        <>
          <path d="M1 1h38l8 8v38H1z" fill="url(#i-tile)" />
          <path
            d="M1 1h38l8 8v38H1z"
            fill="none"
            stroke={RIM[def.cat]}
            strokeOpacity=".35"
            strokeWidth="1"
          />
          <path d="M1 44h46v3H1z" fill={RIM[def.cat]} />
          <g style={{ filter: 'drop-shadow(0 1px 1px #000c)' }}>{def.art}</g>
        </>
      ) : (
        <circle cx="24" cy="24" r="10" fill="#7fe7ff" />
      )}
    </svg>
  );
}

const WEAPON: Record<string, ReactNode> = {
  'needle-cannon': (
    <>
      <path d="M2 20h30l6 4-6 4H2z" fill="url(#g-steel)" stroke="#222a36" strokeWidth="1" />
      <path d="M2 22h30" stroke="#fff" strokeWidth="1.5" opacity=".7" />
      <rect x="12" y="15" width="10" height="5" fill="url(#g-dark)" />
      <path
        d="M36 24l10 0M38 18l8-3M38 30l8 3"
        stroke="url(#g-cyan)"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </>
  ),
  'flak-repeater': (
    <>
      <path d="M2 26h18v9H2z" fill="url(#g-gold)" stroke="#5a3a08" strokeWidth="1" />
      <path d="M20 28h12v5H20z" fill="url(#g-steel)" />
      <polygon points={star(37, 23, 10, 4.5, 9)} fill="url(#g-fire)" />
      <circle cx="37" cy="23" r="3.5" fill="#fff8c0" />
    </>
  ),
  'pulse-blaster': (
    <>
      <path d="M2 18h14l4 6-4 6H2z" fill="url(#g-dark)" stroke="#9ae" strokeWidth="1" />
      <circle cx="26" cy="24" r="5.5" fill="url(#g-magenta)" />
      <circle cx="26" cy="24" r="2.2" fill="#fff" />
      <circle cx="38" cy="24" r="4" fill="url(#g-cyan)" opacity=".85" />
      <circle cx="45" cy="24" r="2.4" fill="url(#g-cyan)" opacity=".55" />
    </>
  ),
  'twin-autocannon': (
    <>
      <path
        d="M2 13h30l5 3-5 3H2zM2 29h30l5 3-5 3H2z"
        fill="url(#g-steel)"
        stroke="#222a36"
        strokeWidth="1"
      />
      <rect x="6" y="19" width="12" height="10" fill="url(#g-dark)" />
      <polygon points="38,16 47,12 44,16 47,20" fill="url(#g-fire)" />
      <polygon points="38,32 47,28 44,32 47,36" fill="url(#g-fire)" />
    </>
  ),
  'sting-missile': (
    <>
      <path d="M10 24C4 24 2 28 1 32c6 0 9-3 11-6z" fill="url(#g-fire)" />
      <path d="M12 18h20l12 6-12 6H12z" fill="url(#g-steel)" stroke="#222a36" strokeWidth="1" />
      <path d="M32 18l12 6-12 6z" fill="url(#g-red)" />
      <path d="M12 18L6 10v10zM12 30l-6 8V28z" fill="url(#g-red)" />
      <path d="M14 20h16" stroke="#fff" strokeWidth="1.5" opacity=".7" />
    </>
  ),
  'seeker-pod': (
    <>
      <rect
        x="5"
        y="9"
        width="38"
        height="30"
        rx="5"
        fill="url(#g-dark)"
        stroke="#9ae"
        strokeWidth="1"
      />
      {[15, 33].flatMap((x) =>
        [18, 30].map((y) => (
          <circle
            key={`${x}${y}`}
            cx={x}
            cy={y}
            r="5"
            fill="#0a1018"
            stroke="url(#g-steel)"
            strokeWidth="2"
          />
        )),
      )}
      {[15, 33].flatMap((x) =>
        [18, 30].map((y) => (
          <circle key={`e${x}${y}`} cx={x} cy={y} r="1.8" fill="url(#g-green)" />
        )),
      )}
    </>
  ),
  'brick-bomb': (
    <>
      <path d="M20 8h8l-1 6h-6z" fill="url(#g-steel)" />
      <ellipse
        cx="24"
        cy="28"
        rx="12"
        ry="15"
        fill="url(#g-fire)"
        stroke="#6a1408"
        strokeWidth="1.2"
      />
      <path d="M13 20l-4-4v9zM35 20l4-4v9z" fill="url(#g-red)" />
      <ellipse cx="19" cy="22" rx="3" ry="6" fill="#fff" opacity=".4" />
      <path d="M12 30h24" stroke="#6a1408" strokeWidth="2" />
    </>
  ),
  'mortar-battery': (
    <>
      <path d="M4 42h24l-2-5H6z" fill="url(#g-dark)" />
      <path d="M8 38l9-17 8 4-5 13z" fill="url(#g-steel)" stroke="#222a36" strokeWidth="1" />
      <path d="M16 20l10-8" stroke="url(#g-dark)" strokeWidth="7" strokeLinecap="round" />
      <path
        d="M27 14Q36 2 45 26"
        fill="none"
        stroke="url(#g-gold)"
        strokeWidth="2"
        strokeDasharray="3 4"
      />
      <circle cx="45" cy="30" r="4.5" fill="url(#g-fire)" />
      <polygon points={star(17, 18, 6, 2.5, 6)} fill="url(#g-fire)" />
    </>
  ),
};

export function WeaponIcon({ id }: { id: string }) {
  return (
    <svg viewBox="0 0 48 48" className="wpn-icon" aria-hidden>
      {WEAPON[id] ?? SKILL[id]?.art ?? <circle cx="24" cy="24" r="8" fill="#d8f4ff" />}
    </svg>
  );
}
