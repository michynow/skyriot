import { create } from 'zustand';
import { FRAMES, gearOf, resolveGear, type FrameId, type PilotProfile } from '@skyriot/shared';

/** Latest MSG.profile from the server (the only writer). */
export const useProfile = create<{ profile: PilotProfile | null }>(() => ({ profile: null }));

let radarKey: { profile: PilotProfile | null; frame: FrameId } | null = null;
let radarVal = 0;
/** The own Frame's radar range (m) with the equipped radar; cached per profile + Frame (read every frame by HUD). */
export function ownRadarRange(frame: FrameId): number {
  const profile = useProfile.getState().profile;
  if (radarKey?.profile !== profile || radarKey.frame !== frame) {
    radarKey = { profile, frame };
    radarVal =
      (profile && resolveGear(frame, gearOf(profile, frame)).over.radarRangeM) ||
      FRAMES[frame].radarRangeM;
  }
  return radarVal;
}
