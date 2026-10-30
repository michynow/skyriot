import type { NationId, Vec3, Quat } from '@skyriot/shared';
import { useSettings } from '../ui/settings';
import { createMusic, type Music, type MusicMode } from './music';

/**
 * Web Audio engine: procedural SFX recipes + generative music. `playSfx(name)` is a plain lookup into RECIPES;
 * a later sample adapter can map the same names to files in public/audio/ without touching callers.
 */
export type SfxName =
  | 'fire-needle' | 'fire-flak' | 'fire-pulse' | 'fire-autocannon'
  | 'missile-launch' | 'bomb-whistle' | 'explosion' | 'boom' | 'flare-pop'
  | 'hit-dealt' | 'hit-deflect' | 'hit-shield' | 'hit-hull'
  | 'boost-kick' | 'roll' | 'lock-beep' | 'warn-beep'
  | 'skill-buff' | 'skill-toggle' | 'skill-heal' | 'skill-purge' | 'skill-generic'
  | 'docked' | 'resupplied' | 'launch' | 'impact-bounce' | 'destroyed' | 'evaded'
  | 'ui-click' | 'ui-hover';
export type LoopName = 'engine' | 'afterburner' | 'missile-hiss' | 'lock-tone';

export interface SfxOpts {
  pos?: Vec3;
  volume?: number;
  pitch?: number;
}
export interface LoopHandle {
  update(o: { pos?: Vec3; gain?: number; rate?: number }): void;
  stop(): void;
}

const VOICE_CAP = 32;
const LOOP_CAP = 14;
const MAX_DISTANCE = 2000;

let ac: AudioContext | null = null;
let master: GainNode;
let sfxBus: GainNode;
let musicBus: GainNode;
let reverb: GainNode;
let noise: AudioBuffer;
let musicEngine: Music | null = null;
let voices: { end: number; gain: GainNode }[] = [];
let loops = 0;
const lastPlayed = new Map<string, { t: number; n: number }>();
let peakVoices = 0;
let dropped = 0;

interface R {
  ac: AudioContext;
  out: AudioNode;
  t: number;
  pitch: number;
  vol: number;
}

function env(g: GainNode, t: number, peak: number, atk: number, dur: number) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + atk);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
}
function tone(r: R, type: OscillatorType, f0: number, f1: number, dur: number, vol: number, delay = 0, atk = 0.004) {
  const o = r.ac.createOscillator();
  const g = r.ac.createGain();
  const t = r.t + delay;
  o.type = type;
  o.frequency.setValueAtTime(f0 * r.pitch, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1 * r.pitch), t + dur);
  env(g, t, vol * r.vol, atk, dur);
  o.connect(g).connect(r.out);
  o.start(t);
  o.stop(t + dur + 0.05);
}
function burst(r: R, ftype: BiquadFilterType, f0: number, f1: number, q: number, dur: number, vol: number, delay = 0, wet = 0, atk = 0.002) {
  const s = r.ac.createBufferSource();
  const f = r.ac.createBiquadFilter();
  const g = r.ac.createGain();
  const t = r.t + delay;
  s.buffer = noise;
  f.type = ftype;
  f.Q.value = q;
  f.frequency.setValueAtTime(f0 * r.pitch, t);
  f.frequency.exponentialRampToValueAtTime(Math.max(20, f1 * r.pitch), t + dur);
  env(g, t, vol * r.vol, atk, dur);
  s.connect(f).connect(g).connect(r.out);
  if (wet) {
    const w = r.ac.createGain();
    w.gain.value = wet;
    g.connect(w).connect(reverb);
  }
  s.start(t, Math.random() * 1.5);
  s.stop(t + dur + 0.05);
}

const RECIPES: Record<SfxName, (r: R) => number> = {
  'fire-needle': (r) => (tone(r, 'square', 2400, 900, 0.07, 0.22), burst(r, 'highpass', 5000, 3000, 0.7, 0.04, 0.18), 0.1),
  'fire-flak': (r) => (tone(r, 'sine', 170, 50, 0.16, 0.7), burst(r, 'lowpass', 1800, 300, 1, 0.14, 0.55), tone(r, 'square', 500, 200, 0.05, 0.18), 0.2),
  'fire-pulse': (r) => (tone(r, 'sawtooth', 1500, 280, 0.16, 0.25), tone(r, 'sine', 600, 1900, 0.1, 0.18), 0.2),
  'fire-autocannon': (r) => (tone(r, 'square', 95, 60, 0.09, 0.45), burst(r, 'lowpass', 900, 200, 0.8, 0.09, 0.6), tone(r, 'sine', 55, 35, 0.12, 0.6), 0.14),
  'missile-launch': (r) => (burst(r, 'bandpass', 300, 2600, 1.5, 0.9, 0.5), burst(r, 'lowpass', 1400, 200, 0.7, 0.7, 0.6, 0.05), tone(r, 'sawtooth', 80, 220, 0.5, 0.25), 1),
  'bomb-whistle': (r) => (tone(r, 'sine', 2200, 600, 1.1, 0.14), burst(r, 'lowpass', 500, 120, 0.8, 0.3, 0.4), 1.2),
  explosion: (r) => (burst(r, 'lowpass', 2800, 70, 0.8, 1.5, 1, 0, 0.5), tone(r, 'sine', 95, 28, 1.3, 0.9), burst(r, 'highpass', 4000, 800, 0.6, 0.4, 0.3, 0.05), 1.6),
  boom: (r) => (burst(r, 'lowpass', 1800, 50, 0.8, 2, 1, 0, 0.7), tone(r, 'sine', 70, 22, 1.8, 1), 2.1),
  'flare-pop': (r) => (burst(r, 'highpass', 6000, 2000, 0.8, 0.3, 0.4), tone(r, 'triangle', 2000, 900, 0.2, 0.15), 0.35),
  'hit-dealt': (r) => (tone(r, 'triangle', 1900, 1700, 0.05, 0.35), 0.08),
  'hit-deflect': (r) => (tone(r, 'sine', 3300, 2400, 0.4, 0.25), tone(r, 'sine', 4900, 3700, 0.3, 0.1, 0.02), 0.45),
  'hit-shield': (r) => {
    for (let i = 0; i < 5; i++) burst(r, 'highpass', 3500 + i * 500, 7000, 0.7, 0.03, 0.3, i * 0.025);
    tone(r, 'square', 110, 90, 0.15, 0.18);
    return 0.25;
  },
  'hit-hull': (r) => (burst(r, 'bandpass', 900, 300, 2, 0.18, 0.6), tone(r, 'square', 190, 70, 0.12, 0.35), burst(r, 'highpass', 3000, 2000, 1, 0.06, 0.25, 0.02), 0.22),
  'boost-kick': (r) => (tone(r, 'sine', 130, 40, 0.35, 0.8), burst(r, 'lowpass', 1400, 200, 0.8, 0.5, 0.55), 0.55),
  roll: (r) => (burst(r, 'bandpass', 500, 2400, 1, 0.45, 0.45), 0.5),
  'lock-beep': (r) => (tone(r, 'sine', 1200, 1200, 0.07, 0.28), 0.1),
  'warn-beep': (r) => (tone(r, 'square', 1500, 1500, 0.07, 0.25), 0.1),
  'skill-buff': (r) => {
    [1, 1.25, 1.5, 2].forEach((m, i) => tone(r, 'sine', 330 * m, 330 * m * 1.01, 0.8, 0.22, i * 0.07, 0.03));
    burst(r, 'highpass', 3000, 9000, 0.7, 0.5, 0.12, 0.05, 0.3);
    return 1;
  },
  'skill-toggle': (r) => (tone(r, 'square', 150, 55, 0.1, 0.7), burst(r, 'bandpass', 800, 800, 4, 0.05, 0.4), tone(r, 'sawtooth', 200, 520, 0.25, 0.14, 0.08), 0.4),
  'skill-heal': (r) => (tone(r, 'sine', 880, 880, 0.6, 0.22, 0, 0.02), tone(r, 'sine', 1320, 1320, 0.7, 0.18, 0.09, 0.02), 0.8),
  'skill-purge': (r) => (burst(r, 'highpass', 6000, 1000, 0.6, 0.55, 0.7, 0, 0.3), tone(r, 'sine', 200, 2000, 0.4, 0.25), 0.6),
  'skill-generic': (r) => (tone(r, 'triangle', 500, 900, 0.2, 0.35), 0.25),
  docked: (r) => (tone(r, 'sine', 220, 150, 0.35, 0.6), burst(r, 'bandpass', 600, 300, 2, 0.15, 0.4), 0.4),
  resupplied: (r) => (tone(r, 'sine', 660, 660, 0.3, 0.25, 0, 0.01), tone(r, 'sine', 990, 990, 0.45, 0.25, 0.12, 0.01), 0.6),
  launch: (r) => (tone(r, 'sine', 90, 28, 0.5, 1), burst(r, 'lowpass', 600, 100, 0.8, 0.6, 0.6), burst(r, 'bandpass', 200, 3000, 1, 0.9, 0.4, 0.15), 1.1),
  'impact-bounce': (r) => (burst(r, 'bandpass', 420, 200, 1.5, 0.6, 0.6), tone(r, 'sine', 75, 32, 0.4, 0.9), 0.7),
  destroyed: (r) => {
    burst(r, 'lowpass', 3000, 60, 0.8, 1.8, 1, 0, 0.6);
    tone(r, 'sine', 90, 25, 1.6, 1);
    for (let i = 0; i < 9; i++) burst(r, 'bandpass', 1500 + Math.random() * 3000, 600, 3, 0.05, 0.25, 0.3 + i * 0.12 + Math.random() * 0.08);
    return 2.2;
  },
  evaded: (r) => (burst(r, 'bandpass', 3000, 800, 1.2, 0.28, 0.4), tone(r, 'sine', 1760, 1760, 0.5, 0.25, 0.12, 0.01), 0.7),
  'ui-click': (r) => (tone(r, 'square', 900, 600, 0.05, 0.22), 0.08),
  'ui-hover': (r) => (tone(r, 'sine', 1400, 1400, 0.03, 0.1), 0.05),
};

function makeNoise(c: AudioContext): AudioBuffer {
  const b = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}
function makeReverbIr(c: AudioContext): AudioBuffer {
  const len = Math.floor(c.sampleRate * 1.6);
  const b = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2.5;
  }
  return b;
}

function applyVolumes() {
  if (!ac) return;
  const s = useSettings.getState();
  const t = ac.currentTime;
  master.gain.setTargetAtTime(s.muted ? 0 : s.master, t, 0.05);
  sfxBus.gain.setTargetAtTime(s.sfx, t, 0.05);
  musicBus.gain.setTargetAtTime(s.music * 0.55, t, 0.05);
}

/** Create/resume the AudioContext. Must be called from a user gesture (LAUNCH click / first lobby press). */
export function initAudio(): void {
  if (!ac) {
    try {
      ac = new AudioContext();
    } catch (err) {
      console.warn('[audio] unavailable', err);
      return;
    }
    master = ac.createGain();
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 12;
    comp.ratio.value = 10;
    comp.attack.value = 0.003;
    comp.release.value = 0.2;
    master.connect(comp).connect(ac.destination);
    sfxBus = ac.createGain();
    musicBus = ac.createGain();
    sfxBus.connect(master);
    musicBus.connect(master);
    const conv = ac.createConvolver();
    conv.buffer = makeReverbIr(ac);
    reverb = ac.createGain();
    reverb.gain.value = 0.5;
    reverb.connect(conv).connect(sfxBus);
    noise = makeNoise(ac);
    ac.listener.positionX.value = 0;
    musicEngine = createMusic(ac, musicBus, noise);
    useSettings.subscribe(applyVolumes);
    applyVolumes();
    musicEngine.start();
    if (import.meta.env.DEV) {
      setInterval(() => {
        const m = musicEngine?.stats();
        console.debug(`[audio] ctx=${ac?.state} voices=${voices.length} peak=${peakVoices} dropped=${dropped} loops=${loops} music=${m?.mode} I=${m?.intensity.toFixed(2)} steps=${m?.steps}`);
      }, 5000);
    }
  }
  if (ac.state === 'suspended') void ac.resume();
}

/** Music control; safe to call before initAudio (no-ops). */
export const music = {
  setIntensity: (v: number) => musicEngine?.setIntensity(v),
  setMode: (m: MusicMode) => musicEngine?.setMode(m),
  setNation: (n: NationId) => musicEngine?.setNation(n),
};

export function setListener(pos: Vec3 | { x: number; y: number; z: number }, q: Quat | { x: number; y: number; z: number; w: number }): void {
  if (!ac) return;
  const p = Array.isArray(pos) ? { x: pos[0], y: pos[1], z: pos[2] } : pos;
  const [x, y, z, w] = Array.isArray(q) ? q : [q.x, q.y, q.z, q.w];
  const l = ac.listener;
  const fx = -2 * (x * z + w * y);
  const fy = -2 * (y * z - w * x);
  const fz = -(1 - 2 * (x * x + y * y));
  const ux = 2 * (x * y - w * z);
  const uy = 1 - 2 * (x * x + z * z);
  const uz = 2 * (y * z + w * x);
  l.positionX.value = p.x;
  l.positionY.value = p.y;
  l.positionZ.value = p.z;
  l.forwardX.value = fx;
  l.forwardY.value = fy;
  l.forwardZ.value = fz;
  l.upX.value = ux;
  l.upY.value = uy;
  l.upZ.value = uz;
}

function makePanner(c: AudioContext, pos: Vec3): PannerNode {
  const p = c.createPanner();
  p.panningModel = 'HRTF';
  p.distanceModel = 'inverse';
  p.refDistance = 40;
  p.rolloffFactor = 1.3;
  p.maxDistance = MAX_DISTANCE;
  p.positionX.value = pos[0];
  p.positionY.value = pos[1];
  p.positionZ.value = pos[2];
  return p;
}

function distToListener(pos: Vec3): number {
  if (!ac) return Infinity;
  const l = ac.listener;
  return Math.hypot(pos[0] - l.positionX.value, pos[1] - l.positionY.value, pos[2] - l.positionZ.value);
}

/** Per-name rate limit: at most `max` plays per 100 ms window. */
function allowed(name: string, max: number, now: number): boolean {
  const e = lastPlayed.get(name);
  if (!e || now - e.t > 0.1) {
    lastPlayed.set(name, { t: now, n: 1 });
    return true;
  }
  if (e.n >= max) return false;
  e.n++;
  return true;
}

export function playSfx(name: SfxName, opts: SfxOpts = {}): void {
  if (!ac || ac.state !== 'running') return;
  const now = ac.currentTime;
  const recipe = RECIPES[name];
  if (!recipe) return;
  if (opts.pos && distToListener(opts.pos) > MAX_DISTANCE) return;
  if (!allowed(name, name.startsWith('fire-') ? 5 : name.startsWith('hit-') ? 4 : 3, now)) return;
  voices = voices.filter((v) => v.end > now);
  if (voices.length >= VOICE_CAP) {
    // steal the voice that ends soonest
    voices.sort((a, b) => a.end - b.end);
    const v = voices.shift()!;
    v.gain.gain.cancelScheduledValues(now);
    v.gain.gain.setTargetAtTime(0, now, 0.01);
    dropped++;
  }
  const vg = ac.createGain();
  const out: AudioNode = opts.pos ? makePanner(ac, opts.pos) : vg;
  if (opts.pos) vg.connect(out);
  out.connect(sfxBus);
  const dur = recipe({ ac, out: vg, t: now + 0.005, pitch: opts.pitch ?? 1, vol: opts.volume ?? 1 });
  voices.push({ end: now + dur + 0.1, gain: vg });
  if (voices.length > peakVoices) peakVoices = voices.length;
}

export function voiceCount(): number {
  return voices.length;
}
export function audioStats() {
  return { state: ac?.state ?? 'none', voices: voices.length, peak: peakVoices, dropped, loops, music: musicEngine?.stats() ?? null };
}

/** Continuous sounds: engine hum, afterburner, missile hiss, lock tone. */
export function startLoop(name: LoopName, pos?: Vec3): LoopHandle | null {
  if (!ac || ac.state !== 'running' || loops >= LOOP_CAP) return null;
  const c = ac;
  const g = c.createGain();
  g.gain.value = 0;
  const panner = pos ? makePanner(c, pos) : null;
  if (panner) g.connect(panner).connect(sfxBus);
  else g.connect(sfxBus);
  const src: AudioScheduledSourceNode[] = [];
  const freqTargets: { p: AudioParam; base: number }[] = [];
  const mkNoise = (ftype: BiquadFilterType, f: number, q: number, vol: number) => {
    const s = c.createBufferSource();
    const fl = c.createBiquadFilter();
    const gg = c.createGain();
    s.buffer = noise;
    s.loop = true;
    fl.type = ftype;
    fl.frequency.value = f;
    fl.Q.value = q;
    gg.gain.value = vol;
    s.connect(fl).connect(gg).connect(g);
    s.start();
    src.push(s);
  };
  const mkOsc = (type: OscillatorType, f: number, vol: number, cutoff = 4000) => {
    const o = c.createOscillator();
    const lp = c.createBiquadFilter();
    const gg = c.createGain();
    o.type = type;
    o.frequency.value = f;
    lp.type = 'lowpass';
    lp.frequency.value = cutoff;
    gg.gain.value = vol;
    o.connect(lp).connect(gg).connect(g);
    o.start();
    src.push(o);
    freqTargets.push({ p: o.frequency, base: f });
  };
  let base = 1;
  if (name === 'engine') {
    mkOsc('sawtooth', 55, 0.28, 500);
    mkOsc('square', 82.5, 0.12, 400);
    mkNoise('lowpass', 300, 0.7, 0.25);
  } else if (name === 'afterburner') {
    mkNoise('bandpass', 500, 0.6, 0.9);
    mkNoise('highpass', 2500, 0.5, 0.25);
    mkOsc('sawtooth', 70, 0.35, 600);
    base = 1;
  } else if (name === 'missile-hiss') {
    mkNoise('bandpass', 3000, 1.2, 0.7);
    mkNoise('lowpass', 500, 0.7, 0.4);
  } else {
    mkOsc('sine', 1400, 0.4, 5000);
  }
  loops++;
  let stopped = false;
  return {
    update(o) {
      if (stopped) return;
      const t = c.currentTime;
      if (o.gain !== undefined) g.gain.setTargetAtTime(o.gain * base, t, 0.08);
      if (o.rate !== undefined) for (const f of freqTargets) f.p.setTargetAtTime(f.base * o.rate, t, 0.1);
      if (o.pos && panner) {
        panner.positionX.value = o.pos[0];
        panner.positionY.value = o.pos[1];
        panner.positionZ.value = o.pos[2];
      }
    },
    stop() {
      if (stopped) return;
      stopped = true;
      loops--;
      const t = c.currentTime;
      g.gain.setTargetAtTime(0, t, 0.05);
      for (const s of src) s.stop(t + 0.4);
    },
  };
}
