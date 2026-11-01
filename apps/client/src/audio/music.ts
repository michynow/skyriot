import type { MapDef, NationId } from '@skyriot/shared';
import { MAP_THEMES, THEMES, type N, type SectionDef, type ThemeDef } from './score';

/**
 * Score player for the composed themes in score.ts. A lookahead scheduler (setInterval only wakes it; every
 * note is placed on the AudioContext clock) renders one bar at a time of the current section. The lobby plays
 * the nation's title theme, the game plays the loaded Map's theme. Intensity (0 idle, ~0.5 enemies near,
 * 1 combat) works twice: layer gains crossfade continuously, and the form jumps into its fight sections
 * (chorus, bridge, key-lifted chorus) when combat starts and back out to the calm ones when it ends.
 */
export type MusicMode = 'lobby' | 'game';

const LOOKAHEAD_S = 0.3;
const TICK_MS = 25;
/** Intensity the lobby plays at (title themes have no fight sections; this sets drum/lead levels). */
const LOBBY_I = 0.6;
const HOT_I = 0.75;
const DEFAULT_ARP = [0, 1, 2, 3, 4, 3, 2, 1, 0, 1, 2, 3, 4, 3, 2, 1];
const hz = (m: number) => 440 * 2 ** ((m - 69) / 12);
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const ramp = (v: number, a: number, b: number) => clamp01((v - a) / (b - a));

export interface Music {
  start(): void;
  setIntensity(v: number): void;
  setMode(mode: MusicMode): void;
  setNation(n: NationId): void;
  setMap(map: MapDef | null): void;
  stats(): { steps: number; intensity: number; mode: MusicMode; theme: string; section: string };
}

interface Voice {
  type?: OscillatorType;
  cut?: number;
  atk?: number;
  rel?: number;
  det?: number[];
  /** Filter closes over the note (plucks, palm mutes). */
  pluck?: boolean;
  /** Echo / reverb send amounts. */
  dly?: number;
  rev?: number;
}

export function createMusic(ac: AudioContext, out: AudioNode, noise: AudioBuffer): Music {
  let mode: MusicMode = 'lobby';
  let nation: NationId = 'concord';
  let sky: MapDef['env']['sky'] | null = null;
  let intensity = 0;
  let theme: ThemeDef = THEMES['title-concord']!;
  let sectionIdx = 0;
  let barInSection = 0;
  let nextBar = 0;
  let steps = 0;
  let timer: ReturnType<typeof setInterval> | null = null;

  // Shared FX: tempo-synced dotted-8th echo and a long noise-tail reverb.
  const delay = ac.createDelay(2);
  const fb = ac.createGain();
  const dlp = ac.createBiquadFilter();
  const delayOut = ac.createGain();
  dlp.type = 'lowpass';
  dlp.frequency.value = 2600;
  delayOut.gain.value = 0.5;
  delay.connect(dlp).connect(fb).connect(delay);
  dlp.connect(delayOut).connect(out);
  const verb = ac.createConvolver();
  const ir = ac.createBuffer(2, Math.floor(ac.sampleRate * 3), ac.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 3;
  }
  verb.buffer = ir;
  const verbOut = ac.createGain();
  verbOut.gain.value = 0.6;
  verb.connect(verbOut).connect(out);

  const mk = () => {
    const g = ac.createGain();
    g.gain.value = 0;
    g.connect(out);
    return g;
  };
  const layers = {
    pad: mk(),
    orch: mk(),
    bass: mk(),
    drums: mk(),
    gtr: mk(),
    arp: mk(),
    lead: mk(),
  };
  type Layer = keyof typeof layers;

  const shaperOf = (k: number) => {
    const s = ac.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < curve.length; i++)
      curve[i] = Math.tanh(((i / (curve.length - 1)) * 2 - 1) * k);
    s.curve = curve;
    s.oversample = '2x';
    return s;
  };
  // Guitar: voices sum *before* the heavy drive so power chords intermodulate, then a cabinet-ish lowpass.
  const gtrDrive = shaperOf(9);
  const cab = ac.createBiquadFilter();
  cab.type = 'lowpass';
  cab.frequency.value = 4200;
  const cabMid = ac.createBiquadFilter();
  cabMid.type = 'peaking';
  cabMid.frequency.value = 1500;
  cabMid.gain.value = 4;
  // The drive output sits near full scale; trim it to sit with the other layers.
  const gtrTrim = ac.createGain();
  gtrTrim.gain.value = 0.18;
  gtrDrive.connect(cab).connect(cabMid).connect(gtrTrim).connect(layers.gtr);
  // Gritty themes push the bass through mild drive.
  const bassGrit = shaperOf(3);
  bassGrit.connect(layers.bass);

  const effI = () => (mode === 'lobby' ? LOBBY_I : intensity);
  function retarget() {
    const I = effI();
    const tgt: Record<Layer, number> = {
      pad: 0.8 - 0.2 * I,
      orch: 0.8,
      bass: 0.5 + 0.5 * ramp(I, 0.1, 0.6),
      drums: 0.3 + 0.7 * ramp(I, 0.3, 0.9),
      gtr: 0.25 + 0.75 * ramp(I, 0.1, 0.9),
      arp: 0.55 + 0.45 * ramp(I, 0.1, 0.6),
      lead: 0.55 + 0.45 * ramp(I, 0.4, 1),
    };
    const now = ac.currentTime;
    for (const k of Object.keys(layers) as Layer[])
      layers[k].gain.setTargetAtTime(tgt[k], now, 0.7);
  }

  function send(src: AudioNode, node: AudioNode, amount: number) {
    if (amount <= 0) return;
    const g = ac.createGain();
    g.gain.value = amount;
    src.connect(g).connect(node);
  }
  /** One enveloped, filtered note; `det` stacks detuned oscillators into one voice (supersaw, pad). */
  function tone(dest: AudioNode, m: number, t: number, dur: number, peak: number, v: Voice = {}) {
    const atk = v.atk ?? 0.01;
    const rel = v.rel ?? 0.08;
    const cut = v.cut ?? 3000;
    const g = ac.createGain();
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(cut, t);
    if (v.pluck) lp.frequency.exponentialRampToValueAtTime(Math.max(150, cut * 0.25), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + atk);
    g.gain.setValueAtTime(peak, t + Math.max(atk, dur));
    g.gain.setTargetAtTime(0.0001, t + Math.max(atk, dur), rel / 3);
    lp.connect(g).connect(dest);
    send(g, delay, v.dly ?? 0);
    send(g, verb, v.rev ?? 0);
    const end = t + Math.max(atk, dur) + rel + 0.05;
    for (const det of v.det ?? [0]) {
      const o = ac.createOscillator();
      o.type = v.type ?? 'sawtooth';
      o.frequency.value = hz(m);
      o.detune.value = det;
      o.connect(lp);
      o.start(t);
      o.stop(end);
    }
  }
  function bell(dest: AudioNode, m: number, t: number, peak: number, rev: number) {
    for (const [ratio, p, d] of [
      [1, peak, 1.6],
      [2.76, peak * 0.35, 0.5],
      [5.4, peak * 0.12, 0.25],
    ] as const) {
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = 'sine';
      o.frequency.value = hz(m) * ratio;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(p, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g).connect(dest);
      send(g, verb, rev);
      send(g, delay, rev * 0.5);
      o.start(t);
      o.stop(t + d + 0.05);
    }
  }
  function hit(
    t: number,
    dur: number,
    peak: number,
    ftype: BiquadFilterType,
    f: number,
    rev = 0,
    sweepTo = 0,
  ) {
    const s = ac.createBufferSource();
    const g = ac.createGain();
    const flt = ac.createBiquadFilter();
    s.buffer = noise;
    flt.type = ftype;
    flt.frequency.setValueAtTime(f, t);
    if (sweepTo) flt.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + (sweepTo ? dur * 0.95 : 0.002));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(flt).connect(g).connect(layers.drums);
    send(g, verb, rev);
    s.start(t, Math.random() * 1.5);
    s.stop(t + dur + 0.05);
  }
  function kick(t: number, peak: number) {
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.13);
    g.gain.setValueAtTime(peak, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
    o.connect(g).connect(layers.drums);
    o.start(t);
    o.stop(t + 0.35);
  }
  function snare(t: number, peak: number, rev: number) {
    hit(t, 0.22, peak, 'bandpass', 1800, rev);
    tone(layers.drums, 54, t, 0.06, peak * 0.5, { type: 'triangle', cut: 1500, rel: 0.1 });
  }
  function tom(t: number, m: number, peak: number) {
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.frequency.setValueAtTime(hz(m) * 1.5, t);
    o.frequency.exponentialRampToValueAtTime(hz(m), t + 0.08);
    g.gain.setValueAtTime(peak, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    o.connect(g).connect(layers.drums);
    send(g, verb, 0.3);
    o.start(t);
    o.stop(t + 0.4);
  }

  function drums(
    sec: SectionDef,
    t: number,
    s16: number,
    I: number,
    lastBar: boolean,
    rev: number,
  ) {
    const style = sec.drums;
    const sixteenths = I > 0.85;
    for (let i = 0; i < 16; i++) {
      const ti = t + i * s16;
      if (style === 'half') {
        if (i === 0 || i === 10) kick(ti, 0.9);
        if (i === 8) snare(ti, 0.8, rev);
        if (i % 2 === 0 || sixteenths) hit(ti, 0.05, i % 4 === 0 ? 0.35 : 0.22, 'highpass', 8000);
      } else if (style === 'drive') {
        if (i === 0 || i === 8 || i === 10 || (sixteenths && i === 6)) kick(ti, 1);
        if (i === 4 || i === 12) snare(ti, 0.85, rev * 0.5);
        if (i % 2 === 0 || sixteenths) hit(ti, 0.05, i % 4 === 2 ? 0.4 : 0.25, 'highpass', 8000);
      } else if (style === 'build') {
        if (i % 4 === 0) kick(ti, 0.85);
        if (lastBar ? true : i === 8) snare(ti, lastBar ? 0.2 + (0.6 * i) / 15 : 0.7, rev);
      } else if (style === 'roll') {
        if (i === 0) kick(ti, 1);
        if (i >= 8) tom(ti, 52 - (i - 8) * 2, 0.6);
      } else if (style === 'pulse') {
        if (i % 4 === 0) kick(ti, 0.75);
        if (i % 4 === 2) hit(ti, 0.12, 0.3, 'highpass', 7000, 0.2);
        if (I > 0.6 && (i === 4 || i === 12)) hit(ti, 0.15, 0.6, 'bandpass', 1300, rev);
        if (sixteenths && i % 2 === 1) hit(ti, 0.03, 0.15, 'highpass', 9000);
      }
    }
  }

  /** Hook notes falling in [w0, w0 + 4) beats of the hook timeline scaled by `scale`. */
  function hookBar(
    hook: N[],
    w0: number,
    scale: number,
    each: (n: N, beatInBar: number, durBeats: number) => void,
  ) {
    for (const n of hook) {
      const b = n[1] * scale - w0;
      if (b >= 0 && b < 4) each(n, b, n[2] * scale);
    }
  }

  function pickTheme(): ThemeDef {
    if (mode === 'game' && sky) return MAP_THEMES[sky];
    return THEMES[`title-${nation}`] ?? THEMES['title-concord']!;
  }
  function nextSection(from: number, I: number): number {
    const n = theme.sections.length;
    let i = from;
    for (let k = 0; k < n; k++) {
      i = i + 1 >= n ? theme.loopFrom : i + 1;
      if ((theme.sections[i]!.minI ?? 0) <= I) return i;
    }
    return theme.loopFrom;
  }

  /** Schedule one bar starting at `t`; returns its duration. */
  function scheduleBar(t: number): number {
    const want = pickTheme();
    if (want !== theme) {
      theme = want;
      sectionIdx = 0;
      barInSection = 0;
    }
    const th = theme;
    const sec = th.sections[sectionIdx]!;
    const beat = 60 / th.bpm;
    const barDur = beat * 4;
    const s16 = beat / 4;
    const at = (b: number) => t + b * beat;
    const I = effI();
    const sp = th.space;
    const lift = sec.lift ?? 0;
    const chord = th.chords[((sec.chordOffset ?? 0) + barInSection) % th.chords.length]!;
    const root = chord.root + lift;
    const tones = chord.tones.map((m) => m + lift);
    const lastBar = barInSection === sec.bars - 1;
    delay.delayTime.setValueAtTime(beat * 0.75, t);
    fb.gain.setValueAtTime(0.25 + 0.35 * sp, t);

    if (sec.pad) {
      for (const m of tones)
        tone(layers.pad, m, t, barDur, 0.05, {
          cut: 500 + 1500 * I * (1 - 0.5 * sp),
          atk: 0.08 + sp * 0.9,
          rel: 0.5 + sp * 1.5,
          det: [-9, 9],
          dly: 0.2 + 0.2 * sp,
          rev: 0.25 + 0.5 * sp,
        });
    }
    if (sec.strings) {
      for (const m of tones)
        tone(layers.orch, m + 12, t, barDur, 0.035, {
          cut: 2600,
          atk: 0.35,
          rel: 0.6,
          det: [-12, 0, 12],
          rev: 0.4,
        });
    }
    if (sec.choir) {
      for (const m of tones)
        tone(layers.orch, m, t, barDur, 0.06, {
          type: 'triangle',
          cut: 1400,
          atk: 0.6,
          rel: 1.2,
          det: [-6, 6],
          rev: 0.7,
        });
    }
    if (sec.brass === 'stabs') {
      for (const b of [0, 2.5])
        for (const m of tones)
          tone(layers.orch, m, at(b), beat * 0.6, 0.06, {
            cut: 2200,
            atk: 0.02,
            rel: 0.15,
            pluck: true,
            det: [-5, 5],
            rev: 0.3,
          });
    }
    if (sec.bells) {
      [0, 1.5, 3].forEach((b, i) =>
        bell(layers.orch, tones[i % tones.length]! + 24, at(b), 0.07, 0.4 + 0.4 * sp),
      );
    }
    if (sec.arp) {
      const ext = [...tones, ...tones.map((m) => m + 12), ...tones.map((m) => m + 24)];
      (th.arp ?? DEFAULT_ARP).forEach((idx, i) => {
        if (idx < 0) return;
        tone(layers.arp, ext[idx % ext.length]!, t + i * s16, s16 * 0.9, 0.1, {
          type: th.gritty ? 'sawtooth' : 'square',
          cut: 1500 + 2500 * I,
          pluck: true,
          atk: 0.004,
          rel: 0.1,
          dly: 0.3 + 0.35 * sp,
          rev: 0.15 + 0.3 * sp,
        });
      });
    }

    // Bass: low saw (through grit on gritty themes) plus a clean sine sub.
    const bassDest = th.gritty ? bassGrit : layers.bass;
    const bassCut = 400 + 900 * I;
    const bassNote = (m: number, b: number, d: number, peak = 0.32) => {
      tone(bassDest, m, at(b), d * beat * 0.9, peak, { cut: bassCut, pluck: true, rel: 0.06 });
      tone(layers.bass, m - 12, at(b), d * beat * 0.9, peak * 0.7, {
        type: 'sine',
        cut: 400,
        rel: 0.06,
      });
    };
    if (sec.bass === 'drone') {
      tone(bassDest, root, t, barDur, 0.22, { cut: 300 + 300 * I, atk: 0.2, rel: 0.4 });
      tone(layers.bass, root - 12, t, barDur, 0.2, { type: 'sine', cut: 300, atk: 0.2, rel: 0.4 });
    } else if (sec.bass === 'eighths') {
      for (let i = 0; i < 8; i++) bassNote(root, i / 2, 0.5, i % 2 ? 0.24 : 0.32);
    } else if (sec.bass === 'gallop') {
      for (let b = 0; b < 4; b++)
        for (const [o, d] of [
          [0, 0.5],
          [0.5, 0.25],
          [0.75, 0.25],
        ])
          bassNote(root, b + o!, d!);
    } else if (sec.bass === 'riff') {
      for (const n of th.riff ?? []) bassNote(root + n[0], n[1], n[2]);
    }

    // Guitar: power chord = root, fifth, octave from the low-E register.
    if (sec.gtr) {
      const r = root < 40 ? root + 12 : root;
      const power = (m: number, b: number, d: number, peak: number, cut: number) => {
        for (const p of [m, m + 7, m + 12])
          tone(gtrDrive, p, at(b), d * beat, peak, {
            cut,
            pluck: true,
            det: [-7, 7],
            rel: 0.08,
            rev: 0.12,
          });
      };
      if (sec.gtr === 'chug') for (let i = 0; i < 8; i++) power(r, i / 2, 0.35, 0.09, 900);
      else if (sec.gtr === 'riff')
        for (const n of th.riff ?? []) power(r + n[0], n[1], n[2] * 0.85, 0.08, n[3] ? 2600 : 1200);
      else {
        power(r, 0, 2.3, 0.1, 3500);
        power(r, 2.5, 1.4, 0.1, 3500);
      }
    }

    // Lead: the hook, positioned by the section bar on the 32-beat hook timeline.
    if (sec.lead || sec.brass === 'hook') {
      const double = sec.lead === 'hook2x';
      const scale = double ? 0.5 : 1;
      const w0 = (barInSection * 4) % (double ? 16 : 32);
      hookBar(th.hook, w0, scale, (n, b, d) => {
        const m = n[0] + lift;
        const accent = n[3] ? 1.3 : 1;
        if (sec.lead === 'solo')
          tone(layers.lead, m, at(b), d * beat * 0.95, 0.12 * accent, {
            type: 'triangle',
            cut: 2400,
            atk: 0.04,
            rel: 0.4,
            dly: 0.35 + 0.2 * sp,
            rev: 0.4 + 0.3 * sp,
          });
        else if (sec.lead === 'bells') bell(layers.lead, m, at(b), 0.12 * accent, 0.6 + 0.3 * sp);
        else if (sec.lead)
          tone(layers.lead, m, at(b), d * beat * 0.95, 0.045 * accent, {
            cut: 3200 + 1500 * I,
            atk: 0.015,
            rel: 0.25,
            det: [-14, 0, 14],
            dly: 0.25 + 0.2 * sp,
            rev: 0.25 + 0.3 * sp,
          });
        if (sec.brass === 'hook')
          tone(layers.orch, m - 12, at(b), d * beat * 0.95, 0.05, {
            cut: 1800,
            atk: 0.04,
            rel: 0.2,
            det: [-6, 6],
            rev: 0.3,
          });
      });
    }

    const drumsOn = sec.drums !== 'none' && I >= (sec.drumsMinI ?? 0);
    if (drumsOn) drums(sec, t, s16, I, lastBar, 0.1 + 0.3 * sp);
    if (sec.crash && barInSection === 0) hit(t, 1.8, 0.35, 'highpass', 5000, 0.4);
    if (sec.riser && barInSection === Math.max(0, sec.bars - 2))
      hit(t, barDur * 2, 0.25, 'bandpass', 300, 0.5, 6000);

    // Advance the form. At 2-bar lines the song follows combat: calm sections jump into the fight ones
    // when the fight starts, fight sections drop out when it ends (instead of waiting out up to 8 bars).
    barInSection++;
    const calm = (sec.minI ?? 0) < 0.5;
    const hot = mode === 'game' && I >= HOT_I;
    if (barInSection >= sec.bars || (barInSection % 2 === 0 && mode === 'game' && calm === hot)) {
      const fight = th.sections.findIndex((s) => (s.minI ?? 0) >= 0.5);
      sectionIdx = hot && calm && fight >= 0 ? fight : nextSection(sectionIdx, I);
      barInSection = 0;
    }
    steps += 16;
    return barDur;
  }

  function tick() {
    if (ac.state !== 'running') return;
    if (nextBar < ac.currentTime) nextBar = ac.currentTime + 0.05;
    while (nextBar < ac.currentTime + LOOKAHEAD_S) nextBar += scheduleBar(nextBar);
  }

  return {
    start() {
      if (timer) return;
      nextBar = ac.currentTime + 0.1;
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
      if (m === 'lobby') sky = null;
      retarget();
    },
    setNation(n) {
      nation = n;
    },
    setMap(map) {
      sky = map?.env.sky ?? null;
    },
    stats: () => ({
      steps,
      intensity,
      mode,
      theme: theme.id,
      section: theme.sections[sectionIdx]?.name ?? '',
    }),
  };
}
