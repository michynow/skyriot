import type { FrameId } from '@skyriot/shared';
import './controls.css';

const BINDINGS: [key: string, action: string][] = [
  ['MOUSE', 'steer / aim'],
  ['LMB · RMB', 'fire Primary / Secondary'],
  ['W · S', 'throttle up / down to a stop (hover in place)'],
  ['A · D', 'strafe — double-tap to Barrel Roll'],
  ['Q · E', 'descend / climb'],
  ['SPACE', 'boost'],
  ['SHIFT', 'lock / change lock to the Target nearest the crosshair (Siege: drop the gun lock)'],
  ['TAB', 'next Hotbar set (F1–F3 pick)'],
  ['C', 'land (Launch Deck in range; Bulwark: ground) · Bulwark: C again lifts off'],
  ['X', 'look behind'],
  ['B', 'engine off, frozen in place + Loadout (confirm B / Y); W or boost restarts'],
  ['1 – 0', 'Hotbar'],
  ['ALT', 'free look'],
  ['R', 'launch from Launch Deck'],
  ['ENTER', 'chat'],
  ['M', 'mute'],
  ['ESC', 'menu'],
];

/** Key reference shared by the hangar footer and the in-flight menu. */
export function Controls({ frame, compact = false }: { frame: FrameId | null; compact?: boolean }) {
  return (
    <div className={`controls ${compact ? 'compact' : ''}`}>
      {BINDINGS.map(([key, action]) => (
        <span key={key} className="ctl">
          <kbd>{key}</kbd>
          <em>{action}</em>
        </span>
      ))}
      {frame === 'bulwark' && (
        <p className="ctl-note">
          <b>BULWARK</b> C lands on the terrain below · WASD drive while Grounded · C lifts off ·
          Hotbar 1 = Siege Anchor (first-person gunner)
        </p>
      )}
    </div>
  );
}
