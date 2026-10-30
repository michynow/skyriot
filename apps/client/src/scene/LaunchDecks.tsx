import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { LaunchDeck, MapDef, NationId } from '@skyriot/shared';
import { Bricks, SLOTS } from '../frames/bricks';
import { PALETTES, getMaterials } from '../frames/palette';
import { world } from '../state/world';

/** One deck's brick-kit geometry, merged per material slot. Local origin = centre of the deck's top surface. */
function buildDeck(nation: NationId, R: number) {
  const b = new Bricks();
  // layered hull: wide slab, studded rim blocks, tapered belly
  b.cyl('primary', R, 3, [0, -1.5, 0], { axis: 'y', seg: 40 });
  b.cyl('dark', R * 0.93, 0.5, [0, -3.2, 0], { axis: 'y', seg: 40 });
  b.cyl('dark', R * 0.55, 5, [0, -5.5, 0], { axis: 'y', r2: R * 0.35, seg: 24 });
  const n = 36;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const x = Math.sin(a) * (R - 1), z = Math.cos(a) * (R - 1);
    b.box(i % 3 === 0 ? 'secondary' : 'primary', [(2 * Math.PI * R) / n * 0.85, 1.4, 2.2], [x, 0.7, z], { rot: [0, a, 0], studs: i % 2 === 0 });
    // landing lights between the blocks
    const a2 = a + Math.PI / n;
    b.box('accent', [0.5, 0.35, 0.5], [Math.sin(a2) * (R - 1), 1.5, Math.cos(a2) * (R - 1)], { rot: [0, a2, 0] });
  }
  // pad + inner lights
  b.cyl('dark', R * 0.82, 0.3, [0, 0.15, 0], { axis: 'y', seg: 40 });
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    b.box('accent', [1.2, 0.12, 0.5], [Math.sin(a) * R * 0.72, 0.36, Math.cos(a) * R * 0.72], { rot: [0, a, 0] });
  }
  // emblem (original, simple geometry)
  const e = R * 0.42;
  if (nation === 'concord') {
    // gold chevron + sun-disc: two bars forming an up-arrow over a ring
    b.box('primary', [e * 1.5, 0.14, e * 0.28], [-e * 0.42, 0.37, e * 0.12], { rot: [0, 0.75, 0] });
    b.box('primary', [e * 1.5, 0.14, e * 0.28], [e * 0.42, 0.37, e * 0.12], { rot: [0, -0.75, 0] });
    b.cyl('secondary', e * 0.3, 0.14, [0, 0.37, e * 0.62], { axis: 'y', seg: 20 });
  } else {
    // vex: red saltire inside a square frame
    b.box('primary', [e * 2.0, 0.14, e * 0.3], [0, 0.37, 0], { rot: [0, Math.PI / 4, 0] });
    b.box('primary', [e * 2.0, 0.14, e * 0.3], [0, 0.37, 0], { rot: [0, -Math.PI / 4, 0] });
    b.box('secondary', [e * 0.45, 0.16, e * 0.45], [0, 0.38, 0]);
  }
  // hover thrusters underneath
  const th: [number, number][] = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    th.push([Math.sin(a) * R * 0.62, Math.cos(a) * R * 0.62]);
  }
  for (const [x, z] of th) {
    b.cyl('dark', 2.4, 3, [x, -4.2, z], { axis: 'y', r2: 3, seg: 14 });
    b.cyl('accent', 2.0, 0.2, [x, -5.8, z], { axis: 'y', seg: 14 });
  }
  // resupply gantry on the rim: tower, boom over the pad, hanging hose
  const gx = R * 0.9;
  b.box('secondary', [3, 16, 3], [gx, 8, 0], { studs: true });
  b.box('dark', [R * 0.5, 1.6, 2], [gx - R * 0.25, 15.5, 0], { studs: true });
  b.box('accent', [0.8, 0.8, 0.8], [gx - R * 0.5, 14.4, 0]);
  b.cyl('dark', 0.35, 9, [gx - R * 0.48, 10, 0], { axis: 'y', seg: 8 });
  b.wedge('primary', [3, 3, 6], [gx, 17.5, 0]);
  return b.build();
}

const cache = new Map<string, ReturnType<typeof buildDeck>>();
const pillarGeo = new THREE.CylinderGeometry(1.2, 2.4, 1, 12, 1, true).translate(0, 0.5, 0);
const pillarMats = new Map<NationId, THREE.MeshBasicMaterial>();
function pillarMat(n: NationId) {
  let m = pillarMats.get(n);
  if (!m) {
    const c = new THREE.Color(PALETTES[n].accent).multiplyScalar(1.6);
    m = new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false, side: THREE.DoubleSide });
    pillarMats.set(n, m);
  }
  return m;
}
const ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#9dffc8').multiplyScalar(2.5), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });

function Deck({ nation, deck }: { nation: NationId; deck: LaunchDeck }) {
  const R = deck.radius;
  const geos = useMemo(() => {
    const k = `${nation}|${R}`;
    let g = cache.get(k);
    if (!g) cache.set(k, (g = buildDeck(nation, R)));
    return g;
  }, [nation, R]);
  const mats = useMemo(() => getMaterials(nation, 4), [nation]);
  const ring = useRef<THREE.Mesh>(null);
  const beacon = useRef<THREE.Mesh>(null);
  useFrame(({ clock, camera }) => {
    const s = world.ownId ? world.ships.get(world.ownId) : undefined;
    const docked = !!s && s.docked && s.nation === nation &&
      Math.hypot(s.pos[0] - deck.pos[0], s.pos[2] - deck.pos[2]) < R && Math.abs(s.pos[1] - deck.pos[1]) < 40;
    if (ring.current) {
      ring.current.visible = docked;
      const p = 1 + 0.04 * Math.sin(clock.elapsedTime * 4);
      ring.current.scale.set(p, p, 1);
    }
    if (beacon.current) { const d = camera.position.distanceTo(beacon.current.position.set(deck.pos[0], deck.pos[1] + 4, deck.pos[2])); beacon.current.position.set(0, 4, 0); const k = Math.min(14, Math.max(0.8, d * 0.0035)) * (1 + 0.1 * Math.sin(clock.elapsedTime * 2)); beacon.current.scale.set(k, 900, k); }
  });
  return (
    <group position={deck.pos}>
      {SLOTS.map((s) => {
        const g = geos[s];
        return g ? <mesh key={s} geometry={g} material={mats[s]} castShadow receiveShadow /> : null;
      })}
      <mesh ref={ring} geometry={ringGeo(R)} material={ringMat} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.6, 0]} visible={false} />
      <mesh ref={beacon} geometry={pillarGeo} material={pillarMat(nation)} position={[0, 4, 0]} scale={[1, 900, 1]} renderOrder={12} />
    </group>
  );
}

const ringGeos = new Map<number, THREE.TorusGeometry>();
function ringGeo(R: number) {
  let g = ringGeos.get(R);
  if (!g) ringGeos.set(R, (g = new THREE.TorusGeometry(R * 0.82, 0.5, 8, 64)));
  return g;
}

/** Floating Launch Decks (brick-kit platforms) with beacon pillars and a dock ring. */
export function LaunchDecks({ map }: { map: MapDef }) {
  const decks = map.launchDecks;
  if (!decks) return null;
  return (
    <>
      {(Object.keys(decks) as NationId[]).flatMap((n) =>
        decks[n].map((d, i) => <Deck key={`${n}${i}`} nation={n} deck={d} />),
      )}
    </>
  );
}
