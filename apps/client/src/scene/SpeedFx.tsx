import { useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { BlendFunction, Effect } from 'postprocessing';
import { world } from '../state/world';

/** Shared boost intensity, written by <SpeedLines/> every frame and read by the post effect. */
export const boostState = { sustained: 0, kick: 0, was: false };

const vert = /* glsl */ `
varying vec2 vP;
void main(){ vP = position.xy; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const frag = /* glsl */ `
uniform float uAmt; uniform float uKick; uniform float uTime; uniform float uAspect; uniform vec3 uTint;
varying vec2 vP;
float h11(float n){ return fract(sin(n * 127.1) * 43758.5453); }
void main(){
  vec2 p = vec2(vP.x * uAspect, vP.y);
  float r = length(p);
  float a = atan(p.y, p.x) / 6.2831853 + 0.5;
  const float N = 140.0;
  float id = floor(a * N);
  float cell = fract(a * N);
  float h = h11(id), h2 = h11(id + 17.0), h3 = h11(id + 53.0);
  // streak exists only if its hash is under the density
  float on = step(h, uAmt * 0.9 + uKick * 0.2);
  // thin line across the sector
  float w = 0.04 + 0.07 * h2;
  float line = smoothstep(0.5 - w, 0.5, cell) * smoothstep(0.5 + w, 0.5, cell);
  // moving segment along the radius (travels outward)
  float speed = 1.6 + 2.4 * h3;
  float s = fract(r * 0.9 - uTime * speed - h2 * 3.0);
  float seg = smoothstep(0.0, 0.05, s) * smoothstep(0.55 + 0.3 * h, 0.0, s);
  float radial = smoothstep(0.32, 0.95, r);
  float alpha = line * seg * on * radial * (0.35 * uAmt + 0.45 * uKick);
  gl_FragColor = vec4(uTint * (0.9 + 1.2 * uKick), alpha);
}`;

/** Anime-style radial speed lines (full-screen quad) + boost state tracking. Works at every quality level. */
export function SpeedLines() {
  const size = useThree((s) => s.size);
  const u = useMemo(
    () => ({
      uAmt: { value: 0 },
      uKick: { value: 0 },
      uTime: { value: 0 },
      uAspect: { value: 1 },
      uTint: { value: new THREE.Color(1.0, 0.95, 0.85) },
    }),
    [],
  );
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const own = world.ownId;
    const on = !!own && world.boosting.has(own);
    if (on && !boostState.was) {
      boostState.kick = 1;
      const w = world as unknown as { shake?: number };
      w.shake = Math.max(w.shake ?? 0, 0.45); // kick-in camera shake via the shared shake path
    }
    boostState.was = on;
    boostState.sustained += ((on ? 1 : 0) - boostState.sustained) * (1 - Math.exp(-6 * dt));
    boostState.kick = Math.max(0, boostState.kick - dt / 0.35);
    u.uAmt.value = boostState.sustained;
    u.uKick.value = boostState.kick;
    u.uTime.value += dt;
    u.uAspect.value = size.width / Math.max(1, size.height);
  });
  return (
    <mesh frustumCulled={false} renderOrder={1000}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        vertexShader={vert}
        fragmentShader={frag}
        uniforms={u}
        transparent
        depthTest={false}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
        fog={false}
      />
    </mesh>
  );
}

/** Post pass: radial zoom blur pulse + chromatic aberration on boost kick-in, light sustained zoom. */
export class BoostEffect extends Effect {
  constructor() {
    super(
      'BoostEffect',
      /* glsl */ `
      uniform float uKick; uniform float uSus;
      void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
        vec2 d = uv - 0.5;
        float r = length(d);
        float k = uKick * 0.07 + uSus * 0.012;
        if (k < 0.0005) { outputColor = inputColor; return; }
        vec3 c = vec3(0.0);
        for (int i = 0; i < 7; i++) {
          float t = float(i) / 6.0;
          c += texture2D(inputBuffer, 0.5 + d * (1.0 - k * t * (0.35 + r * 2.0))).rgb;
        }
        c /= 7.0;
        float ca = uKick * 0.02 * r;
        c.r = mix(c.r, texture2D(inputBuffer, uv - d * ca).r, min(1.0, uKick * 2.0));
        c.b = mix(c.b, texture2D(inputBuffer, uv + d * ca).b, min(1.0, uKick * 2.0));
        outputColor = vec4(c, inputColor.a);
      }`,
      { blendFunction: BlendFunction.NORMAL, uniforms: new Map<string, THREE.Uniform>([['uKick', new THREE.Uniform(0)], ['uSus', new THREE.Uniform(0)]]) },
    );
  }
  update() {
    this.uniforms.get('uKick')!.value = boostState.kick;
    this.uniforms.get('uSus')!.value = boostState.sustained;
  }
}
