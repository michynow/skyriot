import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BufferAttribute, BufferGeometry, type LineSegments } from 'three';
import { session } from '../net/session';
import { useSettings } from '../ui/settings';

/** Wireframe of the local prediction sim's static colliders (sim.debugLines()). */
export default function PhysicsDebug() {
  const on = useSettings((s) => s.physicsDebug);
  const geo = useRef(new BufferGeometry());
  const lines = useRef<LineSegments>(null);
  const clock = useRef(0);

  useEffect(() => {
    const g = geo.current;
    return () => g.dispose();
  }, []);

  useFrame((_, dt) => {
    clock.current += dt;
    if (!on || clock.current < 0.5) return;
    clock.current = 0;
    try {
      const data = session.sim?.debugLines();
      if (data) geo.current.setAttribute('position', new BufferAttribute(data, 3));
    } catch {
      /* sim stub */
    }
  });

  return on ? (
    <lineSegments ref={lines} geometry={geo.current} frustumCulled={false}>
      <lineBasicMaterial color="#00ff88" depthTest={false} />
    </lineSegments>
  ) : null;
}
