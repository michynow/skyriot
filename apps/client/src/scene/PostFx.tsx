import { useMemo } from 'react';
import { Bloom, EffectComposer, SMAA, ToneMapping, Vignette } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { BoostEffect, SpeedLines } from './SpeedFx';

export type Quality = 'low' | 'med' | 'high';

/**
 * Bloom (HDR emissives pop) + vignette + ACES tone map + boost zoom-blur/chromatic pulse.
 * `low` renders no composer, only the boost speed lines. SpeedLines is always mounted here.
 */
export function PostFx({ quality }: { quality: Quality }) {
  const boost = useMemo(() => new BoostEffect(), []);
  if (quality === 'low') return <SpeedLines />;
  const hi = quality === 'high';
  return (
    <>
      <SpeedLines />
      <EffectComposer multisampling={0} enableNormalPass={false}>
        <Bloom mipmapBlur luminanceThreshold={1.0} luminanceSmoothing={0.2} intensity={hi ? 0.9 : 0.7} radius={0.7} />
        <primitive object={boost} />
        <Vignette eskil={false} offset={0.25} darkness={0.55} />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        {hi ? <SMAA /> : <></>}
      </EffectComposer>
    </>
  );
}
