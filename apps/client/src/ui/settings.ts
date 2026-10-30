import { create } from 'zustand';

export type Quality = 'low' | 'med' | 'high';
const KEY = 'skyriot.quality';

function load(): Quality {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'low' || v === 'med' || v === 'high') return v;
  } catch {
    /* storage unavailable */
  }
  return 'med';
}

export const useSettings = create<{
  quality: Quality;
  physicsDebug: boolean;
  setQuality(q: Quality): void;
  setPhysicsDebug(on: boolean): void;
}>((set) => ({
  quality: load(),
  physicsDebug: false,
  setQuality(quality) {
    try {
      localStorage.setItem(KEY, quality);
    } catch {
      /* ignore */
    }
    set({ quality });
  },
  setPhysicsDebug: (physicsDebug) => set({ physicsDebug }),
}));

export const QUALITY_DPR: Record<Quality, number> = { low: 0.7, med: 1, high: 2 };
