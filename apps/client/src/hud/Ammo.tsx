import { useShallow } from 'zustand/react/shallow';
import { WeaponIcon } from './icons';
import { useHud } from './hudStore';

/** Compact rounds counter beside the reticle: weapon icon, count, small name. */
export function Ammo({ side }: { side: 1 | 2 }) {
  const a = useHud(
    useShallow((h) =>
      side === 1
        ? { n: h.ammo1, max: h.ammoMax1, name: h.weapon1, id: h.weaponId1, mode: '' }
        : { n: h.ammo2, max: h.ammoMax2, name: h.weapon2, id: h.toggles.bombing ?? h.weaponId2, mode: h.toggles.bombing ?? '' },
    ),
  );
  const low = a.n / Math.max(1, a.max) < 0.2;
  return (
    <div className={`ammo a${side} ${low ? 'low' : ''}`}>
      <WeaponIcon id={a.id} />
      <b>{Math.round(a.n)}</b>
      <small>{a.mode ? (a.mode === 'air-barrage-mode' ? 'AIR BARRAGE' : 'GROUND STRIKE') : a.name}</small>
      {a.n <= 0 && <span className="resup">RESUPPLY AT LAUNCH DECK</span>}
    </div>
  );
}
