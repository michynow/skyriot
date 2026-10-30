import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useHud } from './hudStore';
import { NATION_COLOR } from './Reticles';

const tunnelName = (i: number) => `TUNNEL ${String.fromCharCode(65 + Math.max(0, i))}`;
const ordinal = (n: number) =>
  `${n}${n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'}`;

/**
 * Everything between dying and flying: the death screen hands over to the Launch Queue (hangar -> tunnel staging
 * -> catapult ready -> launch flash). Without a Launch Queue (launchPhase 'none') the plain respawn timer shows.
 */
export function Launch() {
  const h = useHud(
    useShallow((x) => ({
      alive: x.alive,
      respawnIn: x.respawnIn,
      crashed: x.crashed,
      phase: x.launchPhase,
      queuePos: x.queuePos,
      tunnel: x.tunnel,
      launchSec: x.launchSec,
      ahead: x.queueAhead,
      flash: x.launchFlashNonce,
      diedAt: x.diedAtMs,
      nation: x.nation,
      battlePhase: x.battlePhase,
    })),
  );
  // The hangar overlay opens red (death) and settles into its own dark within ~1.5 s.
  const [fresh, setFresh] = useState(false);
  useEffect(() => {
    if (h.phase !== 'hangar') return;
    const age = performance.now() - h.diedAt;
    if (age > 2500) return;
    setFresh(true);
    const t = setTimeout(() => setFresh(false), 2500 - age);
    return () => clearTimeout(t);
  }, [h.phase, h.diedAt]);

  const [flashOn, setFlashOn] = useState(false);
  useEffect(() => {
    if (!h.flash) return;
    setFlashOn(true);
    const t = setTimeout(() => setFlashOn(false), 1200);
    return () => clearTimeout(t);
  }, [h.flash]);

  if (h.battlePhase === 'ended') return null;
  const accent = h.nation ? NATION_COLOR[h.nation] : '#7fe7ff';
  const style = { ['--c' as string]: accent };
  if (h.phase === 'catapult' || flashOn) {
    return (
      <div
        key={h.flash}
        className={`lq-flash ${h.phase === 'catapult' ? 'hold' : ''}`}
        style={style}
      >
        LAUNCH
      </div>
    );
  }

  if (h.phase === 'hangar') {
    const pos = h.queuePos >= 0 ? h.queuePos : h.ahead.length;
    return (
      <div className={`launch hangar ${fresh ? 'fresh' : ''}`} style={style}>
        <div className="lq-panel">
          <h2>IN HANGAR</h2>
          <p className="lq-pos">
            {pos === 0 ? (
              <>
                <b>NEXT OUT</b> <span>a Launch Tunnel is being cleared for you</span>
              </>
            ) : (
              <>
                <b>{ordinal(pos + 1)}</b> <span>in the Launch Queue</span>
              </>
            )}
          </p>
          {h.ahead.length > 0 && (
            <ol className="lq-list">
              {h.ahead.slice(0, 6).map((name, i) => (
                <li key={`${name}${i}`}>
                  <i style={{ opacity: 1 - i * 0.12 }} />
                  {name}
                </li>
              ))}
              {h.ahead.length > 6 && <li className="more">+{h.ahead.length - 6} more</li>}
            </ol>
          )}
          <div className="lq-strip" aria-hidden>
            {Array.from({ length: Math.min(8, pos + 1) }, (_, i) => (
              <i key={i} className={i === pos ? 'you' : ''} />
            ))}
          </div>
          <p className="lq-hint">Launch Tunnels throw one Ship each every few seconds</p>
        </div>
      </div>
    );
  }
  if (h.phase === 'staging') {
    return (
      <div className="launch staging" style={style}>
        <div className="lq-stage">
          <h2>{tunnelName(h.tunnel)}</h2>
          <p>DOORS OPENING</p>
          <b className="lq-count">{h.launchSec.toFixed(1)}</b>
          <div className="lq-lights">
            {Array.from({ length: 9 }, (_, i) => (
              <i key={i} style={{ animationDelay: `${i * 0.08}s` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }
  if (h.phase === 'ready') {
    return (
      <div className="launch ready" style={style}>
        <div className="lq-ready">
          <small>{tunnelName(h.tunnel)}</small>
          <h2>CATAPULT READY</h2>
          <p>
            FULL THROTTLE <kbd>W</kbd>
          </p>
        </div>
      </div>
    );
  }
  if (!h.alive) {
    return (
      <div className="respawn">
        <h2>SHIP DESTROYED</h2>
        {h.crashed && <p className="crash">Crashed into terrain</p>}
        <p>Redeploying in {h.respawnIn.toFixed(1)}s</p>
      </div>
    );
  }
  return null;
}
