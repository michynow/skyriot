import { Bloom, EffectComposer, SMAA, ToneMapping, Vignette } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';

export type Quality = 'low' | 'med' | 'high';

/** Bloom (HDR emissives pop) + vignette + ACES tone map. `low` renders nothing (plain renderer output). */
export function PostFx({ quality }: { quality: Quality }) {
  if (quality === 'low') return null;
  const hi = quality === 'high';
  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <Bloom mipmapBlur luminanceThreshold={1.0} luminanceSmoothing={0.2} intensity={hi ? 0.9 : 0.7} radius={0.7} />
      <Vignette eskil={false} offset={0.25} darkness={0.55} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      {hi ? <SMAA /> : <></>}
    </EffectComposer>
  );
}
