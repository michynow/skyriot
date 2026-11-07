import { useEffect, type ComponentType } from 'react';
import { useHud } from '../../hud/hudStore';
import { Character } from './Character';
import { Inventory } from './Inventory';
import { SkillBook } from './SkillBook';
import { Vendor } from './Vendor';
import { attachWindowKeys, useWindows, type WindowId } from './windows';
import './tokens.css';

const WINDOWS: Record<WindowId, ComponentType> = {
  character: Character,
  inventory: Inventory,
  skillbook: SkillBook,
  vendor: Vendor,
};

/** Renders the open RPG windows and owns their hotkeys (P / I / K / V, Esc closes the top one). */
export function WindowHost() {
  const stack = useWindows((s) => s.stack);
  const nation = useHud((h) => h.nation);
  useEffect(attachWindowKeys, []);
  return (
    <div className={`rpg-host rpg-ui ${nation ?? ''}`}>
      {(Object.keys(WINDOWS) as WindowId[])
        .filter((id) => stack.includes(id))
        .map((id) => {
          const W = WINDOWS[id];
          return <W key={id} />;
        })}
    </div>
  );
}
