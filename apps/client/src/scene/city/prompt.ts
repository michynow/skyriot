import { create } from 'zustand';
import type { CityService } from '@skyriot/shared';

export interface CityPrompt {
  key: string;
  label: string;
}

/** Which Window each City building serves. The keys work anywhere in the City; buildings just show them. */
export const SERVICE_PROMPT: Record<CityService, CityPrompt> = {
  vendor: { key: 'V', label: 'Vendor · Workshop' },
  hangar: { key: 'P', label: 'Hangar' },
  charms: { key: 'V', label: 'Charm shop' },
};

/** Service buildings the own Ship is near (or docked by), nearest first. Written by CityScene, read by the HUD. */
export const useCityPrompt = create<{ prompts: CityPrompt[] }>(() => ({ prompts: [] }));
