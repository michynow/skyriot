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
        {lin('g-steel', [[0, '#f2f6fb'], [0.45, '#97a4b5'], [1, '#3a4455']])}
        {lin('g-dark', [[0, '#8794a6'], [1, '#222a36']])}
        {lin('g-gold', [[0, '#fff6c0'], [0.5, '#f4b92c'], [1, '#8a5608']])}
        {lin('g-fire', [[0, '#fff8b8'], [0.4, '#ffa11f'], [1, '#e1301a']])}
        {lin('g-blue', [[0, '#c8f0ff'], [0.5, '#3da6ff'], [1, '#1a47a6']])}
        {lin('g-cyan', [[0, '#f0ffff'], [0.5, '#5ff0ff'], [1, '#1b8fb0']])}
        {lin('g-green', [[0, '#e0ffd8'], [0.5, '#4cf06a'], [1, '#17803a']])}
        {lin('g-red', [[0, '#ffc2b0'], [0.5, '#ff4a3a'], [1, '#85120e']])}
        {lin('g-magenta', [[0, '#ffffff'], [0.5, '#ff6ad5'], [1, '#86197a']])}
        {lin('g-yellow', [[0, '#ffffe0'], [0.5, '#ffd83a'], [1, '#d07f08']])}
        {lin('g-rust', [[0, '#d9946a'], [1, '#6a3a22']])}
        {rad('bg-red', [[0, '#8a2424'], [1, '#2a0a0e']])}
        {rad('bg-blue', [[0, '#2a5fa6'], [1, '#09162e']])}
        {rad('bg-green', [[0, '#26894e'], [1, '#082a18']])}
        {rad('bg-gold', [[0, '#9a7620'], [1, '#2a1c06']])}
      </defs>
    </svg>
  );
}

type Category = 'red' | 'blue' | 'green' | 'gold';
const star = (cx: number, cy: number, r1: number, r2: number, n: number) =>
  Array.from({ length: n * 2 }, (_, i) => {
    const a = (i * Math.PI) / n - Math.PI / 2;
    const r = i % 2 ? r2 : r1;
    return `${(cx + Math.cos(a) * r).toFixed(1)},${(cy + Math.sin(a) * r).toFixed(1)}`;
  }).join(' ');

function bomb(x: number, y: number, k = 1): ReactElement {
  return (
    <g key={`${x}${y}`} transform={`translate(${x} ${y}) scale(${k})`}>
      <path d="M-3 -6C-6 -12 0 -18 3 -6z" fill="url(#g-fire)" />
      <path d="M-4 -4h8v9c0 3-2 6-4 6s-4-3-4-6z" fill="url(#g-steel)" stroke="#fff8" strokeWidth=".6" />
      <path d="M-4 6c0-1 8-1 8 0 0 3-2 5-4 5s-4-2-4-5z" fill="url(#g-red)" />
      <path d="M-4 -4l-3-2v5zM4 -4l3-2v5z" fill="url(#g-dark)" />
    </g>
  );
}

const SKILL: Record<string, { cat: Category; art: ReactNode }> = {
  flares: {
    cat: 'gold',
    art: (
      <>
        <polygon points={star(24, 24, 17, 6, 8)} fill="url(#g-magenta)" stroke="#ffd6f5" strokeWidth="1" />
        <circle cx="24" cy="24" r="6" fill="#fff" />
        <circle cx="24" cy="24" r="3" fill="#fffbd8" />
        <polygon points={star(9, 10, 5, 1.8, 4)} fill="#fff" />
        <polygon points={star(39, 38, 4.5, 1.6, 4)} fill="#ffb8ee" />
        <path d="M4 44l12-10M44 6L34 16" stroke="#ffffffaa" strokeWidth="1.5" strokeLinecap="round" />
      </>
    ),
  },
  'afterburn-dash': {
    cat: 'gold',
    art: (
      <>
        <path d="M34 5C20 13 9 28 3 45c16-6 32-17 41-31z" fill="url(#g-fire)" />
        <path d="M33 11C22 18 14 28 10 38c12-5 24-13 30-24z" fill="url(#g-blue)" opacity=".92" />
        <path d="M31 15C24 21 19 28 17 33c8-3 15-9 18-16z" fill="#fff" opacity=".85" />
        <circle cx="35" cy="13" r="8" fill="url(#g-fire)" />
        <circle cx="35" cy="13" r="4.5" fill="#fff" />
        <path d="M44 24l-8 1M40 32l-7-2M26 3l-1 8" stroke="#ffd070" strokeWidth="2" strokeLinecap="round" />
      </>
    ),
  },
  'ghost-skin': {
    cat: 'blue',
    art: (
      <>
        <path d="M27 9l6 12 13 10v4L33 32l-2 12-4-2-3 3-3-3-4 2-2-12L5 35v-4l13-10 6-12z" fill="url(#g-cyan)" opacity=".22" transform="translate(3 3)" />
        <path d="M24 5l6 14 14 11v5L30 31l-2 12-4-3-4 3-2-12L4 36v-5l14-11z" fill="url(#g-cyan)" opacity=".6" stroke="#d8ffff" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M24 9l3 10-3 6-3-6z" fill="#fff" opacity=".7" />
        <circle cx="24" cy="21" r="2.2" fill="#fff" />
      </>
    ),
  },
  'carpet-drop': {
    cat: 'red',
    art: (
      <>
        {[bomb(11, 16), bomb(24, 22), bomb(37, 28)]}
        <path d="M3 44c3-7 6-4 8-9 2 5 5 3 7 9 3-8 6-5 9-11 2 6 6 4 8 10 3-5 6-4 9-8v9z" fill="url(#g-fire)" />
        <path d="M10 44c2-4 4-3 5-6 2 3 3 3 5 6z" fill="#fff6b0" />
      </>
    ),
  },
  'iron-hide': {
    cat: 'blue',
    art: (
      <>
        <clipPath id="ih-c">
          <path d="M24 4l17 6v13c0 10-7 17-17 21C14 40 7 33 7 23V10z" />
        </clipPath>
        <path d="M24 4l17 6v13c0 10-7 17-17 21C14 40 7 33 7 23V10z" fill="url(#g-steel)" stroke="#fff" strokeWidth="1.2" />
        <path d="M24 9l12 4.5v9c0 7-5 12-12 15-7-3-12-8-12-15v-9z" fill="url(#g-dark)" />
        <g clipPath="url(#ih-c)">
          <path d="M-4 30L30 -4l8 0L2 40z" fill="#fff" opacity=".35" />
        </g>
        {[[13, 14], [35, 14], [14, 30], [34, 30]].map(([x, y]) => (
          <g key={`${x}${y}`}>
            <circle cx={x} cy={y} r="2.4" fill="url(#g-steel)" stroke="#222a36" strokeWidth=".6" />
            <circle cx={x! - 0.7} cy={y! - 0.7} r=".8" fill="#fff" />
          </g>
        ))}
        <path d="M24 12v22M16 22h16" stroke="#0008" strokeWidth="2" />
      </>
    ),
  },
  'mend-beam': {
    cat: 'green',
    art: (
      <>
        <path d="M4 44L28 16l8 7z" fill="url(#g-green)" opacity=".55" />
        <path d="M6 43L27 19l5 5z" fill="#d8ffd8" opacity=".85" />
        <path d="M7 42L26 21" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
        <path d="M35 6h6v7h7v6h-7v7h-6v-7h-7v-6h7z" fill="url(#g-green)" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round" transform="translate(-6 0)" />
        <path d="M32 9h2.5v5h-2.5z" fill="#fff" opacity=".7" transform="translate(-1 0)" />
        <circle cx="10" cy="40" r="3" fill="#fff" />
      </>
    ),
  },
  'aegis-bubble': {
    cat: 'blue',
    art: (
      <>
        <path d="M24 4l17 10v20L24 44 7 34V14z" fill="url(#g-gold)" opacity=".28" stroke="url(#g-gold)" strokeWidth="3" strokeLinejoin="round" />
        <path d="M24 12l10 6v12l-10 6-10-6V18z" fill="none" stroke="url(#g-gold)" strokeWidth="2" strokeLinejoin="round" />
        <path d="M24 4v8M41 14l-7 4M41 34l-7-4M24 44v-8M7 34l7-4M7 14l7 4" stroke="url(#g-gold)" strokeWidth="1.6" />
        <path d="M13 17l8-5" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" opacity=".8" />
        <circle cx="24" cy="24" r="4" fill="url(#g-yellow)" stroke="#fff" strokeWidth="1" />
      </>
    ),
  },
  'siege-anchor': {
    cat: 'red',
    art: (
      <>
        <g fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 12v26M11 18h14M7 30c0 8 6 11 11 11s11-3 11-11" stroke="#222a36" strokeWidth="6.5" />
          <path d="M18 12v26M11 18h14M7 30c0 8 6 11 11 11s11-3 11-11" stroke="url(#g-steel)" strokeWidth="4.5" />
          <circle cx="18" cy="8" r="4" stroke="#222a36" strokeWidth="5.5" />
          <circle cx="18" cy="8" r="4" stroke="url(#g-steel)" strokeWidth="3.5" />
        </g>
        <g transform="rotate(-22 26 22)">
          <rect x="24" y="17" width="21" height="9" rx="2" fill="url(#g-dark)" stroke="#fff6" strokeWidth=".8" />
          <rect x="40" y="15" width="6" height="13" rx="1.5" fill="url(#g-steel)" />
        </g>
        <polygon points={star(45, 10, 5, 2, 6)} fill="url(#g-fire)" />
      </>
    ),
  },
  'scrap-wall': {
    cat: 'blue',
    art: (
      <>
        <path d="M4 34h40v9H4z" fill="url(#g-dark)" />
        <path d="M5 12h38v6H5z" fill="url(#g-gold)" />
        <path d="M8 12l5 6M16 12l5 6M24 12l5 6M32 12l5 6M40 12l3 4" stroke="#1a1408" strokeWidth="2.4" />
        <path d="M5 20h17v13H5z" fill="url(#g-rust)" stroke="#fff4" strokeWidth=".8" />
        <path d="M24 20h19l-2 13H24z" fill="url(#g-steel)" stroke="#fff4" strokeWidth=".8" />
        <path d="M14 22l8 0-3 11H10z" fill="url(#g-dark)" opacity=".7" />
        {[[8, 23], [19, 23], [28, 23], [39, 23], [8, 30], [37, 30]].map(([x, y]) => (
          <circle key={`${x}${y}`} cx={x} cy={y} r="1.5" fill="#f4e3c8" stroke="#2a1a10" strokeWidth=".5" />
        ))}
        <path d="M6 20h36" stroke="#fff" strokeOpacity=".5" />
      </>
    ),
  },
  'repair-kit': {
    cat: 'green',
    art: (
      <>
        <path d="M9 41L35 13" stroke="#222a36" strokeWidth="7" strokeLinecap="round" />
        <path d="M9 41L35 13" stroke="url(#g-steel)" strokeWidth="5" strokeLinecap="round" />
        <path d="M33 7a7 7 0 1 1-5 11l5-4z" fill="url(#g-steel)" stroke="#222a36" strokeWidth="1.5" strokeLinejoin="round" transform="translate(4 0)" />
        <rect x="9" y="21" width="30" height="21" rx="3.5" fill="url(#g-steel)" stroke="#fff" strokeWidth="1.2" />
        <path d="M18 21v-3.5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2V21" fill="none" stroke="#222a36" strokeWidth="2.4" />
        <path d="M21.5 25h5v4.5H31v5h-4.5V39h-5v-4.5H17v-5h4.5z" fill="url(#g-red)" stroke="#fff" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M11 23h26" stroke="#fff" strokeOpacity=".6" />
      </>
    ),
  },
  'shield-kit': {
    cat: 'blue',
    art: (
      <>
        <ellipse cx="24" cy="24" rx="17" ry="19" fill="#3da6ff" opacity=".28" />
        <rect x="15" y="12" width="18" height="29" rx="5" fill="url(#g-blue)" stroke="#e6f6ff" strokeWidth="1.3" />
        <rect x="14" y="8" width="20" height="7" rx="2.5" fill="url(#g-steel)" stroke="#222a36" strokeWidth="1" />
        <rect x="20" y="3" width="8" height="6" rx="1.5" fill="url(#g-gold)" />
        <path d="M18 17v21" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" opacity=".55" />
        <path d="M27 17l-7 11h5l-3 10 10-14h-6z" fill="url(#g-yellow)" stroke="#fff" strokeWidth=".8" strokeLinejoin="round" />
        <path d="M16 36h16" stroke="#0a2a66" strokeWidth="2" />
      </>
    ),
  },
  'fuel-cell': {
    cat: 'gold',
    art: (
      <>
        <ellipse cx="24" cy="26" rx="18" ry="19" fill="#ffd83a" opacity=".3" />
        <rect x="13" y="12" width="22" height="30" rx="6" fill="url(#g-yellow)" stroke="#fff6c8" strokeWidth="1.3" />
        <rect x="17" y="6" width="14" height="8" rx="2.5" fill="url(#g-steel)" stroke="#222a36" strokeWidth="1" />
        <rect x="21" y="3" width="6" height="4" rx="1" fill="url(#g-dark)" />
        <rect x="18" y="18" width="12" height="17" rx="4" fill="#fffbe0" opacity=".85" />
        <path d="M24 20c4 5 5 7 5 9a5 5 0 0 1-10 0c0-2 1-4 5-9z" fill="url(#g-fire)" />
        <path d="M13 22h22M13 38h22" stroke="#7a4a08" strokeWidth="1.5" opacity=".7" />
        <path d="M16 15v24" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity=".55" />
      </>
    ),
  },
};

const BG: Record<Category, string> = { red: 'bg-red', blue: 'bg-blue', green: 'bg-green', gold: 'bg-gold' };
const RIM: Record<Category, string> = { red: '#ff7a6a', blue: '#6ab8ff', green: '#6aff9a', gold: '#ffd25a' };

export function SkillIcon({ id }: { id: string }) {
  const def = SKILL[id];
  return (
    <svg viewBox="0 0 48 48" className="skill-icon" aria-hidden>
      {def ? (
        <>
          <rect x="1" y="1" width="46" height="46" rx="5" fill={`url(#${BG[def.cat]})`} />
          <rect x="1.5" y="1.5" width="45" height="45" rx="4.5" fill="none" stroke={RIM[def.cat]} strokeOpacity=".55" strokeWidth="1" />
          <path d="M2 2h44v14C34 20 14 20 2 16z" fill="#fff" opacity=".08" />
          <g>{def.art}</g>
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
      <path d="M36 24l10 0M38 18l8-3M38 30l8 3" stroke="url(#g-cyan)" strokeWidth="2.6" strokeLinecap="round" />
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
      <path d="M2 13h30l5 3-5 3H2zM2 29h30l5 3-5 3H2z" fill="url(#g-steel)" stroke="#222a36" strokeWidth="1" />
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
      <rect x="5" y="9" width="38" height="30" rx="5" fill="url(#g-dark)" stroke="#9ae" strokeWidth="1" />
      {[15, 33].flatMap((x) => [18, 30].map((y) => <circle key={`${x}${y}`} cx={x} cy={y} r="5" fill="#0a1018" stroke="url(#g-steel)" strokeWidth="2" />))}
      {[15, 33].flatMap((x) => [18, 30].map((y) => <circle key={`e${x}${y}`} cx={x} cy={y} r="1.8" fill="url(#g-green)" />))}
    </>
  ),
  'brick-bomb': (
    <>
      <path d="M20 8h8l-1 6h-6z" fill="url(#g-steel)" />
      <ellipse cx="24" cy="28" rx="12" ry="15" fill="url(#g-fire)" stroke="#6a1408" strokeWidth="1.2" />
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
      <path d="M27 14Q36 2 45 26" fill="none" stroke="url(#g-gold)" strokeWidth="2" strokeDasharray="3 4" />
      <circle cx="45" cy="30" r="4.5" fill="url(#g-fire)" />
      <polygon points={star(17, 18, 6, 2.5, 6)} fill="url(#g-fire)" />
    </>
  ),
};

export function WeaponIcon({ id }: { id: string }) {
  return (
    <svg viewBox="0 0 48 48" className="wpn-icon" aria-hidden>
      {WEAPON[id] ?? <circle cx="24" cy="24" r="8" fill="#d8f4ff" />}
    </svg>
  );
}
