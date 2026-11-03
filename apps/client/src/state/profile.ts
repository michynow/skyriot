import { create } from 'zustand';
import type { PilotProfile } from '@skyriot/shared';

/** Latest MSG.profile from the server (the only writer). */
export const useProfile = create<{ profile: PilotProfile | null }>(() => ({ profile: null }));
