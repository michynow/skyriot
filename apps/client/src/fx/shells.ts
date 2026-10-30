import * as THREE from 'three';
import { FRAMES, type ShipId } from '@skyriot/shared';
import { world } from '../state/world';

interface Shell {
  victim: ShipId; // '' = fixed in space
  t: number;
  T: number;
  r: number; g: number; b: number;
  x: number; y: number; z: number;
  rad0: number; rad1: number;
}

const vert = /* glsl */ `
varying vec3 vC; varying float vF; varying vec3 vP;
void main(){
  vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vec4 mv = viewMatrix * wp;
  vec3 n = normalize(mat3(viewMatrix) * mat3(instanceMatrix) * normal);
  vF = pow(1.0 - abs(dot(n, normalize(-mv.xyz))), 2.2);
  vC = instanceColor; vP = position;
  gl_Position = projectionMatrix * mv;
}`;
const frag = (hex: boolean) => /* glsl */ `
varying vec3 vC; varying float vF; varying vec3 vP;
void main(){
  float m = 1.0;
  ${hex ? `
  // honeycomb-ish: three plane families on the unit sphere
  vec3 p = normalize(vP) * 7.0;
  float d = 1.0;
  d = min(d, abs(fract(dot(p, vec3(1.0, 0.0, 0.0)) ) - 0.5));
  d = min(d, abs(fract(dot(p, vec3(-0.5, 0.866, 0.0)) ) - 0.5));
  d = min(d, abs(fract(dot(p, vec3(-0.5, -0.866, 0.0)) + p.z * 0.5) - 0.5));
  d = min(d, abs(fract(p.z * 0.9) - 0.5));
  m = 0.35 + 1.4 * smoothstep(0.08, 0.0, d);` : ''}
  gl_FragColor = vec4(vC * (vF * 1.6 * m + 0.1 * m), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

/** Pooled additive shells (shield bubbles, hex shields, shockwave spheres). */
export class ShellSet {
  readonly mesh: THREE.InstancedMesh;
  private list: Shell[];
  private n = 0;
  constructor(private cap: number, hex: boolean, private o: THREE.Object3D) {
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: vert, fragmentShader: frag(hex),
    });
    this.mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, hex ? 28 : 20, hex ? 20 : 14), mat, cap);
    this.mesh.count = 0; this.mesh.frustumCulled = false; this.mesh.renderOrder = 15;
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
    this.list = Array.from({ length: cap }, () => ({ victim: '', t: 0, T: 1, r: 0, g: 0, b: 0, x: 0, y: 0, z: 0, rad0: 1, rad1: 1 }));
  }

  /** Follow a ship (radius = frame radius * mul), reusing the ship's slot if it already has one. */
  follow(victim: ShipId, col: [number, number, number], power: number, life: number, mul = 1.55) {
    let i = -1;
    for (let k = 0; k < this.n; k++) if (this.list[k]!.victim === victim) { i = k; break; }
    if (i < 0) i = this.n < this.cap ? this.n++ : 0;
    const b = this.list[i]!;
    b.victim = victim; b.t = b.T = life; b.r = col[0] * power; b.g = col[1] * power; b.b = col[2] * power; b.rad0 = b.rad1 = mul;
  }

  /** Expanding sphere fixed in space. */
  wave(p: [number, number, number], col: [number, number, number], life: number, rad0: number, rad1: number) {
    const i = this.n < this.cap ? this.n++ : 0;
    const b = this.list[i]!;
    b.victim = ''; b.t = b.T = life; b.r = col[0]; b.g = col[1]; b.b = col[2];
    b.x = p[0]; b.y = p[1]; b.z = p[2]; b.rad0 = rad0; b.rad1 = rad1;
  }

  update(dt: number) {
    const O = this.o, ca = this.mesh.instanceColor!;
    for (let i = 0; i < this.n; ) {
      const b = this.list[i]!;
      b.t -= dt;
      const s = b.victim ? world.ships.get(b.victim) : undefined;
      if (b.t <= 0 || (b.victim && (!s || !s.alive))) {
        const last = this.list[--this.n]!;
        if (last !== b) { this.list[i] = last; this.list[this.n] = b; }
        continue;
      }
      if (s) {
        const rad = FRAMES[s.frame].radius * b.rad0;
        O.position.set(s.pos[0], s.pos[1], s.pos[2]);
        O.quaternion.set(s.rot[0], s.rot[1], s.rot[2], s.rot[3]);
        O.scale.set(rad, rad * 0.7, rad * 1.5);
      } else {
        const u = 1 - b.t / b.T;
        const rad = b.rad0 + (b.rad1 - b.rad0) * (1 - (1 - u) * (1 - u));
        O.position.set(b.x, b.y, b.z);
        O.quaternion.identity();
        O.scale.set(rad, rad, rad);
      }
      O.updateMatrix();
      this.mesh.setMatrixAt(i, O.matrix);
      const k = b.victim ? Math.min(1, b.t / 0.3) : Math.min(1, b.t / (b.T * 0.7));
      ca.setXYZ(i, b.r * k, b.g * k, b.b * k);
      i++;
    }
    O.quaternion.identity(); O.scale.set(1, 1, 1);
    this.mesh.count = this.n;
    this.mesh.instanceMatrix.needsUpdate = true;
    ca.needsUpdate = true;
  }
}
