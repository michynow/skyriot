import { useMemo } from 'react';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import type { Heightfield, MapDef } from '@skyriot/shared';

/** Render-only mesh of the exact heights the server collides with (row-major iz*n+ix, x/z in [-size/2, size/2]). */
function buildGeometry(hf: Heightfield) {
  const n = hf.resolution;
  const g = new THREE.PlaneGeometry(hf.size, hf.size, n - 1, n - 1);
  g.rotateX(-Math.PI / 2); // plane row 0 -> z = -size/2, matching iz = 0
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) pos.setY(i, hf.heights[i]!);
  g.deleteAttribute('uv');
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

const header = /* glsl */ `
uniform sampler2D tSand; uniform sampler2D tRed; uniform sampler2D tRock; uniform float uMaxH;
varying vec3 vWP; varying vec3 vWN;
float th21(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float tvn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(th21(i),th21(i+vec2(1,0)),f.x),mix(th21(i+vec2(0,1)),th21(i+vec2(1,1)),f.x),f.y); }
// two-scale sample hides texture tiling
vec3 tile2(sampler2D t, vec2 p, float s){ return mix(texture2D(t, p*s).rgb, texture2D(t, p*s*0.21 + 0.37).rgb, 0.45); }
vec3 tri(sampler2D t, vec3 p, vec3 w, float s){
  return texture2D(t,p.zy*s).rgb*w.x + texture2D(t,p.xz*s).rgb*w.y + texture2D(t,p.xy*s).rgb*w.z; }
`;

const splat = /* glsl */ `
{
  vec3 N = normalize(vWN);
  float slope = 1.0 - N.y;
  float h01 = clamp(vWP.y / uMaxH, 0.0, 1.0);
  vec3 w = pow(abs(N), vec3(5.0)); w /= (w.x + w.y + w.z);
  float n1 = tvn(vWP.xz * 0.0035);
  float n2 = tvn(vWP.xz * 0.025);
  vec3 sand = tile2(tSand, vWP.xz, 0.045) * vec3(2.1, 1.5, 1.05);
  vec3 soil = tile2(tRed, vWP.xz, 0.06) * vec3(1.9, 1.1, 0.8);
  // strata bands in world height, warped by low-freq noise
  float st = vWP.y * 0.16 + n1 * 3.2;
  float band = sin(st) * 0.5 + 0.5;
  float line = smoothstep(0.92, 1.0, sin(st * 2.7 + 1.3) * 0.5 + 0.5);
  vec3 strata = mix(vec3(0.42, 0.17, 0.12), vec3(1.0, 0.62, 0.40), band) * (1.0 - 0.3 * line);
  vec3 rock = tri(tRock, vWP, w, 0.035) * 3.0 * strata;
  float redAmt = smoothstep(0.03, 0.32, h01 + (n1 - 0.5) * 0.18);
  float rockAmt = smoothstep(0.16, 0.38, slope + (n2 - 0.5) * 0.08);
  vec3 ground = mix(sand, soil * mix(vec3(1.0), strata * 1.3, 0.55), redAmt);
  vec3 col = mix(ground, rock, rockAmt);
  col *= mix(0.7, 1.0, smoothstep(0.0, 0.16, h01));          // darker canyon floor
  col *= 0.88 + 0.24 * n2;
  diffuseColor.rgb = col;
}
`;

export function Terrain({ map, hf }: { map: MapDef; hf: Heightfield }) {
  const geometry = useMemo(() => buildGeometry(hf), [hf]);
  const [sand, red, rock] = useTexture([
    '/textures/aerial_sand/diff.jpg',
    '/textures/red_laterite_soil_stones/diff.jpg',
    '/textures/rock_face/diff.jpg',
  ]);
  const material = useMemo(() => {
    for (const t of [sand, red, rock]) {
      t!.wrapS = t!.wrapT = THREE.RepeatWrapping;
      t!.colorSpace = THREE.SRGBColorSpace;
      t!.anisotropy = 8;
      t!.needsUpdate = true;
    }
    const m = new THREE.MeshStandardMaterial({ roughness: 0.96, metalness: 0, envMapIntensity: 0 });
    m.onBeforeCompile = (sh) => {
      sh.uniforms.tSand = { value: sand };
      sh.uniforms.tRed = { value: red };
      sh.uniforms.tRock = { value: rock };
      sh.uniforms.uMaxH = { value: map.maxHeight };
      sh.vertexShader = sh.vertexShader
        .replace('void main() {', 'varying vec3 vWP; varying vec3 vWN;\nvoid main() {')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = position; vWN = normal;');
      sh.fragmentShader = header + sh.fragmentShader.replace('#include <map_fragment>', splat);
    };
    return m;
  }, [sand, red, rock, map.maxHeight]);

  return <mesh geometry={geometry} material={material} castShadow receiveShadow frustumCulled={false} />;
}
