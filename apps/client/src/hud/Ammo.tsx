import { useShallow } from 'zustand/react/shallow';
import { WeaponIcon } from './icons';
import { useHud } from './hudStore';

const MODE_LABEL: Record<string, string> = {
  'air-barrage-mode': 'AIR BARRAGE',
  'ground-strike-mode': 'GROUND STRIKE',
  'wide-lock-mode': 'WIDE LOCK',
};

/** One weapon row: icon, name, rounds, then heat bar (Primary) or reattack countdown (Secondary). */
function Ammo({ side }: { side: 1 | 2 }) {
  const a = useHud(
    useShallow((h) =>
      side === 1
        ? {
            n: h.ammo1,
            max: h.ammoMax1,
            name: h.weapon1,
            id: h.weaponId1,
            mode: '',
            heat: h.heat,
            hot: h.overheated,
            wait: 0,
          }
        : {
            n: h.ammo2,
            max: h.ammoMax2,
            name: h.weapon2,
            id: h.toggles.bombing ?? h.weaponId2,
            mode: h.toggles.bombing ?? '',
            heat: 0,
            hot: false,
            wait: h.advReadyIn,
          },
    ),
  );
  const low = a.n / Math.max(1, a.max) < 0.2;
  return (
    <div className={`ammo a${side} ${low ? 'low' : ''}`}>
      <WeaponIcon id={a.id} />
      <b>{Math.round(a.n)}</b>
      <small>{a.mode ? MODE_LABEL[a.mode] : a.name}</small>
      {side === 1 ? (
        <span className={`heat ${a.hot ? 'hot' : ''}`}>
          <i style={{ width: `${a.heat * 100}%` }} />
        </span>
      ) : (
        <span className={`adv ${a.wait > 0 ? '' : 'ready'}`}>
          {a.wait > 0 ? `${a.wait.toFixed(1)}s` : 'READY'}
        </span>
      )}
      {a.n <= 0 && <span className="resup">RESUPPLY AT LAUNCH DECK</span>}
    </div>
  );
}

/** Both weapons in one compact panel, left edge, vertically centred (keeps the crosshair area clear). */
export function WeaponPanel() {
  const siege = useHud((h) => (h.sieged ? (h.grounded ? 'GROUND SIEGE' : 'AIR SIEGE') : ''));
  const detail = siege.startsWith('G')
    ? '×1.5 DMG · RANGE ×1.4'
    : '×1.15 DMG · RANGE ×1.15 · LOCK ×1.4';
  return (
    <div className="wpanel">
      {siege && (
        <div className="siege">
          <b>{siege}</b>
          <small>{detail}</small>
        </div>
      )}
      <Ammo side={1} />
      <Ammo side={2} />
    </div>
  );
}
