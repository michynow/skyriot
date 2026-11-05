import { useEffect, useRef } from 'react';
import { FRAMES, STRUCTURES } from '@skyriot/shared';
import { world } from '../state/world';
import { inputState } from '../input/input';
import { ownShip, structureName } from './hudStore';

/** Top-of-screen window for the selected Target: name, Frame, HP and shield bars, distance. Updated per frame. */
export function TargetWindow() {
  const root = useRef<HTMLDivElement>(null);
  const name = useRef<HTMLElement>(null);
  const sub = useRef<HTMLElement>(null);
  const hp = useRef<HTMLElement>(null);
  const sh = useRef<HTMLElement>(null);
  const dist = useRef<HTMLElement>(null);

  useEffect(() => {
    let raf = 0;
    const text = (el: HTMLElement | null, t: string) => {
      if (el && el.textContent !== t) el.textContent = t;
    };
    const frame = () => {
      raf = requestAnimationFrame(frame);
      const el = root.current;
      const own = ownShip();
      const id = inputState.targetId;
      const ship = id ? world.ships.get(id) : undefined;
      const st = id && !ship ? world.structures.get(id) : undefined;
      if (!el) return;
      if (!own || !(ship || st)) {
        el.style.display = 'none';
        return;
      }
      el.style.display = 'block';
      const pos = (ship ?? st)!.pos;
      const d = Math.hypot(pos[0] - own.pos[0], pos[1] - own.pos[1], pos[2] - own.pos[2]);
      text(name.current, ship ? ship.name : structureName(st!));
      text(sub.current, ship ? FRAMES[ship.frame].name.toUpperCase() : 'BASE');
      text(dist.current, `${Math.round(d)} m`);
      const maxHp = ship ? ship.maxHp : STRUCTURES[st!.kind].maxHp;
      if (hp.current)
        hp.current.style.width = `${(100 * (ship ? ship.hp : st!.hp)) / Math.max(1, maxHp)}%`;
      if (sh.current) {
        sh.current.parentElement!.style.display = ship && ship.maxShield > 0 ? 'block' : 'none';
        if (ship) sh.current.style.width = `${(100 * ship.shield) / Math.max(1, ship.maxShield)}%`;
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="twin" ref={root} style={{ display: 'none' }}>
      <div className="twin-top">
        <b ref={name} />
        <small ref={sub} />
        <span ref={dist} />
      </div>
      <div className="twin-bar sh">
        <i ref={sh} />
      </div>
      <div className="twin-bar hp">
        <i ref={hp} />
      </div>
    </div>
  );
}
