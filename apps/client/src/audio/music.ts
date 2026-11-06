import type { MapDef } from '@skyriot/shared';
import { useSettings } from '../ui/settings';

/**
 * Map music: one looping file per map from public/music/ (gitignored, see its README). A missing file plays
 * nothing. Lobby = silence. Agent test runs (VITE_MUTE=1 / ?mute) never load or play anything.
 */
export const AGENT_MUTE =
  import.meta.env.VITE_MUTE === '1' || new URLSearchParams(location.search).has('mute');

const FADE_S = 2;
const TICK_MS = 50;
const GAIN = 0.55;

interface Track {
  src: string;
  el: HTMLAudioElement;
  fade: number;
  target: 0 | 1;
}
let tracks: Track[] = [];
let timer: ReturnType<typeof setInterval> | undefined;

function trackFor(map: MapDef): string {
  return `/music/${map.city ? `city-${map.city}` : 'warzone'}.mp3`;
}

function level(t: Track): number {
  const s = useSettings.getState();
  return s.muted ? 0 : Math.min(1, s.master * s.music * GAIN * t.fade);
}

function tick() {
  for (const t of tracks) {
    t.fade = Math.min(1, Math.max(0, t.fade + ((t.target ? 1 : -1) * TICK_MS) / 1000 / FADE_S));
    t.el.volume = level(t);
    if (!t.target && t.fade === 0) t.el.pause();
  }
  tracks = tracks.filter((t) => t.target || t.fade > 0);
  if (!tracks.length) timer = clearInterval(timer) as undefined;
}

export const music = {
  /** Play the map's track (fading out any other); `null` fades everything out. */
  setMap(map: MapDef | null): void {
    if (AGENT_MUTE) return;
    const src = map ? trackFor(map) : null;
    for (const t of tracks) if (t.src !== src) t.target = 0;
    if (src && !tracks.some((t) => t.src === src && t.target)) {
      const el = new Audio(src);
      el.loop = true;
      el.volume = 0;
      // Missing file (dev server answers with index.html) or autoplay refusal: stay silent.
      const drop = () => (tracks = tracks.filter((t) => t.el !== el));
      el.addEventListener('error', drop);
      el.play().catch(drop);
      tracks.push({ src, el, fade: 0, target: 1 });
      if (import.meta.env.DEV) console.debug(`[music] ${src}`);
    }
    timer ??= setInterval(tick, TICK_MS);
  },
};
