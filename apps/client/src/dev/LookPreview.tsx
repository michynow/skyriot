import { useControls } from 'leva';
import { useLookOverride } from '../frames/look';

/** Leva controls for previewing gear tier / upgrade visuals on Ships and the hangar preview. */
export default function LookPreview() {
  useControls('Look preview', {
    apply: {
      value: useLookOverride.getState().apply,
      options: ['off', 'own', 'all'],
      onChange: (v: 'off' | 'own' | 'all') => useLookOverride.setState({ apply: v }),
    },
    tier: {
      value: useLookOverride.getState().tier,
      min: 1,
      max: 10,
      step: 1,
      onChange: (v: number) => useLookOverride.setState({ tier: v }),
    },
    upgrade: {
      value: useLookOverride.getState().upgrade,
      min: 0,
      max: 10,
      step: 1,
      onChange: (v: number) => useLookOverride.setState({ upgrade: v }),
    },
  });
  return null;
}
