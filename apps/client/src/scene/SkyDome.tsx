import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { EnvironmentProfile } from '@skyriot/shared';

/** World-space direction toward the sun / main light per sky profile (shared with MapScene lights). */
export const SUN_DIR: Record<EnvironmentProfile['sky'], THREE.Vector3> = {
  'desert-dusk': new THREE.Vector3(-0.55, 0.24, -0.8).normalize(),
  storm: new THREE.Vector3(0.3, 0.7, 0.4).normalize(),
  'space-nebula': new THREE.Vector3(0.6, 0.35, -0.7).normalize(),
};
const MODE: Record<EnvironmentProfile['sky'], number> = { 'desert-dusk': 0, storm: 1, 'space-nebula': 2 };

const vert = /* glsl */ `
varying vec3 vDir;
void main(){
  vDir = position;
  vec4 p = projectionMatrix * mat4(mat3(modelViewMatrix)) * vec4(position, 1.0);
  gl_Position = p.xyww; // always at far plane
}`;

const frag = /* glsl */ `
uniform float uMode; uniform vec3 uHorizon; uniform vec3 uSun; uniform float uTime;
varying vec3 vDir;
float h21(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float h31(vec3 p){ return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453); }
float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y); }
float vn3(vec3 p){ vec3 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  float a=mix(mix(h31(i),h31(i+vec3(1,0,0)),f.x),mix(h31(i+vec3(0,1,0)),h31(i+vec3(1,1,0)),f.x),f.y);
  float b=mix(mix(h31(i+vec3(0,0,1)),h31(i+vec3(1,0,1)),f.x),mix(h31(i+vec3(0,1,1)),h31(i+vec3(1,1,1)),f.x),f.y);
  return mix(a,b,f.z); }
float fbm(vec2 p){ float a=.5, s=0.; for(int i=0;i<5;i++){ s+=a*vn(p); p=p*2.03+7.1; a*=.5; } return s; }
float fbm3(vec3 p){ float a=.5, s=0.; for(int i=0;i<5;i++){ s+=a*vn3(p); p=p*2.02+3.7; a*=.5; } return s; }

void main(){
  vec3 d = normalize(vDir);
  float y = d.y;
  vec3 col;
  float sd = max(dot(d, uSun), 0.0);
  if (uMode < 0.5) {
    // desert dusk: warm horizon -> rose -> indigo zenith
    vec3 mid = vec3(0.86, 0.38, 0.30);
    vec3 top = vec3(0.10, 0.11, 0.30);
    float t = max(y, 0.0);
    col = mix(uHorizon, mid, smoothstep(0.0, 0.18, t));
    col = mix(col, top, smoothstep(0.08, 0.75, t));
    // sun glow + disc
    col += vec3(1.0, 0.55, 0.22) * pow(sd, 6.0) * 0.55;
    col += vec3(1.0, 0.75, 0.45) * pow(sd, 60.0) * 1.2;
    col += vec3(1.0, 0.9, 0.7) * smoothstep(0.9993, 0.9998, sd) * 14.0;
    // streaky clouds lit from below
    vec2 cp = d.xz / (abs(y) + 0.22) * 1.6;
    float c = smoothstep(0.45, 0.8, fbm(vec2(cp.x * 0.7, cp.y * 2.2) + 3.0)) * smoothstep(0.0, 0.12, y) * smoothstep(0.7, 0.2, y);
    vec3 cc = mix(vec3(0.35, 0.18, 0.28), vec3(1.0, 0.55, 0.3), pow(sd, 2.0) + 0.15);
    col = mix(col, cc, c * 0.65);
    // below horizon: fade into fog colour
    col = mix(col, uHorizon * 0.8, smoothstep(0.0, -0.12, y));
  } else if (uMode < 1.5) {
    // storm: roiling grey, occasional flicker
    float t = max(y, 0.0);
    vec3 top = vec3(0.07, 0.09, 0.13);
    col = mix(uHorizon, top, smoothstep(0.0, 0.6, t));
    vec2 cp = d.xz / (abs(y) + 0.3) * 1.2 + uTime * 0.01;
    float c = fbm(cp * 1.5);
    col *= 0.55 + 0.9 * c;
    float fl = pow(max(sin(uTime * 0.7) * sin(uTime * 2.3), 0.0), 8.0) * fbm(cp * 3.0);
    col += vec3(0.5, 0.6, 0.9) * fl * 0.6;
    col = mix(col, uHorizon * 0.7, smoothstep(0.0, -0.12, y));
  } else {
    // space nebula: stars + fbm clouds
    vec3 p = d * 2.2;
    float n1 = fbm3(p + 1.3);
    float n2 = fbm3(p * 1.7 - 4.0);
    col = vec3(0.01, 0.012, 0.03);
    col += vec3(0.45, 0.12, 0.55) * pow(n1, 2.6) * 1.4;
    col += vec3(0.08, 0.35, 0.55) * pow(n2, 3.0) * 1.2;
    vec3 g = d * 260.0;
    float s = h31(floor(g));
    float star = step(0.985, s) * smoothstep(0.35, 0.0, length(fract(g) - 0.5));
    col += vec3(1.0, 0.95, 0.9) * star * (1.0 + 4.0 * h31(floor(g) + 5.0));
    col += vec3(1.0, 0.8, 0.6) * pow(sd, 120.0) * 3.0;
  }
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function SkyDome({ env }: { env: EnvironmentProfile }) {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({
      uMode: { value: MODE[env.sky] },
      uHorizon: { value: new THREE.Color(env.fogColor) },
      uSun: { value: SUN_DIR[env.sky] },
      uTime: { value: 0 },
    }),
    [env.sky, env.fogColor],
  );
  useFrame((_, dt) => {
    if (mat.current) mat.current.uniforms.uTime!.value += dt;
  });
  return (
    <mesh frustumCulled={false} renderOrder={-1000}>
      <boxGeometry args={[2, 2, 2]} />
      <shaderMaterial ref={mat} side={THREE.BackSide} depthWrite={false} fog={false} vertexShader={vert} fragmentShader={frag} uniforms={uniforms} />
    </mesh>
  );
}
