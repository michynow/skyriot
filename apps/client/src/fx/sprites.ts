import * as THREE from 'three';

const vert = /* glsl */ `
attribute vec4 iA; // xyz centre, w size
attribute vec4 iB; // xyz streak vector (tail = centre - streak); 0 = billboard
attribute vec4 iC; // rgba
varying vec4 vC; varying vec2 vUv; varying float vStreak;
void main(){
  vec4 mv0 = modelViewMatrix * vec4(iA.xyz, 1.0);
  vUv = position.xy; vC = iC;
  vec4 mv;
#ifdef RING_FLAT
  vStreak = 0.0;
  mv = modelViewMatrix * vec4(iA.xyz + vec3(position.x, 0.0, position.y) * iA.w, 1.0);
#else
  if (dot(iB.xyz, iB.xyz) > 1e-6) {
    vec4 mv1 = modelViewMatrix * vec4(iA.xyz - iB.xyz, 1.0);
    vec2 d = mv1.xy - mv0.xy; float dl = length(d);
    vec2 dir = dl > 1e-5 ? d / dl : vec2(1.0, 0.0);
    mv = mix(mv0, mv1, position.x * 0.5 + 0.5);
    mv.xy += vec2(-dir.y, dir.x) * position.y * iA.w;
    vStreak = 1.0;
  } else {
    mv = mv0; mv.xy += position.xy * iA.w; vStreak = 0.0;
  }
#endif
  gl_Position = projectionMatrix * mv;
}`;

const frag = /* glsl */ `
uniform float uPow;
varying vec4 vC; varying vec2 vUv; varying float vStreak;
void main(){
  float a;
  if (vStreak > 0.5) {
    float t = vUv.x * 0.5 + 0.5;               // 0 head -> 1 tail
    a = pow(1.0 - abs(vUv.y), 2.0) * pow(1.0 - t, 1.4) * smoothstep(0.0, 0.06, t);
  } else {
#if defined(RING) || defined(RING_FLAT)
    float l = length(vUv);
    a = smoothstep(0.62, 0.86, l) * smoothstep(1.0, 0.9, l);
#else
    a = pow(smoothstep(1.0, 0.0, length(vUv)), uPow);
#endif
  }
  a *= vC.a;
  if (a < 0.003) discard;
  gl_FragColor = vec4(vC.rgb, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

let quad: THREE.BufferGeometry | null = null;
function quadGeo(cap: number) {
  quad ??= new THREE.PlaneGeometry(2, 2);
  const g = new THREE.InstancedBufferGeometry();
  g.index = quad.index;
  g.setAttribute('position', quad.getAttribute('position'));
  const mk = () => {
    const a = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4);
    a.setUsage(THREE.DynamicDrawUsage);
    return a;
  };
  g.setAttribute('iA', mk());
  g.setAttribute('iB', mk());
  g.setAttribute('iC', mk());
  g.instanceCount = 0;
  return g;
}

/** One draw call of camera-facing glow sprites and stretched streaks, refilled every frame. */
export class SpriteBatch {
  readonly mesh: THREE.Mesh;
  private n = 0;
  private A: Float32Array;
  private B: Float32Array;
  private C: Float32Array;
  private geo: THREE.InstancedBufferGeometry;

  constructor(readonly cap: number, additive: boolean, mode: 'glow' | 'ring' | 'ringFlat' = 'glow') {
    this.geo = quadGeo(cap);
    this.A = (this.geo.getAttribute('iA') as THREE.BufferAttribute).array as Float32Array;
    this.B = (this.geo.getAttribute('iB') as THREE.BufferAttribute).array as Float32Array;
    this.C = (this.geo.getAttribute('iC') as THREE.BufferAttribute).array as Float32Array;
    const mat = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      uniforms: { uPow: { value: additive ? 2 : 1 } },
      defines: mode === 'ring' ? { RING: '' } : mode === 'ringFlat' ? { RING_FLAT: '' } : {},
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.mesh = new THREE.Mesh(this.geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = additive ? 20 : 19;
  }

  push(x: number, y: number, z: number, size: number, r: number, g: number, b: number, a: number, sx = 0, sy = 0, sz = 0) {
    if (this.n >= this.cap) return;
    const i = this.n++ * 4;
    this.A[i] = x; this.A[i + 1] = y; this.A[i + 2] = z; this.A[i + 3] = size;
    this.B[i] = sx; this.B[i + 1] = sy; this.B[i + 2] = sz;
    this.C[i] = r; this.C[i + 1] = g; this.C[i + 2] = b; this.C[i + 3] = a;
  }

  /** Upload what was pushed this frame. */
  flush() {
    this.geo.instanceCount = this.n;
    for (const k of ['iA', 'iB', 'iC']) (this.geo.getAttribute(k) as THREE.BufferAttribute).needsUpdate = true;
    this.n = 0;
  }
}

const S = 19;
/** Fixed-capacity particle pool (swap-remove, struct-of-arrays), drawn into a SpriteBatch. No per-frame allocation. */
export class ParticlePool {
  private d: Float32Array;
  n = 0;
  constructor(readonly cap: number) {
    this.d = new Float32Array(cap * S);
  }

  /** Emit one particle. `grav` > 0 pulls down, < 0 rises. Alpha fades out over life; size lerps s0 -> s1. */
  emit(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number,
    s0: number, s1: number, r: number, g: number, b: number, a: number, drag = 0, grav = 0,
    er = r, eg = g, eb = b) {
    if (this.n >= this.cap) return;
    const o = this.n++ * S, d = this.d;
    d[o] = x; d[o + 1] = y; d[o + 2] = z; d[o + 3] = vx; d[o + 4] = vy; d[o + 5] = vz;
    d[o + 6] = life; d[o + 7] = life; d[o + 8] = s0; d[o + 9] = s1;
    d[o + 10] = r; d[o + 11] = g; d[o + 12] = b; d[o + 13] = a; d[o + 14] = drag; d[o + 15] = grav;
    d[o + 16] = er; d[o + 17] = eg; d[o + 18] = eb;
  }

  update(dt: number, batch: SpriteBatch) {
    const d = this.d;
    for (let i = 0; i < this.n; ) {
      const o = i * S;
      d[o + 6]! -= dt;
      if (d[o + 6]! <= 0) {
        const l = --this.n * S;
        if (l !== o) for (let k = 0; k < S; k++) d[o + k] = d[l + k]!;
        continue;
      }
      const k = Math.max(0, 1 - d[o + 14]! * dt);
      d[o + 3]! *= k; d[o + 4] = d[o + 4]! * k - d[o + 15]! * dt; d[o + 5]! *= k;
      d[o]! += d[o + 3]! * dt; d[o + 1]! += d[o + 4]! * dt; d[o + 2]! += d[o + 5]! * dt;
      const t = 1 - d[o + 6]! / d[o + 7]!;
      const f = 1 - t;
      const alpha = d[o + 13]! * f * f * Math.min(1, t * 12);
      batch.push(d[o]!, d[o + 1]!, d[o + 2]!, d[o + 8]! + (d[o + 9]! - d[o + 8]!) * t,
        d[o + 10]! + (d[o + 16]! - d[o + 10]!) * t, d[o + 11]! + (d[o + 17]! - d[o + 11]!) * t, d[o + 12]! + (d[o + 18]! - d[o + 12]!) * t, alpha);
      i++;
    }
  }
}
