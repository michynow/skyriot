import { useMemo } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mulberry32, sampleHeight, type Heightfield, type MapDef } from '@skyriot/shared';

function colored(g: THREE.BufferGeometry, hex: string) {
  const ng = g.index ? g.toNonIndexed() : g;
  ng.deleteAttribute('uv');
  const c = new THREE.Color(hex);
  const arr = new Float32Array(ng.getAttribute('position').count * 3);
  for (let i = 0; i < arr.length; i += 3) { arr[i] = c.r; arr[i + 1] = c.g; arr[i + 2] = c.b; }
  ng.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return ng;
}

function rockGeo() {
  const g = new THREE.IcosahedronGeometry(1, 1);
  const rnd = mulberry32(7);
  const p = g.getAttribute('position') as THREE.BufferAttribute;
  const seen = new Map<string, number>();
  for (let i = 0; i < p.count; i++) {
    const key = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
    let k = seen.get(key);
    if (k === undefined) { k = 0.75 + rnd() * 0.5; seen.set(key, k); }
    p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.8, p.getZ(i) * k);
  }
  const ng = g.toNonIndexed();
  ng.computeVertexNormals();
  return colored(ng, '#ffffff');
}

/** Butte: stacked tapered strata layers in banded reds. */
function butteGeo() {
  const cols = ['#7a3b27', '#a45a38', '#8a4630', '#b76c43', '#8f4a31', '#c27a4c'];
  const parts: THREE.BufferGeometry[] = [];
  let y = 0;
  const r0 = 1, h = 1 / cols.length;
  cols.forEach((c, i) => {
    const rb = r0 * (1 - i * 0.045), rt = r0 * (1 - (i + 1) * 0.045) * (i === cols.length - 1 ? 0.92 : 1);
    const g = new THREE.CylinderGeometry(rt * (1 + (i % 2) * 0.05), rb, h, 9, 1);
    g.translate(0, y + h / 2, 0);
    y += h;
    parts.push(colored(g, c));
  });
  return mergeGeometries(parts)!;
}

/** Derelict brick tower: broken stack of studded blocks with a leaning top. */
function towerGeo() {
  const rnd = mulberry32(21);
  const cols = ['#6b5f58', '#8a5a3c', '#4f5560', '#7a6a50', '#a4503a'];
  const parts: THREE.BufferGeometry[] = [];
  let y = 0;
  const floors = 7;
  for (let i = 0; i < floors; i++) {
    const w = 3.2 - i * 0.18, hh = 2.2 + rnd() * 0.5;
    const g = new THREE.BoxGeometry(w, hh, w);
    g.translate((rnd() - 0.5) * 0.15 * i, y + hh / 2, (rnd() - 0.5) * 0.15 * i);
    parts.push(colored(g, cols[i % cols.length]!));
    // studs on the top brick, scattered window slots as dark inset boxes
    for (const s of [-1, 1]) {
      const wd = new THREE.BoxGeometry(0.1, hh * 0.45, w * 0.35);
      wd.translate(s * (w / 2 + 0.01), y + hh * 0.5, 0);
      parts.push(colored(wd, '#1b1a1d'));
    }
    y += hh;
  }
  for (let i = 0; i < 3; i++) for (let k = 0; k < 3; k++) {
    const s = new THREE.CylinderGeometry(0.22, 0.22, 0.18, 8);
    s.translate((i - 1) * 0.7, y + 0.09, (k - 1) * 0.7);
    parts.push(colored(s, '#6b5f58'));
  }
  const rot = new THREE.BoxGeometry(1.4, 2.4, 1.4); // broken chunk leaning off the top
  rot.rotateZ(0.5); rot.translate(1.3, y + 0.6, 0.2);
  parts.push(colored(rot, '#8a5a3c'));
  return mergeGeometries(parts)!;
}

/** Wrecked pylon: tilted lattice mast with fallen cross-arm. */
function pylonGeo() {
  const parts: THREE.BufferGeometry[] = [];
  const mast = new THREE.CylinderGeometry(0.25, 0.45, 12, 6);
  mast.translate(0, 6, 0);
  parts.push(colored(mast, '#5b5a62'));
  for (let i = 0; i < 4; i++) {
    const r = new THREE.BoxGeometry(2.4 - i * 0.4, 0.22, 0.22);
    r.translate(0, 3 + i * 2.4, 0);
    parts.push(colored(r, '#8a5a3c'));
  }
  const arm = new THREE.BoxGeometry(4.6, 0.3, 0.3);
  arm.rotateZ(-0.9); arm.translate(2.2, 11, 0);
  parts.push(colored(arm, '#a4503a'));
  const base = new THREE.BoxGeometry(1.8, 0.7, 1.8);
  base.translate(0, 0.35, 0);
  parts.push(colored(base, '#4f5560'));
  return mergeGeometries(parts)!;
}

interface Spot { x: number; y: number; z: number; slope: number }

function slopeAt(hf: Heightfield, x: number, z: number) {
  const d = 10;
  const dx = sampleHeight(hf, x + d, z) - sampleHeight(hf, x - d, z);
  const dz = sampleHeight(hf, x, z + d) - sampleHeight(hf, x, z - d);
  return Math.hypot(dx, dz) / (2 * d);
}

function place(hf: Heightfield, map: MapDef, rnd: () => number, count: number, ok: (s: Spot) => boolean) {
  const out: Spot[] = [];
  const half = map.size * 0.46;
  for (let tries = 0; out.length < count && tries < count * 40; tries++) {
    const x = (rnd() * 2 - 1) * half, z = (rnd() * 2 - 1) * half;
    const s = { x, y: sampleHeight(hf, x, z), z, slope: slopeAt(hf, x, z) };
    if (ok(s)) out.push(s);
  }
  return out;
}

function Instances({ geo, spots, mat, fill }: {
  geo: THREE.BufferGeometry; spots: Spot[]; mat: THREE.Material;
  fill: (o: THREE.Object3D, s: Spot, rnd: () => number, i: number) => void;
}) {
  const ref = useMemo(() => {
    const im = new THREE.InstancedMesh(geo, mat, Math.max(1, spots.length));
    const o = new THREE.Object3D();
    const rnd = mulberry32(spots.length * 31 + 5);
    spots.forEach((s, i) => {
      o.position.set(s.x, s.y, s.z); o.rotation.set(0, 0, 0); o.scale.set(1, 1, 1);
      fill(o, s, rnd, i);
      o.updateMatrix();
      im.setMatrixAt(i, o.matrix);
    });
    im.count = spots.length;
    im.instanceMatrix.needsUpdate = true;
    im.castShadow = im.receiveShadow = true;
    im.frustumCulled = false;
    im.matrixAutoUpdate = false;
    return im;
  }, [geo, spots, mat, fill]);
  return <primitive object={ref} />;
}

/** Deterministic props (seeded by the map) placed on the terrain via sampleHeight. */
export function Scatter({ map, hf }: { map: MapDef; hf: Heightfield }) {
  const stuff = useMemo(() => {
    const rnd = mulberry32(map.seed ^ 0x5eed);
    const rocks = place(hf, map, rnd, 320, (s) => s.slope > 0.12);
    const buttes = place(hf, map, rnd, 26, (s) => s.slope < 0.12 && s.y < map.maxHeight * 0.4);
    const towers = place(hf, map, rnd, 34, (s) => s.slope < 0.1 && s.y < map.maxHeight * 0.55);
    const pylons = place(hf, map, rnd, 45, (s) => s.slope < 0.2);
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, flatShading: true });
    const rockMat = new THREE.MeshStandardMaterial({ color: '#b07050', roughness: 1, flatShading: true });
    return { rocks, buttes, towers, pylons, mat, rockMat, rg: rockGeo(), bg: butteGeo(), tg: towerGeo(), pg: pylonGeo() };
  }, [map, hf]);

  const fillRock = useMemo(() => (o: THREE.Object3D, s: Spot, r: () => number) => {
    const k = 1.5 + Math.pow(r(), 4) * 10;
    o.scale.set(k * (0.8 + r() * 0.6), k * (0.6 + r() * 0.5), k * (0.8 + r() * 0.6));
    o.rotation.set((r() - 0.5) * 0.4, r() * 6.28, (r() - 0.5) * 0.4);
    o.position.y = s.y + k * 0.15;
  }, []);
  const fillButte = useMemo(() => (o: THREE.Object3D, _s: Spot, r: () => number) => {
    const w = 30 + r() * 60, h = 45 + r() * 90;
    o.scale.set(w, h, w * (0.7 + r() * 0.5));
    o.rotation.y = r() * 6.28;
    o.position.y -= 15;
  }, []);
  const fillTower = useMemo(() => (o: THREE.Object3D, _s: Spot, r: () => number) => {
    const k = 1.3 + r() * 1.7;
    o.scale.set(k, k * (0.8 + r() * 0.8), k);
    o.rotation.set((r() - 0.5) * 0.08, r() * 6.28, (r() - 0.5) * 0.08);
    o.position.y -= 0.5;
  }, []);
  const fillPylon = useMemo(() => (o: THREE.Object3D, _s: Spot, r: () => number) => {
    const k = 1.2 + r() * 1.2;
    o.scale.setScalar(k);
    o.rotation.set((r() - 0.5) * 0.5, r() * 6.28, (r() - 0.5) * 0.7);
    o.position.y -= 0.4;
  }, []);

  return (
    <>
      <Instances geo={stuff.rg} spots={stuff.rocks} mat={stuff.rockMat} fill={fillRock} />
      <Instances geo={stuff.bg} spots={stuff.buttes} mat={stuff.mat} fill={fillButte} />
      <Instances geo={stuff.tg} spots={stuff.towers} mat={stuff.mat} fill={fillTower} />
      <Instances geo={stuff.pg} spots={stuff.pylons} mat={stuff.mat} fill={fillPylon} />
    </>
  );
}
