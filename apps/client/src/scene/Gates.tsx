import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { MAPS, type GateDef, type MapDef } from '@skyriot/shared';
import { PALETTES } from '../frames/palette';

const NEUTRAL = '#7fe3c8';

/** Gate colour: the destination City's Nation accent, or neutral for a warzone. */
function gateColor(to: string): string {
  const city = MAPS[to]?.city;
  return city ? PALETTES[city].accent : NEUTRAL;
}

/** One Gate: a slow-spinning ring standing upright, facing the map centre, with a shimmering membrane. */
function Gate({ gate }: { gate: GateDef }) {
  const ring = useRef<THREE.Group>(null);
  const film = useRef<THREE.MeshBasicMaterial>(null);
  const color = gateColor(gate.to);
  const R = gate.radius;
  const yaw = Math.atan2(-gate.pos[0], -gate.pos[2]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (ring.current) ring.current.rotation.z = t * 0.25;
    if (film.current) film.current.opacity = 0.22 + Math.sin(t * 2.2) * 0.08;
  });
  return (
    <group position={gate.pos} rotation={[0, yaw, 0]}>
      <group ref={ring}>
        <mesh>
          <torusGeometry args={[R, R * 0.06, 12, 64]} />
          <meshStandardMaterial color="#20242c" metalness={0.8} roughness={0.35} />
        </mesh>
        <mesh>
          <torusGeometry args={[R * 0.93, R * 0.025, 8, 64]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
        {Array.from({ length: 8 }, (_, i) => {
          const a = (i / 8) * Math.PI * 2;
          return (
            <mesh key={i} position={[Math.cos(a) * R, Math.sin(a) * R, 0]} rotation={[0, 0, a]}>
              <boxGeometry args={[R * 0.12, R * 0.2, R * 0.16]} />
              <meshBasicMaterial color={color} toneMapped={false} />
            </mesh>
          );
        })}
      </group>
      <mesh>
        <circleGeometry args={[R * 0.92, 48]} />
        <meshBasicMaterial
          ref={film}
          color={color}
          transparent
          opacity={0.25}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

export function Gates({ map }: { map: MapDef }) {
  return (
    <>
      {map.gates?.map((g, i) => (
        <Gate key={i} gate={g} />
      ))}
    </>
  );
}
