import type { NationId } from '@skyriot/shared';

/**
 * Generative war music: dark synthwave / industrial in A minor. A lookahead scheduler (setInterval only
 * wakes it; every note is placed on the AudioContext clock) renders a 4-bar loop of 16th steps. Layers
 * crossfade with an intensity value: 0 idle (pads + bass), ~0.5 enemies near, 1 combat (full drums + lead).
 */
export type MusicMode = 'lobby' | 'game';

const LOOKAHEAD_S = 0.2;
const TICK_MS = 25;
const hz = (m: number) => 440 * 2 ** ((m - 69) / 12);

interface Theme {
  chords: number[][];
  roots: number[];
  /** [step, midi, lengthInSteps] over 64 steps */
  lead: [number, number, number][];
  gritty: boolean;
}
const THEMES: Record<NationId, Theme> = {
  // Concord: brighter, heroic (Dorian-flavoured lead over i-VI-III-VII)
  concord: {
    chords: [[57, 60, 64], [53, 57, 60], [55, 60, 64], [55, 59, 62]],
    roots: [45, 41, 48, 43],
    lead: [[0, 72, 3], [4, 76, 2], [6, 74, 2], [8, 72, 4], [16, 69, 3], [20, 72, 2], [22, 76, 2], [24, 77, 4], [32, 76, 3], [36, 79, 2], [38, 76, 2], [40, 72, 4], [48, 74, 3], [52, 71, 2], [54, 74, 2], [56, 67, 6]],
    gritty: false,
  },
  // Vex: grittier, Phrygian b2 and distortion
  vex: {
    chords: [[57, 60, 64], [58, 62, 65], [57, 60, 64], [55, 58, 62]],
    roots: [45, 46, 45, 43],
    lead: [[0, 69, 3], [4, 70, 2], [6, 69, 2], [8, 67, 4], [16, 69, 3], [20, 72, 2], [22, 70, 2], [24, 69, 5], [32, 69, 2], [35, 70, 2], [38, 72, 2], [40, 70, 4], [48, 67, 3], [52, 69, 2], [54, 66, 2], [56, 69, 6]],
    gritty: true,
  },
};
const BASS_PATTERN = [0, 0, 12, 0, 0, 7, 12, 0];
const OSTINATO_STEPS = [0, 3, 6, 8, 11, 14];

export interface Music {
  start(): void;
  setIntensity(v: number): void;
  setMode(mode: MusicMode): void;
  setNation(n: NationId): void;
  stats(): { steps: number; intensity: number; mode: MusicMode };
}

export function createMusic(ac: AudioContext, out: AudioNode, noise: AudioBuffer): Music {
  let mode: MusicMode = 'lobby';
  let nation: NationId = 'concord';
  let intensity = 0;
  let smooth = 0;
  let nextTime = 0;
  let step = 0;
  let steps = 0;
  let timer: ReturnType<typeof setInterval> | null = null;

  // Shared FX: ping-pong-ish delay for pads / lead.
  const delay = ac.createDelay(1);
  const fb = ac.createGain();
  const dlp = ac.createBiquadFilter();
  const delayOut = ac.createGain();
  dlp.type = 'lowpass';
  dlp.frequency.value = 2200;
  fb.gain.value = 0.38;
  delayOut.gain.value = 0.45;
  delay.connect(dlp).connect(fb).connect(delay);
  dlp.connect(delayOut).connect(out);

  const shaper = ac.createWaveShaper();
  const curve = new Float32Array(1024);
  for (let i = 0; i < curve.length; i++) {
    const x = (i / (curve.length - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * 5);
  }
  shaper.curve = curve;
  shaper.connect(out);

  const mk = () => {
    const g = ac.createGain();
    g.gain.value = 0;
    g.connect(out);
    return g;
  };
  const layers = { pad: mk(), bass: mk(), kick: mk(), snare: mk(), hat: mk(), ost: mk(), lead: mk() };
  const cur: Record<keyof typeof layers, number> = { pad: 0, bass: 0, kick: 0, snare: 0, hat: 0, ost: 0, lead: 0 };
  const tgt: Record<keyof typeof layers, number> = { ...cur };

  const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
  function retarget() {
    const I = intensity;
    const lobby = mode === 'lobby';
    tgt.pad = lobby ? 0.55 : 0.4;
    tgt.bass = lobby ? 0.12 : 0.3 + 0.3 * I;
    tgt.kick = lobby ? 0 : clamp01((I - 0.3) / 0.35) * 0.9;
    tgt.snare = lobby ? 0 : clamp01((I - 0.5) / 0.35) * 0.55;
    tgt.hat = lobby ? 0 : clamp01((I - 0.45) / 0.4) * 0.35;
    tgt.ost = lobby ? 0.1 : clamp01((I - 0.3) / 0.4) * 0.45;
    tgt.lead = lobby ? 0.22 : clamp01((I - 0.65) / 0.3) * 0.5;
    const now = ac.currentTime;
    for (const k of Object.keys(layers) as (keyof typeof layers)[]) layers[k].gain.setTargetAtTime(tgt[k], now, 0.7);
  }

  function env(g: GainNode, t: number, peak: number, atk: number, dur: number) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }
  function note(dest: AudioNode, type: OscillatorType, f: number, t: number, dur: number, peak: number, cutoff: number, send = 0, atk = 0.01) {
    const o = ac.createOscillator();
    const g = ac.createGain();
    const lp = ac.createBiquadFilter();
    o.type = type;
    o.frequency.value = f;
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(cutoff, t);
    lp.frequency.exponentialRampToValueAtTime(Math.max(120, cutoff * 0.3), t + dur);
    env(g, t, peak, atk, dur);
    o.connect(lp).connect(g).connect(dest);
    if (send) {
      const s = ac.createGain();
      s.gain.value = send;
      g.connect(s).connect(delay);
    }
    o.start(t);
    o.stop(t + dur + 0.05);
  }
  function hit(dest: AudioNode, t: number, dur: number, peak: number, ftype: BiquadFilterType, f: number) {
    const s = ac.createBufferSource();
    const g = ac.createGain();
    const f1 = ac.createBiquadFilter();
    s.buffer = noise;
    f1.type = ftype;
    f1.frequency.value = f;
    env(g, t, peak, 0.002, dur);
    s.connect(f1).connect(g).connect(dest);
    s.start(t, Math.random() * 1.5);
    s.stop(t + dur + 0.05);
  }

  function scheduleStep(s: number, t: number, stepDur: number) {
    const th = THEMES[nation];
    const bar = Math.floor(s / 16) % 4;
    const ss = s % 16;
    const chord = th.chords[bar]!;
    const root = th.roots[bar]!;
    const lobby = mode === 'lobby';
    const active = (k: keyof typeof layers) => tgt[k] > 0.01 || cur[k] > 0.015;
    const bassDest = th.gritty ? shaper : layers.bass;

    if (ss === 0 && active('pad')) {
      const barDur = stepDur * 16;
      const depth = lobby ? 0.15 : 0.15 + 0.5 * intensity;
      for (const m of chord) {
        for (const det of [-7, 7]) {
          const o = ac.createOscillator();
          const lp = ac.createBiquadFilter();
          const g = ac.createGain();
          o.type = 'sawtooth';
          o.frequency.value = hz(m);
          o.detune.value = det;
          lp.type = 'lowpass';
          lp.frequency.value = lobby ? 700 : 900 + 900 * intensity;
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(0.14, t + 0.3);
          // gated pulsing on 8ths
          for (let i = 0; i < 8; i++) {
            const t0 = t + (i * barDur) / 8;
            g.gain.setValueAtTime(0.14, Math.max(t + 0.3, t0));
            g.gain.linearRampToValueAtTime(0.14 * (1 - depth), t0 + (0.75 * barDur) / 8);
          }
          g.gain.setValueAtTime(0.14 * (1 - depth), t + barDur - 0.05);
          g.gain.exponentialRampToValueAtTime(0.0001, t + barDur + 0.25);
          o.connect(lp).connect(g).connect(layers.pad);
          g.connect(delay);
          o.start(t);
          o.stop(t + barDur + 0.3);
        }
      }
    }
    if (ss % 2 === 0 && active('bass')) {
      const semis = BASS_PATTERN[(ss / 2) % 8]!;
      note(bassDest, 'sawtooth', hz(root + semis), t, stepDur * 1.8, 0.5, lobby ? 350 : 700 + 600 * intensity);
      if (!lobby) note(layers.bass, 'square', hz(root - 12), t, stepDur * 1.8, 0.35, 300);
    }
    if (!lobby) {
      if (ss % 4 === 0 && active('kick')) {
        const o = ac.createOscillator();
        const g = ac.createGain();
        o.frequency.setValueAtTime(160, t);
        o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
        env(g, t, 1, 0.003, 0.28);
        o.connect(g).connect(layers.kick);
        o.start(t);
        o.stop(t + 0.3);
      }
      if ((ss === 4 || ss === 12) && active('snare')) {
        hit(layers.snare, t, 0.2, 0.8, 'bandpass', 1900);
        note(layers.snare, 'triangle', 190, t, 0.12, 0.5, 1500);
      }
      if (active('hat') && (ss % 4 === 2 || (intensity > 0.85 && ss % 2 === 1))) hit(layers.hat, t, 0.05, 0.5, 'highpass', 8000);
      if (active('ost') && OSTINATO_STEPS.includes(ss)) {
        const m = chord[OSTINATO_STEPS.indexOf(ss) % chord.length]! + 12;
        note(th.gritty ? shaper : layers.ost, 'square', hz(m), t, stepDur * 1.4, 0.3, 2400, 0.12, 0.003);
      }
    } else if (ss % 4 === 0 && active('ost')) {
      // calm hangar arpeggio
      note(layers.ost, 'sine', hz(chord[(ss / 4) % chord.length]! + 12), t, stepDur * 6, 0.35, 3000, 0.3, 0.02);
    }
    if (active('lead')) {
      const bs = s % 64;
      for (const [ls, m, len] of th.lead) {
        if (ls === bs) note(th.gritty ? shaper : layers.lead, th.gritty ? 'sawtooth' : 'square', hz(m), t, stepDur * len * 0.95, 0.35, th.gritty ? 1800 : 3200, 0.4, 0.015);
      }
    }
  }

  function tick() {
    const bpm = mode === 'lobby' ? 92 : 122;
    const stepDur = 60 / bpm / 4;
    // mirror the layer smoothing so we know when a layer is audibly silent
    const dt = TICK_MS / 1000;
    for (const k of Object.keys(cur) as (keyof typeof cur)[]) cur[k] += (tgt[k] - cur[k]) * (1 - Math.exp(-dt / 0.7));
    smooth += (intensity - smooth) * 0.1;
    if (ac.state !== 'running') return;
    if (nextTime < ac.currentTime) nextTime = ac.currentTime + 0.05;
    while (nextTime < ac.currentTime + LOOKAHEAD_S) {
      scheduleStep(step, nextTime, stepDur);
      nextTime += stepDur;
      step = (step + 1) % 64;
      steps++;
    }
  }

  return {
    start() {
      if (timer) return;
      nextTime = ac.currentTime + 0.1;
      retarget();
      timer = setInterval(tick, TICK_MS);
    },
    setIntensity(v) {
      const n = clamp01(v);
      if (Math.abs(n - intensity) < 0.01) return;
      intensity = n;
      retarget();
    },
    setMode(m) {
      if (m === mode) return;
      mode = m;
      step = 0;
      retarget();
    },
    setNation(n) {
      nation = n;
    },
    stats: () => ({ steps, intensity, mode }),
  };
}
