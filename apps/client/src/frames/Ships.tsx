import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import type * as THREE from 'three';
import type { FrameId, NationId, ShipId } from '@skyriot/shared';
import { world } from '../state/world';
import { FrameModel } from './FrameModel';

interface Entry {
  id: ShipId;
  frame: FrameId;
  nation: NationId;
  tier: number;
  upgrade: number;
}

/** Syncs one group per Ship in `world.ships`; React only re-renders when the roster/look changes. */
export function Ships() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const known = useRef(new Map<ShipId, Entry>());
  const groups = useRef(new Map<ShipId, THREE.Group>());

  useFrame(() => {
    let changed = world.ships.size !== known.current.size;
    if (!changed) {
      for (const s of world.ships.values()) {
        const k = known.current.get(s.id);
        if (!k || k.frame !== s.frame || k.nation !== s.nation || k.tier !== s.tier || k.upgrade !== s.upgrade) {
          changed = true;
          break;
        }
      }
    }
    if (changed) {
      const next: Entry[] = [];
      known.current.clear();
      for (const s of world.ships.values()) {
        const e = { id: s.id, frame: s.frame, nation: s.nation, tier: s.tier, upgrade: s.upgrade };
        known.current.set(s.id, e);
        next.push(e);
      }
      setEntries(next);
    }
    for (const [id, g] of groups.current) {
      const s = world.ships.get(id);
      if (!s) continue;
      g.visible = s.alive;
      g.position.set(s.pos[0], s.pos[1], s.pos[2]);
      g.quaternion.set(s.rot[0], s.rot[1], s.rot[2], s.rot[3]);
    }
  });

  return (
    <>
      {entries.map((e) => (
        <group
          key={e.id}
          ref={(g) => {
            if (g) groups.current.set(e.id, g);
            else groups.current.delete(e.id);
          }}
        >
          <FrameModel frame={e.frame} nation={e.nation} tier={e.tier} upgrade={e.upgrade} shipId={e.id} />
        </group>
      ))}
    </>
  );
}
