import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { STRUCTURES, type NationId, type SimEvent, type StructureKind } from '@skyriot/shared';
import type { StructureState } from '@skyriot/shared';
import { PALETTES } from '../frames/palette';
import { world } from '../state/world';

/**
 * Base structures: Core tower, Shield Station pylons (+ beam to the Core), Turrets (tracking head),
 * shield dome, damage smoke/fire, wrecks. Static bodies are merged per kind x Nation (vertex colours);
 * one shared particle pool does all smoke / sparks / flashes. Positions are ground-level (target = pos + h/2).
 */

// ---- baked models ------------------------------------------------------------------------
type Part = [
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
  c: string,
  rx?: number,
  rz?: number,
];
type F = number[];
const BOX = new THREE.BoxGeometry(1, 1, 1);

function bake(parts: Part[], pal: (k: string) => THREE.Color, char = 1): THREE.BufferGeometry {
  const gs = parts.map(([x, y, z, w, h, d, c, rx = 0, rz = 0]) => {
    const g = BOX.clone();
    g.scale(w, h, d);
    g.rotateX(rx);
    g.rotateZ(rz);
    g.translate(x, y, z);
    const col = pal(c).clone().multiplyScalar(char);
    const n = g.attributes.position!.count;
    const a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) col.toArray(a, i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(a, 3));
    return g;
  });
  const m = mergeGeometries(gs)!;
  gs.forEach((g) => g.dispose());
  return m;
}

function coreParts(r: number, h: number): Part[] {
  const p: Part[] = [
    [0, h * 0.09, 0, r * 1.5, h * 0.18, r * 1.5, 'dark'],
    [0, h * 0.26, 0, r * 1.15, h * 0.17, r * 1.15, 'primary'],
    [0, h * 0.55, 0, r * 0.8, h * 0.42, r * 0.8, 'secondary'],
    [0, h * 0.82, 0, r * 0.95, h * 0.1, r * 0.95, 'primary'],
    [0, h * 0.9, 0, r * 0.55, h * 0.1, r * 0.55, 'dark'],
  ];
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      p.push([sx * r * 0.6, h * 0.34, sz * r * 0.6, r * 0.22, h * 0.34, r * 0.22, 'primary']);
      p.push([sx * r * 0.42, h * 0.58, sz * r * 0.42, r * 0.12, h * 0.5, r * 0.12, 'dark']);
      p.push([sx * r * 0.7, h * 0.06, sz * r * 0.7, r * 0.3, h * 0.12, r * 0.3, 'accent']);
    }
  return p;
}
function stationParts(r: number, h: number): Part[] {
  const p: Part[] = [
    [0, h * 0.06, 0, r * 2, h * 0.12, r * 2, 'dark'],
    [0, h * 0.4, 0, r * 0.8, h * 0.6, r * 0.8, 'primary'],
    [0, h * 0.7, 0, r * 1.1, h * 0.06, r * 1.1, 'secondary'],
    [0, h * 0.86, 0, r * 0.5, h * 0.2, r * 0.5, 'dark'],
  ];
  for (const sx of [-1, 1])
    for (const sz of [-1, 1])
      p.push([sx * r * 0.7, h * 0.22, sz * r * 0.7, r * 0.22, h * 0.3, r * 0.22, 'secondary']);
  return p;
}
function turretBaseParts(r: number, h: number): Part[] {
  return [
    [0, h * 0.15, 0, r * 2, h * 0.3, r * 2, 'dark'],
    [0, h * 0.45, 0, r * 1.3, h * 0.3, r * 1.3, 'primary'],
    [0, h * 0.62, 0, r * 0.5, h * 0.1, r * 0.5, 'secondary'],
  ];
}
function turretHeadParts(r: number): Part[] {
  return [
    [0, 0, 0, r * 1.2, r * 0.9, r * 1.4, 'primary'],
    [r * 0.28, 0, r * 1.6, r * 0.22, r * 0.22, r * 2.6, 'dark'],
    [-r * 0.28, 0, r * 1.6, r * 0.22, r * 0.22, r * 2.6, 'dark'],
    [0, r * 0.55, 0, r * 0.5, r * 0.25, r * 0.8, 'accent'],
  ];
}

interface Kit {
  body: Record<StructureKind, THREE.BufferGeometry>;
  wreck: Record<StructureKind, THREE.BufferGeometry>;
  head: THREE.BufferGeometry;
  mat: THREE.MeshStandardMaterial;
  glow: THREE.MeshBasicMaterial;
}
const kits = new Map<NationId, Kit>();
function kit(n: NationId): Kit {
  let k = kits.get(n);
  if (k) return k;
  const P = PALETTES[n];
  const cache: Record<string, THREE.Color> = {};
  const pal = (c: string) => (cache[c] ??= new THREE.Color(P[c as keyof typeof P]));
  const S = STRUCTURES;
  // wreck: charred, squashed, tilted rubble
  const rub = (kind: StructureKind, nb: number): Part[] => {
    const { radius: r, height: h } = S[kind];
    const out: Part[] = [];
    for (let i = 0; i < nb; i++) {
      const a = i * 2.4;
      const d = r * (0.2 + 0.6 * ((i * 0.37) % 1));
      const s = r * (0.35 + 0.3 * ((i * 0.61) % 1));
      out.push([
        Math.cos(a) * d,
        s * 0.35,
        Math.sin(a) * d,
        s,
        s * (0.5 + ((i * 0.3) % 0.7)) + h * 0.03,
        s,
        i % 3 ? 'dark' : 'primary',
        ((i % 5) - 2) * 0.25,
        ((i % 4) - 1.5) * 0.3,
      ]);
    }
    return out;
  };
  k = {
    body: {
      core: bake(coreParts(S.core.radius, S.core.height), pal),
      shieldStation: bake(stationParts(S.shieldStation.radius, S.shieldStation.height), pal),
      turret: bake(turretBaseParts(S.turret.radius, S.turret.height), pal),
    },
    wreck: {
      core: bake(rub('core', 14), pal, 0.35),
      shieldStation: bake(rub('shieldStation', 8), pal, 0.35),
      turret: bake(rub('turret', 5), pal, 0.35),
    },
    head: bake(turretHeadParts(S.turret.radius), pal),
    mat: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.2 }),
    glow: new THREE.MeshBasicMaterial({ color: P.accent, toneMapped: false }),
  };
  kits.set(n, k);
  return k;
}

// ---- particle pool -----------------------------------------------------------------------
const N = 600;
const pPosA = new Float32Array(N * 3);
const pPos = pPosA as unknown as F;
const pColA = new Float32Array(N * 4);
const pCol = pColA as unknown as F;
const pSizeA = new Float32Array(N);
const pSize = pSizeA as unknown as F;
const pVel = new Float32Array(N * 3) as unknown as F;
const pLife = new Float32Array(N) as unknown as F; // remaining
const pMax = new Float32Array(N) as unknown as F;
const pGrow = new Float32Array(N) as unknown as F;
const pSize0 = new Float32Array(N) as unknown as F;
const pAlpha0 = new Float32Array(N) as unknown as F;
let head = 0;

function emit(
  x: number,
  y: number,
  z: number,
  vx: number,
  vy: number,
  vz: number,
  life: number,
  size: number,
  grow: number,
  r: number,
  g: number,
  b: number,
  a: number,
) {
  const i = head;
  head = (head + 1) % N;
  pPos[i * 3] = x;
  pPos[i * 3 + 1] = y;
  pPos[i * 3 + 2] = z;
  pVel[i * 3] = vx;
  pVel[i * 3 + 1] = vy;
  pVel[i * 3 + 2] = vz;
  pLife[i] = pMax[i] = life;
  pSize0[i] = size;
  pGrow[i] = grow;
  pAlpha0[i] = a;
  pCol[i * 4] = r;
  pCol[i * 4 + 1] = g;
  pCol[i * 4 + 2] = b;
}
const rnd = (s: number) => (Math.random() - 0.5) * 2 * s;
const smoke = (x: number, y: number, z: number, big = 1) =>
  emit(
    x + rnd(4),
    y,
    z + rnd(4),
    rnd(3),
    14 + Math.random() * 8,
    rnd(3),
    3 + Math.random() * 2,
    8 * big,
    22 * big,
    0.12,
    0.11,
    0.1,
    0.55,
  );
const fire = (x: number, y: number, z: number, big = 1) =>
  emit(
    x + rnd(3),
    y,
    z + rnd(3),
    rnd(2),
    10 + Math.random() * 8,
    rnd(2),
    0.5 + Math.random() * 0.4,
    9 * big,
    -6 * big,
    1.4,
    0.55,
    0.12,
    0.25,
  );
const spark = (x: number, y: number, z: number, sp = 30) =>
  emit(
    x,
    y,
    z,
    rnd(sp),
    Math.random() * sp,
    rnd(sp),
    0.3 + Math.random() * 0.4,
    1.6,
    0,
    3,
    2.2,
    0.8,
    0.3,
  );

// ---- events from Game.tsx ----------------------------------------------------------------
interface Ripple {
  x: number;
  y: number;
  z: number;
  t: number;
}
const ripples: Record<string, Ripple[]> = {};
let clock = 0;

/** Called from Game.tsx for every sim event (the shared fxQueue is drained elsewhere). */
export function structureEvent(ev: SimEvent): void {
  if (ev.type === 'projectileSpawned' && world.structures.has(ev.owner)) {
    const [x, y, z] = ev.origin;
    emit(x, y, z, 0, 0, 0, 0.09, 16, 0, 3, 2.2, 0.9, 0.35);
    for (let i = 0; i < 4; i++) spark(x, y, z, 25);
  } else if (ev.type === 'structureHit') {
    const st = world.structures.get(ev.structure);
    if (ev.shielded && st) {
      (ripples[st.nation] ??= []).push({ x: ev.pos[0], y: ev.pos[1], z: ev.pos[2], t: clock });
    } else {
      for (let i = 0; i < 5; i++) spark(ev.pos[0], ev.pos[1], ev.pos[2]);
    }
  } else if (ev.type === 'structureDestroyed') {
    const [x, y, z] = ev.pos;
    for (let i = 0; i < 14; i++) fire(x, y + i * 1.5, z, 3);
    for (let i = 0; i < 14; i++) smoke(x, y + i, z, 2);
    for (let i = 0; i < 24; i++) spark(x, y, z, 60);
  }
}

// ---- shield dome -------------------------------------------------------------------------
const MAX_RIP = 4;
const domeMat = (color: string) =>
  new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uK: { value: 1 },
      uTime: { value: 0 },
      uRip: { value: Array.from({ length: MAX_RIP }, () => new THREE.Vector4(0, 1, 0, -99)) },
    },
    vertexShader: `varying vec3 vL; varying vec3 vN; varying vec3 vV;
      void main(){ vL = normalize(position); vN = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position,1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uColor; uniform float uK; uniform float uTime; uniform vec4 uRip[${MAX_RIP}];
      varying vec3 vL; varying vec3 vN; varying vec3 vV;
      void main(){
        float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.5);
        float a = 0.05 + f * 0.5;
        for (int i = 0; i < ${MAX_RIP}; i++) {
          float age = uTime - uRip[i].w;
          if (age < 0.0 || age > 1.4) continue;
          float d = acos(clamp(dot(vL, uRip[i].xyz), -1.0, 1.0));
          float w = d - age * 0.9;
          a += exp(-w * w * 60.0) * (1.0 - age / 1.4) * 1.2;
        }
        gl_FragColor = vec4(uColor * a * uK, 1.0);
      }`,
  });

function Dome({
  nation,
  center,
  radius,
}: {
  nation: NationId;
  center: [number, number, number];
  radius: number;
}) {
  const mesh = useRef<THREE.Mesh>(null);
  const mat = useMemo(() => domeMat(PALETTES[nation].accent), [nation]);
  const k = useRef(world.match?.shielded[nation] === false ? 0 : 1);
  const burst = useRef(false);
  useFrame((_, dt) => {
    const m = mesh.current;
    if (!m) return;
    const up = world.match?.shielded[nation] ?? true;
    const was = k.current;
    k.current = up ? Math.min(1, was + dt * 2) : Math.max(0, was - dt * 1.6);
    if (!up && was > 0 && !burst.current) {
      burst.current = true;
      for (let i = 0; i < 30; i++) {
        const a = Math.random() * 6.28,
          b = Math.random() * 1.5;
        spark(
          center[0] + Math.cos(a) * Math.cos(b) * radius,
          center[1] + Math.sin(b) * radius,
          center[2] + Math.sin(a) * Math.cos(b) * radius,
          25,
        );
      }
    }
    if (up) burst.current = false;
    const v = k.current;
    m.visible = v > 0.01;
    m.scale.setScalar(radius * (up ? 1 : 1 + (1 - v) * 0.12));
    mat.uniforms.uK!.value = v * v;
    mat.uniforms.uTime!.value = clock;
    const rs = ripples[nation];
    const u = mat.uniforms.uRip!.value as THREE.Vector4[];
    if (rs) {
      while (rs.length > MAX_RIP) rs.shift();
      for (let i = 0; i < MAX_RIP; i++) {
        const r = rs[i];
        if (!r) {
          u[i]!.w = -99;
          continue;
        }
        const l = Math.hypot(r.x - center[0], r.y - center[1], r.z - center[2]) || 1;
        u[i]!.set((r.x - center[0]) / l, (r.y - center[1]) / l, (r.z - center[2]) / l, r.t);
      }
    }
  });
  return (
    <mesh ref={mesh} position={center} material={mat} frustumCulled={false} renderOrder={5}>
      <sphereGeometry args={[1, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2]} />
    </mesh>
  );
}

// ---- per-structure rigs ------------------------------------------------------------------
interface Rig {
  s: StructureState;
  root: THREE.Group;
  body: THREE.Mesh;
  wreck: THREE.Mesh;
  head?: THREE.Mesh;
  orb?: THREE.Mesh;
  beam?: THREE.Mesh;
  acc: number;
  coreId?: string;
}
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

function build(s: StructureState, parent: THREE.Group): Rig {
  const k = kit(s.nation);
  const def = STRUCTURES[s.kind];
  const root = new THREE.Group();
  root.position.set(s.pos[0], s.pos[1], s.pos[2]);
  const body = new THREE.Mesh(k.body[s.kind], k.mat);
  const wreck = new THREE.Mesh(k.wreck[s.kind], k.mat);
  wreck.visible = false;
  for (const m of [body, wreck]) {
    m.castShadow = true;
    m.receiveShadow = true;
    root.add(m);
  }
  const rig: Rig = { s, root, body, wreck, acc: 0 };
  const orbR = s.kind === 'core' ? def.radius * 0.28 : def.radius * 0.3;
  if (s.kind !== 'turret') {
    const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(orbR, 1), k.glow);
    orb.position.y = def.height * (s.kind === 'core' ? 0.62 : 0.98);
    if (s.kind === 'core') orb.scale.setScalar(1.3);
    root.add(orb);
    rig.orb = orb;
  } else {
    const h = new THREE.Mesh(k.head, k.mat);
    h.position.y = def.height * 0.78;
    h.rotation.order = 'YXZ';
    h.castShadow = true;
    root.add(h);
    rig.head = h;
  }
  if (s.kind === 'shieldStation') {
    // thin additive beam, unit length along +Y, stretched/oriented per frame
    const g = new THREE.CylinderGeometry(0.7, 0.7, 1, 6, 1, true).translate(0, 0.5, 0);
    const beam = new THREE.Mesh(
      g,
      new THREE.MeshBasicMaterial({
        color: PALETTES[s.nation].accent,
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    beam.frustumCulled = false;
    parent.add(beam);
    rig.beam = beam;
  }
  parent.add(root);
  return rig;
}

export function Structures() {
  const group = useRef<THREE.Group>(null);
  const rigs = useRef(new Map<string, Rig>());
  const size = useThree((s) => s.size);
  const cam = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const pts = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      'position',
      new THREE.BufferAttribute(pPosA, 3).setUsage(THREE.DynamicDrawUsage),
    );
    g.setAttribute('aCol', new THREE.BufferAttribute(pColA, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(pSizeA, 1).setUsage(THREE.DynamicDrawUsage));
    const m = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      uniforms: { uScale: { value: 1 } },
      vertexShader: `attribute vec4 aCol; attribute float aSize; uniform float uScale; varying vec4 vC;
        void main(){ vC = aCol; vec4 mv = modelViewMatrix * vec4(position,1.0);
          gl_PointSize = aSize * uScale / max(1.0, -mv.z); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying vec4 vC; void main(){ float d = length(gl_PointCoord - 0.5) * 2.0;
        float a = vC.a * smoothstep(1.0, 0.2, d); gl_FragColor = vec4(vC.rgb * a, a * step(0.001, vC.a) * (vC.r > 1.0 ? 0.25 : 1.0)); }`,
    });
    const p = new THREE.Points(g, m);
    p.frustumCulled = false;
    p.renderOrder = 6;
    return p;
  }, []);
  useEffect(() => {
    const r = rigs.current;
    const grp = group.current;
    return () => {
      for (const g of r.values()) {
        g.root.removeFromParent();
        g.beam?.removeFromParent();
      }
      r.clear();
      void grp;
    };
  }, []);
  const bases = world.map?.bases;
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    clock += dt;
    const grp = group.current;
    if (!grp) return;
    (pts.material as THREE.ShaderMaterial).uniforms.uScale!.value =
      size.height / (2 * Math.tan((cam.fov * Math.PI) / 360));
    const shielded = world.match?.shielded;
    // build / update rigs
    for (const rig of rigs.current.values()) rig.root.visible = world.structures.has(rig.s.id);
    for (const s of world.structures.values()) {
      let rig = rigs.current.get(s.id);
      if (!rig) {
        rig = build(s, grp);
        rigs.current.set(s.id, rig);
      }
      rig.s = s;
      const def = STRUCTURES[s.kind];
      const frac = s.hp / s.maxHp;
      const alive = s.alive;
      rig.body.visible = alive;
      rig.wreck.visible = !alive;
      if (rig.orb) rig.orb.visible = alive;
      if (rig.head) {
        rig.head.visible = alive;
        if (alive)
          rig.head.rotation.set(
            -Math.asin(THREE.MathUtils.clamp(s.aim[1], -1, 1)),
            Math.atan2(s.aim[0], s.aim[2]),
            0,
          );
      }
      if (rig.orb && alive) {
        const pulse = 1 + Math.sin(clock * (s.kind === 'core' ? 2.4 : 4) + s.pos[0]) * 0.12;
        const base = s.kind === 'core' ? 1.3 : 1;
        rig.orb.scale.setScalar(base * pulse * (0.6 + 0.4 * frac));
      }
      if (rig.beam) {
        const core = rig.coreId ? world.structures.get(rig.coreId) : undefined;
        if (!core || core.nation !== s.nation) {
          rig.coreId = undefined;
          for (const c of world.structures.values())
            if (c.kind === 'core' && c.nation === s.nation) rig.coreId = c.id;
        }
        const on = alive && !!core && core.alive && (shielded?.[s.nation] ?? true);
        rig.beam.visible = on;
        if (on && core) {
          _a.set(s.pos[0], s.pos[1] + def.height * 0.98, s.pos[2]);
          _b.set(core.pos[0], core.pos[1] + STRUCTURES.core.height * 0.62, core.pos[2]).sub(_a);
          const len = _b.length();
          rig.beam.position.copy(_a);
          rig.beam.quaternion.setFromUnitVectors(_up, _b.divideScalar(len));
          rig.beam.scale.set(
            1 + Math.sin(clock * 9 + s.pos[2]) * 0.3,
            len,
            1 + Math.sin(clock * 9 + s.pos[2]) * 0.3,
          );
        }
      }
      // damage emitters (skip far-off structures: cheap + they are not readable anyway)
      const rate = !alive ? 3 : frac < 0.25 ? 9 : frac < 0.5 ? 4 : 0;
      if (rate) {
        const cx = cam.position.x - s.pos[0],
          cz = cam.position.z - s.pos[2];
        if (cx * cx + cz * cz < 2500 * 2500) {
          rig.acc += rate * dt;
          while (rig.acc >= 1) {
            rig.acc -= 1;
            const y = s.pos[1] + def.height * (alive ? 0.75 : 0.25);
            const big = s.kind === 'core' ? 2 : s.kind === 'shieldStation' ? 1.3 : 0.8;
            smoke(s.pos[0], y, s.pos[2], big);
            if (alive && frac < 0.25) fire(s.pos[0], y - def.height * 0.2, s.pos[2], big);
            else if (alive && Math.random() < 0.6)
              spark(s.pos[0] + rnd(def.radius * 0.5), y, s.pos[2] + rnd(def.radius * 0.5));
          }
        }
      }
    }
    // particles
    for (let i = 0; i < N; i++) {
      const l = pLife[i]!;
      if (l <= 0) {
        pCol[i * 4 + 3] = 0;
        continue;
      }
      pLife[i] = l - dt;
      const t = 1 - (l - dt) / pMax[i]!;
      for (let k = 0; k < 3; k++) pPos[i * 3 + k] = pPos[i * 3 + k]! + pVel[i * 3 + k]! * dt;
      pSize[i] = Math.max(0.1, pSize0[i]! + pGrow[i]! * t);
      pCol[i * 4 + 3] = pAlpha0[i]! * (1 - t) * Math.min(1, t * 8);
    }
    const g = pts.geometry;
    g.attributes.position!.needsUpdate = true;
    g.attributes.aCol!.needsUpdate = true;
    g.attributes.aSize!.needsUpdate = true;
  });
  return (
    <>
      <group ref={group} />
      <primitive object={pts} />
      {bases &&
        (Object.keys(bases) as NationId[]).map((n) => (
          <Dome key={n} nation={n} center={bases[n].core} radius={bases[n].shieldRadius} />
        ))}
    </>
  );
}
