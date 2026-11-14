import type { ReactElement, ReactNode } from 'react';
import { SKILLS } from '@skyriot/shared';

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
          [0, '#b02a2a'],
          [1, '#2a0a0e'],
        ])}
        {rad('bg-blue', [
          [0, '#2a5fa6'],
          [1, '#09162e'],
        ])}
        {rad('bg-green', [
          [0, '#2a9a52'],
          [1, '#082a18'],
        ])}
        {rad('bg-violet', [
          [0, '#7a3fc0'],
          [1, '#1a0a30'],
        ])}
        {rad('bg-gold', [
          [0, '#b08a1c'],
          [1, '#3a2606'],
        ])}
        {rad('bg-cyan', [
          [0, '#1f93a8'],
          [1, '#062a36'],
        ])}
        {rad('bg-orange', [
          [0, '#c2601a'],
          [1, '#3a1604'],
        ])}
        {rad('bg-teal', [
          [0, '#3d6f72'],
          [1, '#0c2226'],
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

const star = (cx: number, cy: number, r1: number, r2: number, n: number) =>
  Array.from({ length: n * 2 }, (_, i) => {
    const a = (i * Math.PI) / n - Math.PI / 2;
    const r = i % 2 ? r2 : r1;
    return `${(cx + Math.cos(a) * r).toFixed(1)},${(cy + Math.sin(a) * r).toFixed(1)}`;
  }).join(' ');

/*
 * Skill icons. Three things tell them apart at a glance, before the glyph is even read:
 *  - the whole tile is the family colour (attack red, defence blue, move gold, heal green, shield cyan,
 *    stealth / debuff violet, weapon mode orange, utility teal);
 *  - the tile's dressing is the kind: hazard stripes = a toggle that drains SP, dashed ring = an aura on
 *    allies, round canister = a Consumable, plain = one cast;
 *  - a short tag (shown under the Hotbar slot) names it.
 * Glyphs are white with one yellow accent: bold silhouettes, nothing thinner than ~2 units of the 48 tile.
 */
type Family = 'attack' | 'defence' | 'move' | 'heal' | 'shield' | 'stealth' | 'mode' | 'utility';
const FAMILY: Record<Family, { bg: string; rim: string }> = {
  attack: { bg: 'url(#bg-red)', rim: '#ff6a4a' },
  defence: { bg: 'url(#bg-blue)', rim: '#6aa8ff' },
  move: { bg: 'url(#bg-gold)', rim: '#ffd24a' },
  heal: { bg: 'url(#bg-green)', rim: '#6fffa0' },
  shield: { bg: 'url(#bg-cyan)', rim: '#7ff0ff' },
  stealth: { bg: 'url(#bg-violet)', rim: '#c28aff' },
  mode: { bg: 'url(#bg-orange)', rim: '#ff9a2e' },
  utility: { bg: 'url(#bg-teal)', rim: '#8fe0d0' },
};
const W = '#ffffff';
const Y = '#ffe14a';
const K = '#06101a';

type El = ReactElement;
const at = (x: number, y: number, k: number, rot: number, children: ReactNode, o = 1): El => (
  <g
    key={`${x},${y},${rot}`}
    transform={`translate(${x} ${y}) rotate(${rot}) scale(${k})`}
    opacity={o}
  >
    {children}
  </g>
);
const shipPath = 'M0-13L4-3 14 5v4L4 6 3 13 0 11-3 13-4 6-14 9V5L-4-3z';
const ship = (x: number, y: number, k = 1, fill = W, rot = 0, o = 1) =>
  at(x, y, k, rot, <path d={shipPath} fill={fill} />, o);
const missile = (x: number, y: number, k = 1, rot = 0, fill = W) =>
  at(
    x,
    y,
    k,
    rot,
    <>
      <path d="M-3-5h6v11h-6z" fill={fill} />
      <path d="M-3-5L0-12 3-5z" fill={Y} />
      <path d="M-3 2l-4 5v-6zM3 2l4 5v-6z" fill={fill} />
      <path d="M-2 6h4l-2 5z" fill={Y} />
    </>,
  );
const bomb = (x: number, y: number, k = 1, fill = W) =>
  at(
    x,
    y,
    k,
    0,
    <>
      <path d="M-5-4h10v8c0 4-2 8-5 8s-5-4-5-8z" fill={fill} />
      <path d="M-5-4l-4-5v7zM5-4l4-5v7zM-2-9h4v5h-4z" fill={Y} />
    </>,
  );
const arrow = (x: number, y: number, k = 1, rot = 0, fill = Y) =>
  at(x, y, k, rot, <path d="M0-8l8 9h-5v7h-6v-7h-5z" fill={fill} />);
const cross = (x: number, y: number, k = 1, fill = W) =>
  at(x, y, k, 0, <path d="M-3-9h6v6h6v6h-6v6h-6v-6h-6v-6h6z" fill={fill} />);
const bolt = (x: number, y: number, k = 1, fill = Y) =>
  at(x, y, k, 0, <path d="M3-11l-10 12h6l-3 10 11-13h-6z" fill={fill} />);
const shieldD = 'M0-12l10 3v8c0 7-4 11-10 13-6-2-10-6-10-13v-8z';
const shield = (x: number, y: number, k = 1, fill = W, o = 1) =>
  at(x, y, k, 0, <path d={shieldD} fill={fill} />, o);
const drop = (x: number, y: number, k = 1, fill = W) =>
  at(x, y, k, 0, <path d="M0-11c6 7 8 10 8 14a8 8 0 0 1-16 0c0-4 2-7 8-14z" fill={fill} />);
const rings = (cx: number, cy: number, rs: number[], stroke = W, w = 2.5) =>
  rs.map((r, i) => (
    <circle
      key={r}
      cx={cx}
      cy={cy}
      r={r}
      fill="none"
      stroke={stroke}
      strokeWidth={w}
      opacity={1 - i * 0.3}
    />
  ));
const line = (d: string, stroke = W, w = 3) => (
  <path
    d={d}
    fill="none"
    stroke={stroke}
    strokeWidth={w}
    strokeLinecap="round"
    strokeLinejoin="round"
  />
);
/** Canister body of a Consumable; the symbol goes on its label. */
const can = (
  <>
    <rect x="13" y="13" width="22" height="29" rx="5" fill={W} />
    <rect x="18" y="6" width="12" height="8" rx="2" fill={Y} />
    <rect x="16" y="20" width="16" height="17" rx="2" fill={K} />
  </>
);

const SKILL: Record<string, { fam: Family; tag: string; art: ReactNode }> = {
  // ---- long buffs ----
  'gun-tune': {
    fam: 'attack',
    tag: 'GUN+',
    art: (
      <>
        <path d="M5 30h24v4H5zM5 23h28v4H5zM5 16h24v4H5z" fill={W} />
        <path d="M5 14h6v22H5z" fill={W} />
        {arrow(39, 24, 1.1)}
      </>
    ),
  },
  'warhead-tune': {
    fam: 'attack',
    tag: 'MSL+',
    art: (
      <>
        {missile(19, 26, 2.1, 0)}
        {arrow(39, 22, 1.1)}
      </>
    ),
  },
  'steady-hands': {
    fam: 'utility',
    tag: 'AIM',
    art: (
      <>
        {rings(24, 25, [13])}
        {line('M24 7v10M24 33v10M6 25h10M32 25h10')}
        <circle cx="24" cy="25" r="3.5" fill={Y} />
      </>
    ),
  },
  'hardened-hull': {
    fam: 'defence',
    tag: 'ARMOR',
    art: (
      <>
        <path d="M8 10h32v20l-16 12L8 30z" fill={W} />
        <path d="M8 20h32M24 10v32" stroke={K} strokeWidth="2.5" />
        {[14, 34].map((x) =>
          [15, 26].map((y) => <circle key={`${x}${y}`} cx={x} cy={y} r="2" fill={K} />),
        )}
      </>
    ),
  },
  'jink-jets': {
    fam: 'move',
    tag: 'EVADE',
    art: (
      <>
        {ship(11, 27, 0.8, W, 0, 0.3)}
        {ship(19, 26, 0.9, W, 0, 0.55)}
        {ship(30, 25, 1.1)}
        {line('M40 12l-5 5M42 22h-6', Y, 2.5)}
      </>
    ),
  },
  // ---- Wasp / Anvil moves ----
  'pivot-flip': {
    fam: 'move',
    tag: 'FLIP',
    art: (
      <>
        {line('M14 42V21a10 10 0 0 1 20 0v8', W, 6)}
        <path d="M24 27h20L34 41z" fill={Y} />
      </>
    ),
  },
  backdraft: {
    fam: 'move',
    tag: 'BACK',
    art: (
      <>
        {ship(24, 17, 0.95)}
        {line('M13 29l11 6 11-6M13 37l11 6 11-6', Y, 4)}
      </>
    ),
  },
  'afterburn-dash': {
    fam: 'move',
    tag: 'DASH',
    art: (
      <>
        <path d="M24 6l8 12v8H16v-8z" fill={W} />
        <path d="M16 27h16l-3 9-5 8-5-8z" fill={Y} />
        <path d="M21 28h6l-3 9z" fill="#ff5a2a" />
        {line('M8 14v14M40 14v14', W, 3)}
      </>
    ),
  },
  'roll-cascade': {
    fam: 'move',
    tag: 'ROLL',
    art: (
      <>
        {line('M38 27a14 14 0 0 1-26 6M10 25a14 14 0 0 1 26-6', W, 4)}
        <path d="M32 13l10 3-7 8zM16 39L6 36l7-8z" fill={Y} />
        {ship(24, 26, 0.55)}
      </>
    ),
  },
  'trim-tabs': {
    fam: 'move',
    tag: 'TURN',
    art: (
      <>
        {line('M8 40c0-16 8-24 24-24', W, 5)}
        <path d="M30 8l12 8-12 8z" fill={Y} />
        {line('M18 40c0-8 4-13 12-14', W, 2.5)}
      </>
    ),
  },
  overdrive: {
    fam: 'attack',
    tag: 'FRENZY',
    art: (
      <>
        {missile(11, 28, 1.25, -18)}
        {missile(24, 24, 1.5, 0)}
        {missile(37, 28, 1.25, 18)}
      </>
    ),
  },
  'quiver-surge': {
    fam: 'attack',
    tag: 'SURGE',
    art: (
      <>
        <polygon points={star(24, 26, 20, 9, 8)} fill={Y} />
        {[
          [14, 17],
          [24, 15],
          [34, 17],
          [14, 33],
          [24, 35],
          [34, 33],
        ].map(([x, y]) => missile(x!, y!, 0.8, 0, K))}
      </>
    ),
  },
  'blind-tag': {
    fam: 'stealth',
    tag: 'JAM',
    art: (
      <>
        <path d="M4 26c6-10 13-14 20-14s14 4 20 14c-6 10-13 14-20 14S10 36 4 26z" fill={W} />
        <circle cx="24" cy="26" r="7" fill={K} />
        {line('M8 42L40 10', '#ff4a3a', 5)}
      </>
    ),
  },
  // ---- Anvil ----
  'air-barrage-mode': {
    fam: 'mode',
    tag: 'AIR',
    art: (
      <>
        {missile(10, 30, 1.1, -22)}
        {missile(24, 26, 1.3, 0)}
        {missile(38, 30, 1.1, 22)}
        {line('M6 12h36', W, 2.5)}
      </>
    ),
  },
  'ground-strike-mode': {
    fam: 'mode',
    tag: 'GROUND',
    art: (
      <>
        {bomb(13, 20, 0.9)}
        {bomb(24, 15, 0.9)}
        {bomb(35, 20, 0.9)}
        <path d="M3 44l6-8 6 5 5-7 6 7 6-6 6 5 7-5v9z" fill={W} />
      </>
    ),
  },
  'wide-lock-mode': {
    fam: 'mode',
    tag: 'MULTI',
    art: (
      <>
        {line('M24 44L5 14M24 44L43 14', W, 2.5)}
        {[10, 24, 38].map((x, i) => (
          <g key={x}>
            <rect
              x={x - 5}
              y={(i === 1 ? 10 : 15) - 0}
              width="10"
              height="10"
              fill="none"
              stroke={Y}
              strokeWidth="2.5"
            />
            <circle cx={x} cy={(i === 1 ? 15 : 20) - 0} r="2" fill={W} />
          </g>
        ))}
      </>
    ),
  },
  'overcharge-round': {
    fam: 'attack',
    tag: 'CHARGE',
    art: (
      <>
        <path d="M17 44V20c0-7 3-12 7-14 4 2 7 7 7 14v24z" fill={W} />
        <path d="M17 38h14v6H17z" fill={K} />
        {bolt(24, 25, 0.95)}
      </>
    ),
  },
  'shield-damper': {
    fam: 'defence',
    tag: 'DAMP',
    art: (
      <>
        {shield(24, 26, 1.5)}
        {line('M16 20h16M17 27h14M19 34h10', K, 3)}
      </>
    ),
  },
  'chaff-screen': {
    fam: 'defence',
    tag: 'CHAFF',
    art: (
      <>
        {ship(24, 14, 0.6)}
        {[
          [9, 28, 30],
          [18, 34, -20],
          [29, 30, 55],
          [39, 36, -40],
          [13, 41, 70],
          [34, 43, 10],
          [24, 42, -60],
        ].map(([x, y, r]) => (
          <rect
            key={`${x}${y}`}
            x={x! - 4}
            y={y! - 1.5}
            width="8"
            height="3"
            fill={(x! + y!) % 2 ? Y : W}
            transform={`rotate(${r} ${x} ${y})`}
          />
        ))}
      </>
    ),
  },
  'shroud-veil': {
    fam: 'stealth',
    tag: 'CLOAK',
    art: (
      <>
        <path
          transform="translate(24 27) scale(1.35)"
          d={shipPath}
          fill="none"
          stroke={W}
          strokeWidth="1.8"
          strokeDasharray="3 2.5"
        />
        <path d="M24 12l5 12h-10z" fill={W} opacity=".5" />
      </>
    ),
  },
  'core-breach': {
    fam: 'attack',
    tag: 'BOOM',
    art: (
      <>
        <polygon points={star(24, 26, 21, 10, 10)} fill={Y} />
        <polygon points={star(24, 26, 13, 6, 10)} fill="#ff4a2a" />
        <circle cx="24" cy="26" r="4.5" fill={W} />
      </>
    ),
  },
  // ---- Halo ----
  'zenith-tune': {
    fam: 'attack',
    tag: 'ELEV',
    art: (
      <>
        {arrow(15, 28, 1.5, 0, W)}
        {arrow(33, 28, 1.5, 0, W)}
        <polygon points={star(24, 13, 7, 3, 4)} fill={Y} />
      </>
    ),
  },
  'mend-beam': {
    fam: 'heal',
    tag: 'HEAL',
    art: (
      <>
        {cross(16, 30, 1.25)}
        {line('M26 22L40 10', Y, 4)}
        <circle cx="40" cy="10" r="4" fill={W} />
      </>
    ),
  },
  'renewal-pulse': {
    fam: 'heal',
    tag: 'HEAL ALL',
    art: (
      <>
        {rings(24, 26, [13, 19], W, 2.5)}
        {cross(24, 26, 0.95, Y)}
      </>
    ),
  },
  'charge-beam': {
    fam: 'shield',
    tag: 'SHLD',
    art: (
      <>
        {shield(17, 30, 1.1)}
        {line('M27 21L40 10', Y, 4)}
        <circle cx="40" cy="10" r="4" fill={W} />
      </>
    ),
  },
  'recharge-pulse': {
    fam: 'shield',
    tag: 'SHLD ALL',
    art: (
      <>
        {rings(24, 26, [13, 19], W, 2.5)}
        {shield(24, 26, 0.8, Y)}
      </>
    ),
  },
  'rally-field': {
    fam: 'attack',
    tag: 'RALLY',
    art: (
      <>
        {line('M14 8v36', W, 4)}
        <path d="M16 9h24l-7 8 7 8H16z" fill={Y} />
      </>
    ),
  },
  'ward-lattice': {
    fam: 'defence',
    tag: 'WARD',
    art: (
      <>
        {shield(24, 26, 1.5)}
        {line('M12 20h24M13 29h22M19 10v32M29 10v32', K, 2)}
      </>
    ),
  },
  'veer-field': {
    fam: 'move',
    tag: 'VEER',
    art: (
      <>
        {line('M24 26c0-6 8-6 8 0s-16 8-16-2 20-14 22 4', W, 4)}
        <circle cx="24" cy="26" r="2.5" fill={Y} />
      </>
    ),
  },
  sanctum: {
    fam: 'defence',
    tag: 'INVUL',
    art: (
      <>
        <ellipse cx="24" cy="11" rx="12" ry="4" fill="none" stroke={Y} strokeWidth="3.5" />
        {ship(24, 30, 1.1)}
        {line('M6 30l-2 0M42 30h2M9 18l-2-2M39 18l2-2', Y, 3)}
      </>
    ),
  },
  'reverse-drive': {
    fam: 'move',
    tag: 'REV',
    art: (
      <>
        <path d="M24 44l-9-10h6V20h6v14h6z" fill={Y} />
        {ship(24, 14, 0.75)}
      </>
    ),
  },
  'fuel-line': {
    fam: 'utility',
    tag: 'FUEL',
    art: (
      <>
        {drop(15, 28, 1.25, Y)}
        {line('M27 26h10', W, 4)}
        <path d="M34 18l10 8-10 8z" fill={W} />
      </>
    ),
  },
  'thrift-circuit': {
    fam: 'utility',
    tag: 'SP-',
    art: (
      <>
        {rings(20, 24, [13], W, 3)}
        <text
          x="20"
          y="29"
          textAnchor="middle"
          fontSize="13"
          fontWeight="900"
          fill={W}
          fontFamily="Orbitron, sans-serif"
        >
          SP
        </text>
        {arrow(40, 30, 1, 180)}
      </>
    ),
  },
  'scan-pulse': {
    fam: 'utility',
    tag: 'SCAN',
    art: (
      <>
        {rings(24, 26, [18], W, 2.5)}
        <path d="M24 26L24 8A18 18 0 0 1 40 18z" fill={Y} opacity=".85" />
        <circle cx="24" cy="26" r="3" fill={W} />
        <circle cx="14" cy="33" r="2.5" fill="#ff4a3a" />
      </>
    ),
  },
  lifeline: {
    fam: 'heal',
    tag: 'FULL',
    art: (
      <>
        <path d="M24 42C10 32 5 25 5 18a9 9 0 0 1 19-4 9 9 0 0 1 19 4c0 7-5 14-19 24z" fill={W} />
        {line('M8 25h8l3-7 5 13 4-9 2 3h10', '#ff4a3a', 2.8)}
      </>
    ),
  },
  'dispel-lance': {
    fam: 'stealth',
    tag: 'STRIP',
    art: (
      <>
        {line('M6 42L30 18', W, 4)}
        <path d="M26 12l12-4-4 12z" fill={Y} />
        {line('M33 30l6 2M30 36l4 5M39 22l5-1', W, 2.5)}
      </>
    ),
  },
  purge: {
    fam: 'utility',
    tag: 'CLEAN',
    art: (
      <>
        {drop(24, 24, 1.5)}
        <polygon points={star(24, 27, 8, 3, 4)} fill={Y} />
        {line('M8 12l3 3M40 12l-3 3M24 4v4', Y, 2.5)}
      </>
    ),
  },
  // ---- Bulwark ----
  'siege-anchor': {
    fam: 'mode',
    tag: 'SIEGE',
    art: (
      <>
        <path d="M4 40h40v5H4z" fill={W} />
        <path d="M12 40l4-10h16l4 10z" fill={W} />
        <path d="M21 30V10h6v20z" fill={W} />
        <path d="M18 10h12v-4H18z" fill={Y} />
      </>
    ),
  },
  'air-siege': {
    fam: 'mode',
    tag: 'AIR SG',
    art: (
      <>
        <path d="M12 30l4-8h16l4 8z" fill={W} />
        <path d="M21 22V8h6v14z" fill={W} />
        <path d="M18 8h12V4H18z" fill={Y} />
        {line('M8 37h32M13 43h22', Y, 3)}
      </>
    ),
  },
  'siege-bastion': {
    fam: 'defence',
    tag: 'FORT',
    art: (
      <>
        <path d="M8 44V16h6v5h6v-5h8v5h6v-5h6v28z" fill={W} />
        <path d="M20 44V33a4 4 0 0 1 8 0v11z" fill={K} />
      </>
    ),
  },
  'shield-weave': {
    fam: 'shield',
    tag: 'REMEDY',
    art: (
      <>
        {shield(24, 26, 1.5)}
        {cross(24, 25, 0.75, '#1b8fb0')}
      </>
    ),
  },
  'blast-ward': {
    fam: 'defence',
    tag: 'BARRIER',
    art: (
      <>
        <path d="M6 40a18 18 0 0 1 36 0z" fill="none" stroke={W} strokeWidth="3.5" />
        {ship(24, 34, 0.6)}
        {missile(37, 13, 1, 135, Y)}
        {line('M30 17l-4 4', Y, 3)}
      </>
    ),
  },
  'track-drive': {
    fam: 'move',
    tag: 'TRACK',
    art: (
      <>
        <rect x="5" y="24" width="30" height="16" rx="8" fill={W} />
        {[13, 20, 27].map((x) => (
          <circle key={x} cx={x} cy="32" r="3" fill={K} />
        ))}
        {line('M36 14l6 5-6 5M27 12l6 5-6 5', Y, 3.5)}
      </>
    ),
  },
  'snare-tag': {
    fam: 'stealth',
    tag: 'SNARE',
    art: (
      <>
        {ship(24, 26, 0.9)}
        {line('M6 10h36M6 20h36M6 30h36M6 40h36M10 6v38M24 6v38M38 6v38', Y, 1.8)}
      </>
    ),
  },
  'ground-shroud': {
    fam: 'stealth',
    tag: 'CAMO',
    art: (
      <>
        <path
          transform="translate(24 22) scale(1.05)"
          d={shipPath}
          fill="none"
          stroke={W}
          strokeWidth="2"
          strokeDasharray="3 2.5"
        />
        <path d="M3 44l6-7 6 4 5-6 6 6 6-5 6 4 7-4v8z" fill={W} />
      </>
    ),
  },
  'shield-breaker': {
    fam: 'stealth',
    tag: 'BREAK',
    art: (
      <>
        {shield(24, 26, 1.5)}
        {line('M27 8l-6 12 7 4-8 18', K, 3.5)}
      </>
    ),
  },
  'quake-round': {
    fam: 'attack',
    tag: 'HYPER',
    art: (
      <>
        <path d="M19 40V22c0-6 2-10 5-12 3 2 5 6 5 12v18z" fill={W} />
        {line('M12 36a14 14 0 0 1 0-20M36 36a14 14 0 0 0 0-20', Y, 3)}
        {line('M6 40a22 22 0 0 1 0-28M42 40a22 22 0 0 0 0-28', Y, 2)}
      </>
    ),
  },
  // ---- Consumables ----
  'repair-kit': {
    fam: 'heal',
    tag: 'HP',
    art: (
      <>
        {can}
        {cross(24, 28.5, 0.7, '#6fffa0')}
      </>
    ),
  },
  'shield-kit': {
    fam: 'shield',
    tag: 'SH',
    art: (
      <>
        {can}
        {shield(24, 28.5, 0.6, '#7ff0ff')}
      </>
    ),
  },
  'sp-kit': {
    fam: 'stealth',
    tag: 'SP',
    art: (
      <>
        {can}
        <text
          x="24"
          y="32.5"
          textAnchor="middle"
          fontSize="10"
          fontWeight="900"
          fill="#d9b3ff"
          fontFamily="Orbitron, sans-serif"
        >
          SP
        </text>
      </>
    ),
  },
  'fuel-cell': {
    fam: 'move',
    tag: 'FUEL',
    art: (
      <>
        {can}
        {drop(24, 29, 0.6, Y)}
      </>
    ),
  },
};

/** Short name shown under a Hotbar slot. */
export const skillTag = (id: string): string => SKILL[id]?.tag ?? '';

/** Icon tile: family colour all over, dressed by kind (stripes = SP-draining toggle, dashed ring = ally aura). */
export function SkillIcon({ id }: { id: string }) {
  const def = SKILL[id];
  const sk = SKILLS[id];
  const fam = def ? FAMILY[def.fam] : null;
  const kit = sk?.kind === 'consumable';
  const plate = kit
    ? 'M9 1h30a8 8 0 0 1 8 8v30a8 8 0 0 1-8 8H9a8 8 0 0 1-8-8V9a8 8 0 0 1 8-8z'
    : 'M1 1h38l8 8v38H1z';
  return (
    <svg viewBox="0 0 48 48" className="skill-icon" aria-hidden>
      {def && fam ? (
        <>
          <clipPath id={`clip-${id}`}>
            <path d={plate} />
          </clipPath>
          <path d={plate} fill={fam.bg} />
          <g clipPath={`url(#clip-${id})`}>
            {sk?.auraRadiusM !== undefined && (
              <circle
                cx="24"
                cy="26"
                r="21"
                fill="none"
                stroke={W}
                strokeOpacity=".45"
                strokeWidth="2"
                strokeDasharray="4 3"
              />
            )}
            {(sk?.spPerSec ?? 0) > 0 &&
              Array.from({ length: 9 }, (_, i) => (
                <path key={i} d={`M${i * 7 - 6} 6l5-6h4l-5 6z`} fill={Y} />
              ))}
          </g>
          <g style={{ filter: 'drop-shadow(0 1px 1px #000c)' }}>{def.art}</g>
          <path d={plate} fill="none" stroke={fam.rim} strokeWidth="2" />
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

/** Raw 48-grid art of a Weapon line or Skill/Consumable id (for item tiles). */
export const iconArt = (id: string): ReactNode => WEAPON[id] ?? SKILL[id]?.art;

/** Currency coins and window glyphs (48 grid, original). */
export function UiGlyph({
  name,
}: {
  name: 'credits' | 'scrap' | 'glory' | 'lock' | 'sort' | 'close';
}) {
  const art: Record<string, ReactNode> = {
    credits: (
      <>
        <circle cx="24" cy="24" r="19" fill="url(#g-gold)" stroke="#5a3a08" strokeWidth="2" />
        <circle cx="24" cy="24" r="13" fill="none" stroke="#8a5608" strokeWidth="2" />
        <path
          d="M24 13v22M29 18h-7a4 4 0 000 8h4a4 4 0 010 8h-8"
          fill="none"
          stroke="#5a3a08"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </>
    ),
    scrap: (
      <>
        <path
          d="M24 3l17 10v22L24 45 7 35V13z"
          fill="url(#g-steel)"
          stroke="#222a36"
          strokeWidth="2"
        />
        <path
          d="M24 3v20L7 13M24 23l17-10M24 23v22"
          stroke="#222a36"
          strokeWidth="1.5"
          fill="none"
        />
        <circle cx="24" cy="23" r="4" fill="url(#g-dark)" stroke="#222a36" strokeWidth="1.5" />
      </>
    ),
    glory: (
      <>
        <circle cx="24" cy="24" r="19" fill="url(#g-red)" stroke="#4a0a10" strokeWidth="2" />
        <polygon
          points={star(24, 24.5, 13, 5.5, 5)}
          fill="url(#g-gold)"
          stroke="#5a3a08"
          strokeWidth="1.5"
        />
      </>
    ),
    lock: (
      <>
        <path d="M15 22v-6a9 9 0 0118 0v6" fill="none" stroke="url(#g-steel)" strokeWidth="4" />
        <rect
          x="9"
          y="22"
          width="30"
          height="21"
          rx="3"
          fill="url(#g-gold)"
          stroke="#5a3a08"
          strokeWidth="2"
        />
        <circle cx="24" cy="31" r="3.5" fill="#3a2406" />
        <path d="M24 33v5" stroke="#3a2406" strokeWidth="3" />
      </>
    ),
    sort: (
      <path
        d="M8 12h32M8 24h22M8 36h12"
        stroke="url(#g-steel)"
        strokeWidth="5"
        strokeLinecap="round"
      />
    ),
    close: (
      <path
        d="M12 12l24 24M36 12L12 36"
        stroke="url(#g-steel)"
        strokeWidth="5"
        strokeLinecap="round"
      />
    ),
  };
  return (
    <svg viewBox="0 0 48 48" aria-hidden>
      {art[name]}
    </svg>
  );
}
