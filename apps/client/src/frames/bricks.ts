import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Material slots every Frame is painted with. Resolved per nation/upgrade in palette.ts. */
export type Slot = 'primary' | 'secondary' | 'dark' | 'accent' | 'glass' | 'trim';
export const SLOTS: Slot[] = ['primary', 'secondary', 'dark', 'accent', 'glass', 'trim'];

type V3 = [number, number, number];

interface Part {
  slot: Slot;
  geo: THREE.BufferGeometry;
}

/**
 * Tiny brick-kit DSL: every call appends a transformed primitive; `build()` merges them per
 * material slot, so a whole Ship is <= 6 draw calls. Local space: -Z forward, +Y up.
 */
export class Bricks {
  parts: Part[] = [];

  private add(slot: Slot, g: THREE.BufferGeometry, pos: V3, rot?: V3, mirrorX = false) {
    if (rot) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rot[0], rot[1], rot[2], 'YXZ')));
    g.translate(pos[0], pos[1], pos[2]);
    const ng = g.index ? g.toNonIndexed() : g;
    ng.deleteAttribute('uv');
    this.parts.push({ slot, geo: ng });
    if (mirrorX) {
      const m = ng.clone();
      m.applyMatrix4(new THREE.Matrix4().makeScale(-1, 1, 1));
      // mirroring flips winding; fix by reversing triangle vertex order
      const p = m.getAttribute('position') as THREE.BufferAttribute;
      const n = m.getAttribute('normal') as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i += 3) {
        for (const a of [p, n]) {
          const x = a.getX(i), y = a.getY(i), z = a.getZ(i);
          a.setXYZ(i, a.getX(i + 2), a.getY(i + 2), a.getZ(i + 2));
          a.setXYZ(i + 2, x, y, z);
        }
      }
      this.parts.push({ slot, geo: m });
    }
  }

  /** Box; `studs` puts a grid of round studs on top. `mirror` duplicates across the X=0 plane. */
  box(slot: Slot, size: V3, pos: V3, o: { rot?: V3; studs?: boolean; mirror?: boolean } = {}) {
    this.add(slot, new THREE.BoxGeometry(size[0], size[1], size[2]), pos, o.rot, o.mirror);
    if (o.studs) this.studsOn(slot, size, pos, o.rot, o.mirror);
  }

  private studsOn(slot: Slot, size: V3, pos: V3, rot?: V3, mirror?: boolean) {
    const pitch = 0.5;
    const nx = Math.max(1, Math.floor(size[0] / pitch));
    const nz = Math.max(1, Math.floor(size[2] / pitch));
    for (let i = 0; i < nx; i++) {
      for (let k = 0; k < nz; k++) {
        const lx = (i - (nx - 1) / 2) * pitch;
        const lz = (k - (nz - 1) / 2) * pitch;
        const g = new THREE.CylinderGeometry(0.13, 0.13, 0.09, 8);
        g.translate(lx, size[1] / 2 + 0.045, lz);
        if (rot) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rot[0], rot[1], rot[2], 'YXZ')));
        this.add(slot, g, pos, undefined, mirror);
      }
    }
  }

  /** Wedge: low at front (-Z), full height at back (+Z). `flip` reverses (nose-up). */
  wedge(slot: Slot, size: V3, pos: V3, o: { flip?: boolean; rot?: V3; mirror?: boolean } = {}) {
    const [w, h, d] = size;
    const s = new THREE.Shape();
    s.moveTo(0, 0); s.lineTo(d, 0); s.lineTo(d, h); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: false });
    g.translate(-d / 2, -h / 2, -w / 2);
    g.rotateY(o.flip ? Math.PI / 2 : -Math.PI / 2);
    this.add(slot, g, pos, o.rot, o.mirror);
  }

  /** Cylinder along Z by default (axis 'z'), or 'y'. */
  cyl(slot: Slot, r: number, len: number, pos: V3, o: { axis?: 'x' | 'y' | 'z'; r2?: number; seg?: number; mirror?: boolean; rot?: V3 } = {}) {
    const g = new THREE.CylinderGeometry(o.r2 ?? r, r, len, o.seg ?? 12);
    const ax = o.axis ?? 'z';
    if (ax === 'z') g.rotateX(Math.PI / 2);
    else if (ax === 'x') g.rotateZ(Math.PI / 2);
    this.add(slot, g, pos, o.rot, o.mirror);
  }

  /** Scaled sphere (ellipsoid); `top` keeps only the upper half (canopy). */
  ellipsoid(slot: Slot, size: V3, pos: V3, o: { top?: boolean; mirror?: boolean } = {}) {
    const g = new THREE.SphereGeometry(0.5, 14, 10, 0, Math.PI * 2, 0, o.top ? Math.PI / 2 : Math.PI);
    g.scale(size[0], size[1], size[2]);
    this.add(slot, g, pos, undefined, o.mirror);
  }

  torus(slot: Slot, r: number, tube: number, pos: V3, o: { rot?: V3 } = {}) {
    this.add(slot, new THREE.TorusGeometry(r, tube, 8, 28), pos, o.rot);
  }

  /** Merge into one geometry per slot. */
  build(): Partial<Record<Slot, THREE.BufferGeometry>> {
    const out: Partial<Record<Slot, THREE.BufferGeometry>> = {};
    for (const s of SLOTS) {
      const gs = this.parts.filter((p) => p.slot === s).map((p) => p.geo);
      if (gs.length) {
        const m = mergeGeometries(gs, false);
        if (m) out[s] = m;
        gs.forEach((g) => g.dispose());
      }
    }
    return out;
  }
}
