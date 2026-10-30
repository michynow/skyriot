import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PerspectiveCamera, View } from '@react-three/drei';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { FRAMES, type FrameId, type NationId } from '@skyriot/shared';
import { FrameModel } from '../frames/FrameModel';
import { setShipEnv } from '../frames/palette';

function ShipEnv() {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    const pm = new THREE.PMREMGenerator(gl);
    const env = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    setShipEnv(env);
    return () => {
      setShipEnv(null);
      env.dispose();
      pm.dispose();
    };
  }, [gl]);
  return null;
}

function Turntable({ speed, children }: { speed: number; children: ReactNode }) {
  const g = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (g.current) g.current.rotation.y += dt * speed;
  });
  return (
    <group ref={g} rotation={[0, 0.6, 0]}>
      {children}
    </group>
  );
}

/**
 * One slowly turning Ship drawn into the tracked DOM element. All stages share the single hangar Canvas,
 * so the Frame list thumbnails cost one WebGL context in total.
 */
export function ShipStage({
  frame,
  nation,
  track,
  speed = 0.35,
}: {
  frame: FrameId;
  nation: NationId;
  track: RefObject<HTMLElement | null>;
  speed?: number;
}) {
  const def = FRAMES[frame];
  const dist = Math.max(def.halfLength, def.radius) * 3.1;
  return (
    <View track={track as RefObject<HTMLElement>}>
      <PerspectiveCamera
        makeDefault
        fov={28}
        position={[-dist * 0.8, dist * 0.42, -dist * 0.9]}
        onUpdate={(c) => c.lookAt(0, -def.radius * 0.1, 0)}
      />
      <hemisphereLight args={['#dfe9ff', '#2a1a10', 0.9]} />
      <directionalLight position={[-6, 10, -8]} intensity={2.2} color="#fff2dc" />
      <directionalLight position={[8, 2, 6]} intensity={0.8} color="#5fe3ff" />
      <Turntable speed={speed}>
        <FrameModel frame={frame} nation={nation} tier={1} upgrade={0} boosting={false} />
      </Turntable>
    </View>
  );
}

/** Full-viewport transparent Canvas behind the hangar UI; mount ShipStages inside. */
export function HangarCanvas({ children }: { children: ReactNode }) {
  return (
    <Canvas
      className="lb-canvas"
      gl={{ alpha: true, antialias: true }}
      dpr={[1, 1.5]}
      style={{ position: 'fixed', inset: 0, pointerEvents: 'none' }}
    >
      <ShipEnv />
      {children}
    </Canvas>
  );
}
