import type { FrameId } from '@skyriot/shared';
import './controls.css';

const BINDINGS: [key: string, action: string][] = [
  ['MOUSE', 'steer / aim'],
  ['LMB · RMB', 'fire Primary / Secondary'],
  ['W · S', 'throttle'],
  ['A · D', 'strafe — double-tap to Barrel Roll'],
  ['Q · E', 'descend / climb'],
  ['SPACE', 'boost'],
  ['SHIFT', 'brake'],
  ['TAB', 'cycle Target'],
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
          <b>BULWARK</b> hold Shift or Q near ground to land · W/S drive while Grounded · E or Space
          lifts off · Hotbar 1 = Siege Anchor (first-person gunner)
        </p>
      )}
    </div>
  );
}
