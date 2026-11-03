import * as THREE from 'three';
import type { NationId } from '@skyriot/shared';
import type { Slot } from './bricks';

interface Palette {
  primary: string;
  secondary: string;
  dark: string;
  accent: string;
  glass: string;
  trim: string;
}

export const PALETTES: Record<NationId, Palette> = {
  concord: {
    primary: '#e2b13c',
    secondary: '#f1eee4',
    dark: '#3b404c',
    accent: '#22d3ff',
    glass: '#9defff',
    trim: '#bff6ff',
  },
  vex: {
    primary: '#b92329',
    secondary: '#1d1c22',
    dark: '#2c2426',
    accent: '#ff7418',
    glass: '#ffa066',
    trim: '#ffd0a0',
  },
};

let shipEnvTex: THREE.Texture | null = null;
/** Reflection environment for ship materials only (terrain stays unaffected). */
export function setShipEnv(t: THREE.Texture | null) {
  shipEnvTex = t;
  for (const m of mats.values())
    for (const k of Object.keys(m) as (keyof typeof m)[]) {
      m[k].envMap = t;
      m[k].needsUpdate = true;
    }
}

const mats = new Map<string, Record<Slot, THREE.MeshStandardMaterial>>();

/** Upgrade +9 colour per nation; +10 jumps to a peak colour that contrasts with the paint. */
const ELITE: Record<NationId, string> = { concord: '#a46bff', vex: '#ff2a5a' };
const PEAK: Record<NationId, string> = { concord: '#ff3df2', vex: '#ffb21e' };
const clampU = (u: number) => Math.min(10, Math.max(0, Math.round(u)));
const tints = new Map<string, THREE.Color>();

/** Accent colour for an upgrade level: nation accent (+0) ramps to elite (+9), then peak at +10. */
export function upgradeTint(nation: NationId, upgrade: number): THREE.Color {
  const u = clampU(upgrade);
  const key = `${nation}|${u}`;
  let c = tints.get(key);
  if (!c) {
    c =
      u >= 10
        ? new THREE.Color(PEAK[nation])
        : new THREE.Color(PALETTES[nation].accent).lerp(new THREE.Color(ELITE[nation]), u / 9);
    tints.set(key, c);
  }
  return c;
}

const trails = new Map<string, [number, number, number]>();
/** HDR engine-trail colour for an upgrade level (same ramp as the accent). */
export function trailRgb(nation: NationId, upgrade: number): [number, number, number] {
  const u = clampU(upgrade);
  const key = `${nation}|${u}`;
  let t = trails.get(key);
  if (!t) {
    const c = upgradeTint(nation, u)
      .clone()
      .multiplyScalar(1.8 + u * 0.12);
    t = [c.r, c.g, c.b];
    trails.set(key, t);
  }
  return t;
}

/**
 * Shared per (nation, upgrade): accent/trim shift along the upgrade ramp and glow harder, paint gets
 * glossier and picks up a faint accent sheen from +7.
 */
export function getMaterials(nation: NationId, upgrade: number) {
  const u = clampU(upgrade);
  const key = `${nation}|${u}`;
  let m = mats.get(key);
  if (m) return m;
  const p = PALETTES[nation];
  const tint = upgradeTint(nation, u);
  const sheen = Math.max(0, u - 6) * 0.02;
  const std = (color: string, rough: number, metal: number, glow = 0) =>
    new THREE.MeshStandardMaterial({
      color,
      roughness: Math.max(0.2, rough - u * 0.02),
      metalness: metal + u * 0.02,
      envMapIntensity: 0.6 + u * 0.05,
      emissive: tint,
      emissiveIntensity: glow,
    });
  const accentCol = tint.clone();
  const rimCol = tint.clone();
  /** Distance-scaled rim light so far-away silhouettes pop against terrain. */
  const rim = (mat: THREE.MeshStandardMaterial) => {
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uRim = { value: rimCol };
      sh.fragmentShader = sh.fragmentShader
        .replace('void main() {', 'uniform vec3 uRim;\nvoid main() {')
        .replace(
          '#include <emissivemap_fragment>',
          '#include <emissivemap_fragment>\n' +
            '{ float d = length(vViewPosition); float k = smoothstep(120.0, 700.0, d);\n' +
            '  float f = pow(1.0 - clamp(abs(dot(normalize(vNormal), normalize(vViewPosition))), 0.0, 1.0), 2.0);\n' +
            '  totalEmissiveRadiance += uRim * (f * 1.4 + 0.12) * k * 1.6; }',
        );
    };
    return mat;
  };
  m = {
    primary: rim(std(p.primary, 0.42, 0.2, sheen)),
    secondary: rim(std(p.secondary, 0.5, 0.1, sheen * 0.5)),
    dark: rim(std(p.dark, 0.6, 0.35)),
    accent: new THREE.MeshStandardMaterial({
      color: accentCol,
      emissive: accentCol,
      emissiveIntensity: 0.9 + u * 0.16,
      roughness: 0.4,
    }),
    glass: new THREE.MeshStandardMaterial({
      color: p.glass,
      emissive: p.glass,
      emissiveIntensity: 0.25,
      roughness: 0.08,
      metalness: 0.9,
      envMapIntensity: 2.2,
      transparent: true,
      opacity: 0.85,
    }),
    trim: new THREE.MeshStandardMaterial({
      color: new THREE.Color(p.trim).lerp(tint, u / 10),
      emissive: new THREE.Color(p.trim).lerp(tint, u / 10),
      emissiveIntensity: 2.6 + u * 0.12,
      roughness: 0.3,
    }),
  };
  for (const k of Object.keys(m) as (keyof typeof m)[]) m[k].envMap = shipEnvTex;
  mats.set(key, m);
  return m;
}

const flames = new Map<
  string,
  { outer: THREE.MeshBasicMaterial; inner: THREE.MeshBasicMaterial }
>();
/** Engine flame materials; the outer cone follows the upgrade ramp. */
export function getFlameMaterials(nation: NationId, upgrade: number) {
  const u = clampU(upgrade);
  const key = `${nation}|${u}`;
  let f = flames.get(key);
  if (!f) {
    const mk = (c: THREE.Color, k: number, o: number) => {
      const mat = new THREE.MeshBasicMaterial({
        color: c.clone().multiplyScalar(k),
        transparent: true,
        opacity: o,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
        fog: false,
      });
      return mat;
    };
    f = {
      outer: mk(upgradeTint(nation, u), 2.2 + u * 0.15, 0.55 + u * 0.02),
      inner: mk(new THREE.Color('#ffffff'), 2.5, 0.9),
    };
    flames.set(key, f);
  }
  return f;
}

const auras = new Map<NationId, THREE.MeshBasicMaterial>();
/** +10 only: additive back-face shell around the hull. Opacity is pulsed by FrameModel. */
export function getAuraMaterial(nation: NationId) {
  let a = auras.get(nation);
  if (!a) {
    a = new THREE.MeshBasicMaterial({
      color: upgradeTint(nation, 10).clone().lerp(new THREE.Color(PALETTES[nation].accent), 0.4),
      transparent: true,
      opacity: 0.15,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      depthWrite: false,
      toneMapped: false,
      fog: false,
    });
    auras.set(nation, a);
  }
  return a;
}
