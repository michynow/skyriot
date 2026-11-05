import { useShallow } from 'zustand/react/shallow';
import type { NationId } from '@skyriot/shared';
import { NATION_NAME, enemyOf, useHud, type BaseView } from './hudStore';
import { NATION_COLOR } from './Reticles';

function Base({ nation, b, side }: { nation: NationId; b: BaseView; side: 'ours' | 'theirs' }) {
  const corePct = Math.max(0, Math.min(1, b.coreHp / Math.max(1, b.coreMax)));
  return (
    <div className={`base ${side}`} style={{ ['--c' as string]: NATION_COLOR[nation] }}>
      <div className="base-head">
        <b>{NATION_NAME[nation]}</b>
        <span className={`shield ${b.shield ? 'up' : 'down'}`}>
          <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden>
            <path d="M8 1.5 14 4v4c0 3.4-2.6 5.8-6 6.5C4.6 13.8 2 11.4 2 8V4z" />
          </svg>
          {b.shield ? 'SHIELD UP' : 'SHIELD DOWN'}
        </span>
      </div>
      <div className="base-row">
        <span className="pips" title="Shield Stations">
          {b.stations.map((alive, i) => (
            <i key={i} className={alive ? 'on' : ''} />
          ))}
        </span>
        <span
          className={`core ${corePct < 0.3 ? 'low' : ''} ${!b.shield ? 'exposed' : ''}`}
          title="Core HP"
        >
          <i style={{ width: `${corePct * 100}%` }} />
        </span>
        <span className="turrets" title="Turrets left">
          {b.turretsAlive}/{b.turretsTotal}
        </span>
      </div>
    </div>
  );
}

/** Top-centre battle panel: both Bases (shield, Shield Station pips, Core HP, Turrets) and the objective line. */
export function Objectives() {
  const h = useHud(
    useShallow((x) => ({
      nation: x.nation,
      bases: x.bases,
      objective: x.objective,
      warn: x.defenseWarn,
      phase: x.battlePhase,
    })),
  );
  if (!h.nation || h.phase === 'ended') return null;
  const me = h.nation;
  const en = enemyOf(me);
  const attack = !h.bases[en].shield;
  return (
    <div className="objectives">
      <div className="obj-bases">
        <Base nation={me} b={h.bases[me]} side="ours" />
        <div className="obj-vs">VS</div>
        <Base nation={en} b={h.bases[en]} side="theirs" />
      </div>
      <div className={`obj-line ${h.warn ? 'warn' : attack ? 'attack' : ''}`}>
        {h.warn || h.objective}
      </div>
    </div>
  );
}

/** Centre banner for Battle events (shield down, station destroyed, battle begins). */
export function BattleBanner() {
  const banner = useHud((x) => x.banner);
  if (!banner) return null;
  return (
    <div key={banner.nonce} className={`battle-banner ${banner.kind}`}>
      <b>{banner.text}</b>
      <span>{banner.sub}</span>
    </div>
  );
}

export function BattleEnd() {
  const h = useHud(
    useShallow((x) => ({
      phase: x.battlePhase,
      winner: x.winner,
      nation: x.nation,
      restartIn: x.restartIn,
    })),
  );
  if (h.phase !== 'ended' || !h.nation) return null;
  const won = h.winner === h.nation;
  return (
    <div className={`battle-end ${won ? 'won' : 'lost'}`}>
      <h1>{won ? 'VICTORY' : 'DEFEAT'}</h1>
      <p>{won ? 'The enemy Core has fallen.' : 'Our Core has fallen.'}</p>
      <p className="next">
        Next Battle in <b>{Math.ceil(h.restartIn)}</b> s
      </p>
    </div>
  );
}
