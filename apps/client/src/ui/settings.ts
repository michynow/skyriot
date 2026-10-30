import { create } from 'zustand';

export type Quality = 'low' | 'med' | 'high';
const KEY = 'skyriot.quality';
const AUDIO_KEY = 'skyriot.audio';

function load(): Quality {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'low' || v === 'med' || v === 'high') return v;
  } catch {
    /* storage unavailable */
  }
  return 'med';
}

interface AudioPrefs {
  master: number;
  sfx: number;
  music: number;
  muted: boolean;
}
function loadAudio(): AudioPrefs {
  const d: AudioPrefs = { master: 0.8, sfx: 0.9, music: 0.6, muted: false };
  try {
    const v = JSON.parse(localStorage.getItem(AUDIO_KEY) ?? '{}');
    for (const k of ['master', 'sfx', 'music'] as const) if (typeof v[k] === 'number') d[k] = Math.min(1, Math.max(0, v[k]));
    d.muted = v.muted === true;
  } catch {
    /* ignore */
  }
  return d;
}

export const useSettings = create<
  AudioPrefs & {
    quality: Quality;
    physicsDebug: boolean;
    setQuality(q: Quality): void;
    setPhysicsDebug(on: boolean): void;
    setAudio(p: Partial<AudioPrefs>): void;
    toggleMute(): void;
  }
>((set, get) => ({
  ...loadAudio(),
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
  setAudio(p) {
    set(p);
    const { master, sfx, music, muted } = get();
    try {
      localStorage.setItem(AUDIO_KEY, JSON.stringify({ master, sfx, music, muted }));
    } catch {
      /* ignore */
    }
  },
  toggleMute: () => get().setAudio({ muted: !get().muted }),
}));

export const QUALITY_DPR: Record<Quality, number> = { low: 0.7, med: 1, high: 2 };
