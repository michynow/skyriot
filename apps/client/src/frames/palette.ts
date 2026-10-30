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
  concord: { primary: '#e2b13c', secondary: '#f1eee4', dark: '#3b404c', accent: '#22d3ff', glass: '#9defff', trim: '#bff6ff' },
  vex: { primary: '#b92329', secondary: '#1d1c22', dark: '#2c2426', accent: '#ff7418', glass: '#ffa066', trim: '#ffd0a0' },
};

const mats = new Map<string, Record<Slot, THREE.MeshStandardMaterial>>();
const hot = new THREE.Color('#fff4d8');

/** Shared per (nation, upgrade): accent emissive intensifies and shifts hot with upgrade level. */
export function getMaterials(nation: NationId, upgrade: number) {
  const u = Math.min(10, Math.max(0, Math.round(upgrade)));
  const key = `${nation}|${u}`;
  let m = mats.get(key);
  if (m) return m;
  const p = PALETTES[nation];
  const std = (color: string, rough: number, metal: number) =>
    new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
  const accentCol = new THREE.Color(p.accent).lerp(hot, Math.max(0, u - 3) * 0.06);
  m = {
    primary: std(p.primary, 0.42, 0.2),
    secondary: std(p.secondary, 0.5, 0.1),
    dark: std(p.dark, 0.6, 0.35),
    accent: new THREE.MeshStandardMaterial({
      color: accentCol, emissive: accentCol, emissiveIntensity: 0.9 + u * 0.28, roughness: 0.4,
    }),
    glass: new THREE.MeshStandardMaterial({
      color: p.glass, emissive: p.glass, emissiveIntensity: 0.25, roughness: 0.08, metalness: 0.6, transparent: true, opacity: 0.8,
    }),
    trim: new THREE.MeshStandardMaterial({
      color: p.trim, emissive: p.trim, emissiveIntensity: 2.6, roughness: 0.3,
    }),
  };
  mats.set(key, m);
  return m;
}

const flames = new Map<string, { outer: THREE.MeshBasicMaterial; inner: THREE.MeshBasicMaterial }>();
export function getFlameMaterials(nation: NationId) {
  let f = flames.get(nation);
  if (!f) {
    const mk = (c: THREE.Color, k: number, o: number) => {
      const mat = new THREE.MeshBasicMaterial({
        color: c.clone().multiplyScalar(k), transparent: true, opacity: o, blending: THREE.AdditiveBlending,
        depthWrite: false, toneMapped: false, fog: false,
      });
      return mat;
    };
    f = {
      outer: mk(new THREE.Color(PALETTES[nation].accent), 2.2, 0.55),
      inner: mk(new THREE.Color('#ffffff'), 2.5, 0.9),
    };
    flames.set(nation, f);
  }
  return f;
}
