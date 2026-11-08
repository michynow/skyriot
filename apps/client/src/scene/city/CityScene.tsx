import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { CityBlock, CityLayout, Heightfield, MapDef } from '@skyriot/shared';
import { Bricks, SLOTS, type Slot } from '../../frames/bricks';
import { world } from '../../state/world';
import { buildGeometry } from '../Terrain';
import { buildCity } from './buildings';
import { SERVICE_PROMPT, useCityPrompt, type CityPrompt } from './prompt';

type Ground = CityLayout['ground'];
type Mat = { c: string; r: number; m: number; glow?: number };

/** Per-City look: sky, sun, and what each brick slot means here (baked colours, no textures). */
export const CITY_LOOK: Record<
  Ground,
  {
    light: { sun: string; sunI: number; sky: string; ground: string; hemiI: number };
    sun: THREE.Vector3;
    zenith: string;
    band: string;
    mats: Record<Slot, Mat>;
  }
> = {
  // Gildspire: "order above the clouds" - gold and white stone in a high clear morning
  'sky-mesa': {
    light: { sun: '#ffe6b0', sunI: 3.0, sky: '#cfe0ff', ground: '#e6cf9a', hemiI: 1.05 },
    sun: new THREE.Vector3(-0.45, 0.42, -0.78).normalize(),
    zenith: '#3a69c0',
    band: '#ffe2a8',
    mats: {
      primary: { c: '#e2b24a', r: 0.3, m: 0.45 },
      secondary: { c: '#f2eee4', r: 0.75, m: 0 },
      dark: { c: '#55617a', r: 0.6, m: 0.2 },
      accent: { c: '#4fe0ff', r: 0.4, m: 0, glow: 1.6 },
      glass: { c: '#ffeec4', r: 0.2, m: 0, glow: 0.8 },
      trim: { c: '#d9c6a2', r: 0.85, m: 0 },
    },
  },
  // Rivet Harbor: "nobody owns the sky" - rust and teal under a hazy, low sun over the bay
  harbour: {
    light: { sun: '#ffc79a', sunI: 2.9, sky: '#a8cec8', ground: '#7a5a44', hemiI: 1.5 },
    sun: new THREE.Vector3(0.8, 0.36, 0.48).normalize(),
    zenith: '#22363b',
    band: '#d98b55',
    mats: {
      primary: { c: '#9e4c2c', r: 0.85, m: 0.2 },
      secondary: { c: '#2f807a', r: 0.6, m: 0.25 },
      dark: { c: '#2e3034', r: 0.7, m: 0.4 },
      accent: { c: '#ff7a1a', r: 0.4, m: 0, glow: 1.8 },
      glass: { c: '#ffc27a', r: 0.3, m: 0, glow: 0.9 },
      trim: { c: '#8d8a84', r: 0.95, m: 0 },
    },
  },
};

const matCache = new Map<Ground, Record<Slot, THREE.MeshStandardMaterial>>();
function cityMats(g: Ground) {
  let m = matCache.get(g);
  if (m) return m;
  const out = {} as Record<Slot, THREE.MeshStandardMaterial>;
  for (const s of SLOTS) {
    const d = CITY_LOOK[g].mats[s];
    out[s] = new THREE.MeshStandardMaterial({
      color: d.c,
      roughness: d.r,
      metalness: d.m,
      emissive: d.glow ? d.c : '#000000',
      emissiveIntensity: d.glow ?? 0,
    });
  }
  matCache.set(g, (m = out));
  return m;
}

// ------------------------------------------------------------------ sky

const skyVert = /* glsl */ `
varying vec3 vDir;
void main(){
  vDir = position;
  gl_Position = (projectionMatrix * mat4(mat3(modelViewMatrix)) * vec4(position, 1.0)).xyww;
}`;
const skyFrag = /* glsl */ `
uniform vec3 uHorizon; uniform vec3 uZenith; uniform vec3 uBand; uniform vec3 uSun;
varying vec3 vDir;
void main(){
  vec3 d = normalize(vDir);
  float t = max(d.y, 0.0);
  float sd = max(dot(d, uSun), 0.0);
  vec3 col = mix(uHorizon, uZenith, smoothstep(0.0, 0.7, pow(t, 0.8)));
  col += uBand * pow(sd, 5.0) * 0.45 * (1.0 - t);
  col += vec3(1.0, 0.92, 0.75) * pow(sd, 90.0) * 1.4;
  col += vec3(1.0, 0.95, 0.85) * smoothstep(0.9993, 0.9998, sd) * 10.0;
  col = mix(col, uHorizon, smoothstep(0.0, -0.1, d.y));
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

function CitySky({ map, g }: { map: MapDef; g: Ground }) {
  const L = CITY_LOOK[g];
  const uniforms = useMemo(
    () => ({
      uHorizon: { value: new THREE.Color(map.env.fogColor) },
      uZenith: { value: new THREE.Color(L.zenith) },
      uBand: { value: new THREE.Color(L.band) },
      uSun: { value: L.sun },
    }),
    [map.env.fogColor, L],
  );
  return (
    <mesh frustumCulled={false} renderOrder={-1000}>
      <boxGeometry args={[2, 2, 2]} />
      <shaderMaterial
        side={THREE.BackSide}
        depthWrite={false}
        fog={false}
        vertexShader={skyVert}
        fragmentShader={skyFrag}
        uniforms={uniforms}
      />
    </mesh>
  );
}

// ------------------------------------------------------------------ ground

const hash = (x: number, z: number) => {
  const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
  return s - Math.floor(s);
};

/** Bilinear value noise in 0..1 (no grid seams like a raw cell hash). */
function smoothNoise(x: number, z: number) {
  const ix = Math.floor(x),
    iz = Math.floor(z);
  let fx = x - ix,
    fz = z - iz;
  fx = fx * fx * (3 - 2 * fx);
  fz = fz * fz * (3 - 2 * fz);
  const a = hash(ix, iz) * (1 - fx) + hash(ix + 1, iz) * fx;
  const b = hash(ix, iz + 1) * (1 - fx) + hash(ix + 1, iz + 1) * fx;
  return a * (1 - fz) + b * fz;
}

function groundColors(geo: THREE.BufferGeometry, g: Ground) {
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const nor = geo.getAttribute('normal') as THREE.BufferAttribute;
  const col = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  const a = new THREE.Color(),
    b = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i),
      h = pos.getY(i),
      z = pos.getZ(i);
    const slope = 1 - nor.getY(i);
    const n = smoothNoise(x / 110, z / 110);
    if (g === 'sky-mesa') {
      if (h < 45) c.set('#d8d2e4');
      else if (slope < 0.06)
        c.copy(a.set('#ddd0ae')).lerp(b.set('#b4bc72'), Math.max(0, n - 0.45) * 1.6);
      else {
        const band = Math.sin(h * 0.16 + n) * 0.5 + 0.5;
        c.copy(a.set('#dcbb8e')).lerp(b.set('#a77f62'), band * 0.7);
        c.lerp(b.set('#e8e2ee'), Math.max(0, 1 - (h - 45) / 70) * 0.7); // mist at the cloud line
      }
    } else {
      if (h < 0) c.set('#1b3533');
      else if (h < 7 && slope < 0.05) c.copy(a.set('#948f86')).multiplyScalar(0.9 + n * 0.2);
      else c.copy(a.set('#7a8050')).lerp(b.set('#9a6a46'), Math.min(1, slope * 2 + n * 0.3));
    }
    c.toArray(col, i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
}

function CityGround({ hf, g }: { hf: Heightfield; g: Ground }) {
  const geo = useMemo(() => {
    const geo = buildGeometry(hf);
    groundColors(geo, g);
    return geo;
  }, [hf, g]);
  return (
    <mesh geometry={geo} receiveShadow frustumCulled={false}>
      <meshStandardMaterial vertexColors roughness={0.95} flatShading />
    </mesh>
  );
}

// ------------------------------------------------------------------ cloud sea / bay water

const planeVert = /* glsl */ `
varying vec3 vWP;
#include <fog_pars_vertex>
void main(){
  vWP = (modelMatrix * vec4(position, 1.0)).xyz;
  vec4 mvPosition = viewMatrix * vec4(vWP, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const noiseGlsl = /* glsl */ `
float h21(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y); }
float fbm(vec2 p){ float a=.5, s=0.; for(int i=0;i<5;i++){ s+=a*vn(p); p=p*2.03+7.1; a*=.5; } return s; }
`;
const cloudFrag = /* glsl */ `
uniform float uTime; uniform vec3 uSun;
varying vec3 vWP;
#include <fog_pars_fragment>
${noiseGlsl}
void main(){
  vec2 p = vWP.xz * 0.0014 + vec2(uTime * 0.004, uTime * 0.002);
  float n = fbm(p);
  float m = smoothstep(0.38, 0.62, n);
  vec3 shade = vec3(0.62, 0.62, 0.78);
  vec3 lit = mix(vec3(1.0, 0.97, 0.9), vec3(1.0, 0.88, 0.62), 0.35);
  vec3 col = mix(shade, lit, m);
  // sun-side rims on the billows
  float e = fbm(p + uSun.xz * 0.02) - n;
  col += vec3(1.0, 0.85, 0.55) * clamp(-e * 3.0, 0.0, 0.25);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;
const waterFrag = /* glsl */ `
uniform float uTime; uniform vec3 uSun;
varying vec3 vWP;
#include <fog_pars_fragment>
${noiseGlsl}
void main(){
  vec2 p = vWP.xz * 0.02;
  float t = uTime * 0.25;
  float hx = fbm(p + vec2(t, 0.0) + 0.05) - fbm(p + vec2(t, 0.0) - vec2(0.05, 0.0));
  float hz = fbm(p - vec2(0.0, t) + 0.05) - fbm(p - vec2(0.0, t) - vec2(0.0, 0.05));
  vec3 N = normalize(vec3(-hx * 6.0, 1.0, -hz * 6.0));
  vec3 V = normalize(cameraPosition - vWP);
  float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  float big = fbm(vWP.xz * 0.002);
  vec3 col = mix(vec3(0.07, 0.2, 0.21), vec3(0.14, 0.33, 0.32), big);
  col = mix(col, vec3(0.62, 0.66, 0.62), fres * 0.6);
  float spec = pow(max(dot(reflect(-V, N), uSun), 0.0), 120.0);
  col += vec3(1.0, 0.75, 0.5) * spec * 2.0;
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

function SurfacePlane({ y, frag, sun }: { y: number; frag: string; sun: THREE.Vector3 }) {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({
      ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
      uTime: { value: 0 },
      uSun: { value: sun },
    }),
    [sun],
  );
  useFrame((_, dt) => {
    if (mat.current) mat.current.uniforms.uTime!.value += dt;
  });
  return (
    <mesh
      position={[0, y, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      receiveShadow={false}
      renderOrder={-10}
    >
      <planeGeometry args={[16000, 16000, 1, 1]} />
      <shaderMaterial
        ref={mat}
        fog
        side={THREE.DoubleSide}
        vertexShader={planeVert}
        fragmentShader={frag}
        uniforms={uniforms}
      />
    </mesh>
  );
}

/** Cumulus puffs hugging the cliffs where the mesas sink into the cloud deck. */
function CloudPuffs() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const N = 90;
  useEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new THREE.Object3D();
    const rnd = mulberry(77);
    for (let i = 0; i < N; i++) {
      const a = rnd() * Math.PI * 2;
      const r = 560 + rnd() * 900;
      o.position.set(Math.sin(a) * r, 70 + rnd() * 30, Math.cos(a) * r);
      const s = 30 + rnd() * 60;
      o.scale.set(s * (1.4 + rnd()), s * (0.5 + rnd() * 0.4), s * (1.2 + rnd()));
      o.rotation.set(0, rnd() * 6, 0);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  }, []);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, N]} frustumCulled={false}>
      <icosahedronGeometry args={[1, 1]} />
      <meshLambertMaterial
        color="#fbf6ee"
        emissive="#d8d0e8"
        emissiveIntensity={0.45}
        flatShading
      />
    </instancedMesh>
  );
}

function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ------------------------------------------------------------------ buildings + signs

function Buildings({ layout }: { layout: CityLayout }) {
  const geos = useMemo(() => buildCity(layout), [layout]);
  useEffect(() => () => Object.values(geos).forEach((g) => g?.dispose()), [geos]);
  const mats = cityMats(layout.ground);
  return (
    <>
      {SLOTS.map((s) => {
        const g = geos[s];
        return g ? <mesh key={s} geometry={g} material={mats[s]} castShadow receiveShadow /> : null;
      })}
    </>
  );
}

function signTexture(p: CityPrompt, g: Ground) {
  const cv = document.createElement('canvas');
  cv.width = 512;
  cv.height = 128;
  const x = cv.getContext('2d')!;
  const gold = g === 'sky-mesa';
  x.fillStyle = gold ? 'rgba(30,36,52,0.85)' : 'rgba(24,22,20,0.88)';
  x.fillRect(0, 0, 512, 128);
  x.strokeStyle = gold ? '#e2b24a' : '#ff7a1a';
  x.lineWidth = 8;
  x.strokeRect(4, 4, 504, 120);
  x.fillStyle = gold ? '#fff3d6' : '#ffd9b0';
  x.font = 'bold 54px system-ui, sans-serif';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillText(`${p.label.split(' · ')[0]!.toUpperCase()}  [${p.key}]`, 256, 66);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** World-space point a little in front of a block's face (local +Z), at height `y` above its base. */
function frontPoint(b: CityBlock, y: number, out = new THREE.Vector3()) {
  const yaw = b.yaw ?? 0;
  const f = b.size[2] / 2 + 6;
  return out.set(b.pos[0] + Math.sin(yaw) * f, b.pos[1] + y, b.pos[2] + Math.cos(yaw) * f);
}

function Signs({ layout }: { layout: CityLayout }) {
  const signs = useMemo(
    () =>
      layout.blocks
        .filter((b) => b.service)
        .map((b) => {
          const tex = signTexture(SERVICE_PROMPT[b.service!], layout.ground);
          return {
            pos: frontPoint(b, b.size[1] + 18),
            mat: new THREE.SpriteMaterial({ map: tex, toneMapped: false }),
          };
        }),
    [layout],
  );
  useEffect(() => () => signs.forEach((s) => (s.mat.map?.dispose(), s.mat.dispose())), [signs]);
  return (
    <>
      {signs.map((s, i) => (
        <sprite key={i} position={s.pos} scale={[100, 25, 1]} material={s.mat} />
      ))}
    </>
  );
}

// ------------------------------------------------------------------ NPC traffic

interface Loop {
  c: [number, number];
  r: [number, number];
  y: number;
  n: number;
  speed: number;
  dir?: 1 | -1;
  bob?: number;
}

const TRAFFIC: Record<Ground, { shuttle: Loop[]; boat: Loop[] }> = {
  'sky-mesa': {
    shuttle: [
      { c: [0, 0], r: [850, 850], y: 360, n: 5, speed: 90, bob: 12 },
      { c: [0, 0], r: [620, 420], y: 570, n: 4, speed: 70, dir: -1, bob: 8 },
      { c: [0, 40], r: [190, 160], y: 255, n: 3, speed: 40, bob: 4 },
    ],
    boat: [],
  },
  harbour: {
    shuttle: [
      { c: [0, -200], r: [420, 130], y: 95, n: 4, speed: 50, bob: 3 },
      { c: [0, 250], r: [520, 140], y: 140, n: 4, speed: 60, dir: -1, bob: 4 },
    ],
    boat: [
      { c: [-150, 640], r: [450, 90], y: 0.4, n: 3, speed: 14 },
      { c: [-600, 330], r: [120, 60], y: 0.4, n: 2, speed: 9, dir: -1 },
    ],
  },
};

function shuttleBricks(g: Ground) {
  const b = new Bricks();
  if (g === 'sky-mesa') {
    // sleek gilded ferry: white hull, gold fins, glowing windows
    b.box('secondary', [5, 3.6, 18], [0, 0, 0]);
    b.wedge('secondary', [5, 3.6, 6], [0, 0, -12], { rot: [0, 0, 0] });
    b.box('glass', [5.2, 1.2, 10], [0, 0.8, -1]);
    b.box('primary', [14, 0.6, 5], [0, -0.6, 4]);
    b.box('primary', [0.6, 4, 4], [0, 3, 7]);
    b.cyl('accent', 1.1, 1, [0, 0, 9.5], { seg: 10 });
  } else {
    // cargo drone carrying a container under four rotor pods
    b.box('dark', [6, 2, 10], [0, 0, 0]);
    for (const [sx, sz] of [
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ] as const) {
      b.box('dark', [5, 0.8, 0.8], [sx * 4.5, 0.4, sz * 4], { rot: [0, sx * sz * 0.6, 0] });
      b.cyl('secondary', 2.4, 0.6, [sx * 7, 0.9, sz * 6], { axis: 'y', seg: 10 });
    }
    b.box('primary', [5, 4.4, 12], [0, -3.6, 0]);
    b.box('accent', [0.8, 0.8, 0.8], [0, 1.2, -5]);
  }
  return b;
}

function boatBricks() {
  const b = new Bricks();
  b.box('dark', [7, 3, 20], [0, 1, 0]);
  b.wedge('dark', [7, 3, 6], [0, 1, -13], { rot: [0, 0, 0] });
  b.box('primary', [7.2, 1, 20], [0, 0.2, 0]);
  b.box('secondary', [5, 4, 6], [0, 4.5, 4]);
  b.box('glass', [5.2, 1, 6.2], [0, 5.5, 4]);
  b.cyl('dark', 0.8, 4, [0, 8, 6], { axis: 'y', seg: 8 });
  b.box('accent', [0.6, 0.6, 0.6], [0, 10.2, 6]);
  return b;
}

/** One InstancedMesh per slot, all sharing the same per-instance matrices. */
function Traffic({ loops, make, g }: { loops: Loop[]; make: () => Bricks; g: Ground }) {
  const count = loops.reduce((a, l) => a + l.n, 0);
  const geos = useMemo(() => make().build(), [make]);
  const mats = cityMats(g);
  const refs = useRef<(THREE.InstancedMesh | null)[]>([]);
  const tmp = useMemo(
    () => ({
      m: new THREE.Matrix4(),
      p: new THREE.Vector3(),
      q: new THREE.Vector3(),
      up: new THREE.Vector3(0, 1, 0),
    }),
    [],
  );
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    let k = 0;
    for (const l of loops) {
      const avg = (l.r[0] + l.r[1]) / 2;
      const dir = l.dir ?? 1;
      for (let i = 0; i < l.n; i++, k++) {
        const a = (i / l.n) * Math.PI * 2 + (dir * l.speed * t) / avg;
        const y = l.y + (l.bob ?? 0) * Math.sin(t * 0.5 + i * 1.7);
        tmp.p.set(l.c[0] + Math.cos(a) * l.r[0], y, l.c[1] + Math.sin(a) * l.r[1]);
        tmp.q.set(-Math.sin(a) * l.r[0] * dir, 0, Math.cos(a) * l.r[1] * dir).add(tmp.p);
        tmp.m.lookAt(tmp.p, tmp.q, tmp.up).setPosition(tmp.p);
        for (const r of refs.current) r?.setMatrixAt(k, tmp.m);
      }
    }
    for (const r of refs.current) if (r) r.instanceMatrix.needsUpdate = true;
  });
  return (
    <>
      {SLOTS.map((s, i) => {
        const geo = geos[s];
        return geo ? (
          <instancedMesh
            key={s}
            ref={(r) => void (refs.current[i] = r)}
            args={[geo, mats[s], count]}
            frustumCulled={false}
            castShadow
          />
        ) : null;
      })}
    </>
  );
}

// ------------------------------------------------------------------ smoke

/** Opaque puffs that grow, drift downwind and fade into the fog colour (instance colour, no blending). */
function Smoke({ layout, fog }: { layout: CityLayout; fog: string }) {
  const tops = useMemo(
    () =>
      layout.blocks
        .filter((b) => b.kind === 'stack')
        .map((b) => new THREE.Vector3(b.pos[0], b.pos[1] + b.size[1], b.pos[2])),
    [layout],
  );
  const PER = 18;
  const N = tops.length * PER;
  const ref = useRef<THREE.InstancedMesh>(null);
  const tmp = useMemo(
    () => ({
      o: new THREE.Object3D(),
      c: new THREE.Color(),
      soot: new THREE.Color('#3b3836'),
      fog: new THREE.Color(fog),
    }),
    [fog],
  );
  useFrame(({ clock }) => {
    const m = ref.current;
    if (!m) return;
    const t = clock.elapsedTime;
    tops.forEach((top, s) => {
      for (let i = 0; i < PER; i++) {
        const age = (t * 0.07 + i / PER + s * 0.31) % 1;
        tmp.o.position.set(top.x - age * 120, top.y + 4 + age * 90, top.z + age * 50);
        const sc = 6 + age * 26;
        tmp.o.scale.set(sc, sc * 0.8, sc);
        tmp.o.rotation.set(i, i * 2, 0);
        tmp.o.updateMatrix();
        m.setMatrixAt(s * PER + i, tmp.o.matrix);
        m.setColorAt(s * PER + i, tmp.c.copy(tmp.soot).lerp(tmp.fog, Math.min(1, age * 1.15)));
      }
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });
  if (!N) return null;
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, N]} frustumCulled={false}>
      <icosahedronGeometry args={[1, 1]} />
      <meshLambertMaterial flatShading />
    </instancedMesh>
  );
}

// ------------------------------------------------------------------ service prompts

const PROMPT_RANGE_M = 200;
const DOCKED_RANGE_M = 520;

/** Distance from p to a block's (yawed) box, metres. */
function distToBlock(b: CityBlock, x: number, y: number, z: number) {
  const yaw = b.yaw ?? 0;
  const dx = x - b.pos[0],
    dz = z - b.pos[2];
  const lx = dx * Math.cos(yaw) - dz * Math.sin(yaw);
  const lz = dx * Math.sin(yaw) + dz * Math.cos(yaw);
  const ox = Math.max(Math.abs(lx) - b.size[0] / 2, 0);
  const oz = Math.max(Math.abs(lz) - b.size[2] / 2, 0);
  const oy = Math.max(b.pos[1] - y, y - (b.pos[1] + b.size[1]), 0);
  return Math.hypot(ox, oy, oz);
}

function PromptWatch({ layout }: { layout: CityLayout }) {
  const services = useMemo(() => layout.blocks.filter((b) => b.service), [layout]);
  const last = useRef('');
  useFrame(() => {
    const s = world.ownId ? world.ships.get(world.ownId) : undefined;
    let list: CityPrompt[] = [];
    if (s?.alive) {
      const range = s.docked ? DOCKED_RANGE_M : PROMPT_RANGE_M;
      list = services
        .map((b) => ({ b, d: distToBlock(b, s.pos[0], s.pos[1], s.pos[2]) }))
        .filter((e) => e.d < range)
        .sort((a, b) => a.d - b.d)
        .map((e) => SERVICE_PROMPT[e.b.service!]);
    }
    const key = list.map((p) => p.label).join('|');
    if (key !== last.current) {
      last.current = key;
      useCityPrompt.setState({ prompts: list });
    }
  });
  useEffect(() => () => useCityPrompt.setState({ prompts: [] }), []);
  return null;
}

/** Everything a City draws instead of the Canyons terrain/sky/scatter (lights come from MapScene). */
export function CityScene({ map, hf }: { map: MapDef; hf: Heightfield }) {
  const layout = map.layout!;
  const g = layout.ground;
  const look = CITY_LOOK[g];
  const traffic = TRAFFIC[g];
  return (
    <>
      <CitySky map={map} g={g} />
      <CityGround hf={hf} g={g} />
      {g === 'sky-mesa' ? (
        <>
          <SurfacePlane y={70} frag={cloudFrag} sun={look.sun} />
          <CloudPuffs />
        </>
      ) : (
        <SurfacePlane y={0} frag={waterFrag} sun={look.sun} />
      )}
      <Buildings layout={layout} />
      <Signs layout={layout} />
      <Traffic loops={traffic.shuttle} make={SHUTTLE_MAKERS[g]} g={g} />
      {traffic.boat.length > 0 && <Traffic loops={traffic.boat} make={boatBricks} g={g} />}
      <Smoke layout={layout} fog={map.env.fogColor} />
      <PromptWatch layout={layout} />
    </>
  );
}

const SHUTTLE_MAKERS: Record<Ground, () => Bricks> = {
  'sky-mesa': () => shuttleBricks('sky-mesa'),
  harbour: () => shuttleBricks('harbour'),
};
