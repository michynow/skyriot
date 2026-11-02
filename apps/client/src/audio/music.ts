import type { MapDef, NationId } from '@skyriot/shared';
import { MAP_THEMES, THEMES, type N, type SectionDef, type ThemeDef } from './score';

/**
 * Score player for the composed themes in score.ts. A lookahead scheduler (setInterval only wakes it; every
 * note is placed on the AudioContext clock) renders one bar at a time of the current section. The lobby plays
 * the nation's title theme, the game plays the loaded Map's theme (opening with its 2-bar sting). Intensity
 * (0 idle, ~0.5 enemies near, 1 combat) works twice: layer gains crossfade continuously, and the form jumps
 * into its fight sections (pre-chorus, chorus, breakdown, key-lifted finale) when combat starts and back out
 * to the verses when it ends.
 *
 * Performance is humanised so it doesn't sound sequenced: per-note velocity and timing jitter, swing, a
 * legato lead with portamento slides and bends, vibrato that blooms on long notes, and section dynamics.
 * Everything runs through a gentle tape-style saturator before the music bus.
 */
export type MusicMode = 'lobby' | 'game';

const LOOKAHEAD_S = 0.3;
const TICK_MS = 25;
/** Intensity the lobby plays at (title themes have no fight sections; this sets drum/lead levels). */
const LOBBY_I = 0.6;
const HOT_I = 0.75;
/** Notes closer than this to the previous lead note's end play legato (glide, no re-attack). */
const LEGATO_GAP_S = 0.08;
const DEFAULT_ARP = [0, 1, 2, 3, 4, 3, 2, 1, 0, 1, 2, 3, 4, 3, 2, 1];
const hz = (m: number) => 440 * 2 ** ((m - 69) / 12);
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const ramp = (v: number, a: number, b: number) => clamp01((v - a) / (b - a));
/** ±`amount` random spread, for humanising timing and velocity. */
const jitter = (amount: number) => (Math.random() * 2 - 1) * amount;

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
  /** Filter envelope: cutoff starts at cut * open and settles to cut (>1 bright attack, <1 swells open). */
  open?: number;
  atk?: number;
  rel?: number;
  det?: number[];
  /** Filter closes over the note (plucks, palm mutes). */
  pluck?: boolean;
  /** Vibrato depth in cents; it blooms in over the note, and only on notes long enough to sing. */
  vib?: number;
  /** Portamento: start at this MIDI pitch and glide to the note over `glide` seconds. */
  from?: number;
  glide?: number;
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
  let level = 1;
  /** Layers play at fight level during a sting, whatever the intensity. */
  let stingBoost = false;
  /** Last lead note, for legato and portamento across bars. */
  let lastLead = { m: 0, end: 0 };
  let timer: ReturnType<typeof setInterval> | null = null;

  // Master chain: section-level gain -> soft tape saturation -> gentle top roll-off -> music bus.
  const mix = ac.createGain();
  const tape = ac.createWaveShaper();
  const tapeCurve = new Float32Array(2048);
  for (let i = 0; i < tapeCurve.length; i++) {
    const x = (i / (tapeCurve.length - 1)) * 2 - 1;
    tapeCurve[i] = Math.tanh(1.4 * x) / Math.tanh(1.4);
  }
  tape.curve = tapeCurve;
  tape.oversample = '2x';
  const tapeTone = ac.createBiquadFilter();
  tapeTone.type = 'lowpass';
  tapeTone.frequency.value = 11000;
  mix.connect(tape).connect(tapeTone).connect(out);

  // Shared FX: tempo-synced dotted-8th echo and a generated 3 s hall impulse.
  const delay = ac.createDelay(2);
  const fb = ac.createGain();
  const dlp = ac.createBiquadFilter();
  const delayOut = ac.createGain();
  dlp.type = 'lowpass';
  dlp.frequency.value = 2600;
  delayOut.gain.value = 0.5;
  delay.connect(dlp).connect(fb).connect(delay);
  dlp.connect(delayOut).connect(mix);
  const verb = ac.createConvolver();
  const ir = ac.createBuffer(2, Math.floor(ac.sampleRate * 3), ac.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    // Darkening tail: the noise is smoothed more as it decays, like air absorbing the highs.
    let lp = 0;
    for (let i = 0; i < d.length; i++) {
      const k = i / d.length;
      lp += (Math.random() * 2 - 1 - lp) * (1 - 0.85 * k);
      d[i] = lp * (1 - k) ** 2.5;
    }
  }
  verb.buffer = ir;
  const verbOut = ac.createGain();
  verbOut.gain.value = 0.7;
  verb.connect(verbOut).connect(mix);

  // Pads, strings, arps and bass sit on a bus that ducks on every kick (theme.pump), so drums punch through.
  const pumpBus = ac.createGain();
  pumpBus.connect(mix);
  const mk = (dest: AudioNode) => {
    const g = ac.createGain();
    g.gain.value = 0;
    g.connect(dest);
    return g;
  };
  const layers = {
    pad: mk(pumpBus),
    orch: mk(pumpBus),
    bass: mk(pumpBus),
    arp: mk(pumpBus),
    drums: mk(mix),
    gtr: mk(mix),
    lead: mk(mix),
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
  /** Drive into a cabinet-ish lowpass with a mid bump, trimmed down from the drive's near-full-scale output. */
  const amp = (k: number, trim: number, dest: AudioNode) => {
    const drive = shaperOf(k);
    const cab = ac.createBiquadFilter();
    cab.type = 'lowpass';
    cab.frequency.value = 4200;
    const mid = ac.createBiquadFilter();
    mid.type = 'peaking';
    mid.frequency.value = 1500;
    mid.gain.value = 4;
    const g = ac.createGain();
    g.gain.value = trim;
    drive.connect(cab).connect(mid).connect(g).connect(dest);
    return drive;
  };
  // Rhythm guitar: voices sum *before* the drive so power chords intermodulate. The lead guitar has its own amp.
  const gtrDrive = amp(9, 0.12, layers.gtr);
  const leadDrive = amp(5, 0.18, layers.lead);
  // Gritty themes push the bass through mild drive.
  const bassGrit = shaperOf(3);
  bassGrit.connect(layers.bass);

  const effI = () => (mode === 'lobby' ? LOBBY_I : intensity);
  function retarget(tc = 0.7) {
    const I = stingBoost ? Math.max(effI(), 0.9) : effI();
    const tgt: Record<Layer, number> = {
      pad: 0.8 - 0.2 * I,
      orch: 0.8,
      bass: 0.5 + 0.6 * ramp(I, 0.1, 0.6),
      drums: 0.3 + 0.8 * ramp(I, 0.3, 0.9),
      gtr: 0.25 + 0.75 * ramp(I, 0.1, 0.9),
      arp: 0.55 + 0.45 * ramp(I, 0.1, 0.6),
      lead: 0.7 + 0.4 * ramp(I, 0.4, 1),
    };
    const now = ac.currentTime;
    for (const k of Object.keys(layers) as Layer[]) layers[k].gain.setTargetAtTime(tgt[k], now, tc);
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
    const hold = t + Math.max(atk, dur);
    const g = ac.createGain();
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(cut * (v.open ?? 1), t);
    if (v.open) lp.frequency.exponentialRampToValueAtTime(cut, t + Math.max(0.25, atk));
    if (v.pluck) lp.frequency.exponentialRampToValueAtTime(Math.max(150, cut * 0.25), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + atk);
    g.gain.setValueAtTime(peak, hold);
    g.gain.setTargetAtTime(0.0001, hold, rel / 3);
    lp.connect(g).connect(dest);
    send(g, delay, v.dly ?? 0);
    send(g, verb, v.rev ?? 0);
    const end = hold + rel + 0.05;
    let lfoGain: GainNode | null = null;
    if (v.vib && dur > 0.4) {
      const lfo = ac.createOscillator();
      lfoGain = ac.createGain();
      lfo.frequency.value = 5 + Math.random();
      lfoGain.gain.setValueAtTime(0, t);
      lfoGain.gain.setValueAtTime(0, t + dur * 0.3);
      lfoGain.gain.linearRampToValueAtTime(v.vib, t + dur * 0.85);
      lfo.connect(lfoGain);
      lfo.start(t);
      lfo.stop(end);
    }
    for (const det of v.det ?? [0]) {
      const o = ac.createOscillator();
      o.type = v.type ?? 'sawtooth';
      if (v.from !== undefined && v.from !== m) {
        o.frequency.setValueAtTime(hz(v.from), t);
        o.frequency.exponentialRampToValueAtTime(hz(m), t + (v.glide ?? 0.06));
      } else o.frequency.value = hz(m);
      o.detune.value = det + jitter(2);
      if (lfoGain) lfoGain.connect(o.detune);
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
  /** Felt piano: two detuned triangles and a soft 2nd harmonic, a velocity-bright filter that darkens as the note
   *  rings, a long natural decay (longer in the bass), a damper at note-off and a faint hammer knock. */
  function piano(dest: AudioNode, m: number, t: number, dur: number, vel: number, rev: number) {
    const decay = 0.8 + 2.4 * clamp01((84 - m) / 44);
    const g = ac.createGain();
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(900 + 4500 * vel, t);
    lp.frequency.exponentialRampToValueAtTime(500 + 900 * vel, t + decay * 0.6);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.13 * vel, t + 0.004);
    g.gain.setTargetAtTime(0.0001, t + 0.004, decay / 3);
    g.gain.setTargetAtTime(0.0001, t + Math.max(dur, 0.15), 0.12);
    lp.connect(g).connect(dest);
    send(g, verb, rev);
    send(g, delay, rev * 0.25);
    const end = t + Math.max(dur, 0.15) + 0.6;
    for (const [mul, det, lvl, type] of [
      [1, -3, 1, 'triangle'],
      [1, 4, 1, 'triangle'],
      [2, 0, 0.25, 'sine'],
    ] as const) {
      const o = ac.createOscillator();
      const og = ac.createGain();
      o.type = type;
      o.frequency.value = hz(m) * mul;
      o.detune.value = det;
      og.gain.value = lvl;
      o.connect(og).connect(lp);
      o.start(t);
      o.stop(end);
    }
    hit(t, 0.025, 0.02 * vel, 'bandpass', 2500, 0, 0, dest);
  }
  function hit(
    t: number,
    dur: number,
    peak: number,
    ftype: BiquadFilterType,
    f: number,
    rev = 0,
    sweepTo = 0,
    dest: AudioNode = layers.drums,
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
    s.connect(flt).connect(g).connect(dest);
    send(g, verb, rev);
    s.start(t, Math.random() * 1.5);
    s.stop(t + dur + 0.05);
  }
  /** Pitched drum body: a sine that drops from `from` to `to` Hz. */
  function thump(
    t: number,
    from: number,
    to: number,
    drop: number,
    decay: number,
    peak: number,
    rev = 0,
  ) {
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.frequency.setValueAtTime(from, t);
    o.frequency.exponentialRampToValueAtTime(to, t + drop);
    g.gain.setValueAtTime(peak, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    o.connect(g).connect(layers.drums);
    send(g, verb, rev);
    o.start(t);
    o.stop(t + decay + 0.05);
  }
  function kick(t: number, peak: number) {
    thump(t, 170, 45, 0.11, 0.42, peak);
    hit(t, 0.012, peak * 0.5, 'highpass', 3000);
    if (theme.pump > 0) {
      pumpBus.gain.setValueAtTime(1 - theme.pump, t);
      pumpBus.gain.setTargetAtTime(1, t + 0.02, 0.07);
    }
  }
  function snare(t: number, peak: number, rev: number) {
    hit(t, 0.22, peak, 'bandpass', 1800, rev);
    hit(t, 0.08, peak * 0.6, 'highpass', 5000);
    thump(t, 260, 180, 0.04, 0.12, peak * 0.55);
  }
  const tom = (t: number, m: number, peak: number) =>
    thump(t, hz(m) * 1.5, hz(m), 0.08, 0.35, peak, 0.3);
  /** Chorus downbeat: crash (or thunder) plus a sub drop. */
  function impact(t: number) {
    if (theme.thunder) hit(t, 3, 0.5, 'lowpass', 260, 0.6);
    else hit(t, 1.8, 0.35, 'highpass', 5000, 0.4);
    thump(t, 70, 32, 0.8, 1.2, 0.7);
  }

  function drums(
    sec: SectionDef,
    t: number,
    s16: number,
    swing: number,
    I: number,
    lastBar: boolean,
    rev: number,
  ) {
    const style = sec.drums;
    const hot = I > 0.85;
    for (let i = 0; i < 16; i++) {
      const ti = t + i * s16 + (i % 2 ? swing : 0) + jitter(0.004);
      // Velocity humanisation: every hit a little different, ghost-ish on the off-beats.
      const v = (p: number) => p * (0.85 + Math.random() * 0.25) * (i % 4 ? 0.85 : 1);
      if (style === 'half') {
        if (i === 0 || i === 10) kick(ti, v(0.9));
        if (i === 8) snare(ti, v(0.8), rev);
        if (i % 2 === 0 || hot) hit(ti, 0.05, v(i % 4 === 0 ? 0.35 : 0.22), 'highpass', 8000);
      } else if (style === 'drive') {
        if ([0, 8, 10].includes(i) || (hot && [3, 6, 14].includes(i))) kick(ti, v(1));
        if (i === 4 || i === 12) snare(ti, v(0.9), rev * 0.5);
        if (i === 14) hit(ti, 0.18, v(0.35), 'highpass', 6500);
        else if (i % 2 === 0 || hot) hit(ti, 0.05, v(i % 4 === 2 ? 0.4 : 0.25), 'highpass', 8000);
      } else if (style === 'build') {
        if (i % 4 === 0) kick(ti, v(0.85));
        if (lastBar ? true : i === 8 || i === 12)
          snare(ti, lastBar ? 0.2 + (0.7 * i) / 15 : v(0.7), rev);
      } else if (style === 'roll') {
        if (i === 0) kick(ti, 1);
        if (i >= 8 || lastBar) tom(ti, 52 - (i % 8) * 2, v(0.6));
      } else if (style === 'pulse') {
        if (i % 4 === 0) kick(ti, v(0.85));
        if (i % 4 === 2) hit(ti, 0.14, v(0.32), 'highpass', 7000, 0.2);
        if (I > 0.6 && (i === 4 || i === 12)) {
          hit(ti, 0.16, v(0.7), 'bandpass', 1300, rev);
          hit(ti + 0.012, 0.1, 0.4, 'bandpass', 1500);
        }
        if (hot && i % 2 === 1) hit(ti, 0.03, v(0.15), 'highpass', 9000);
      } else if (style === 'taiko') {
        // Big low drums in a hall instead of a kit: accents on 1 and the "and" of 3.
        if (i === 0 || i === 10) tom(ti, 33, v(1));
        if (i === 3 || i === 6) tom(ti, 36, v(0.6));
        if (i === 8 || i === 12) tom(ti, 43, v(0.75));
        if (hot && (i === 13 || i === 14 || i === 15)) tom(ti, 48, v(0.45));
        if (i === 0 || i === 10) kick(ti, 0.6);
      } else if (style === 'hits') {
        if (i === 0 || i === 6 || i === 8) {
          kick(ti, 1);
          tom(ti, i === 6 ? 43 : 36, 0.8);
        }
        if (lastBar && i >= 12) snare(ti, 0.4 + 0.1 * (i - 12), rev);
      }
    }
  }

  /** Notes of `line` falling in [w0, w0 + 4) beats of its 32-beat timeline. */
  function lineBar(line: N[], w0: number, each: (n: N, beatInBar: number) => void) {
    for (const n of line) {
      const b = n[1] - w0;
      if (b >= 0 && b < 4) each(n, b);
    }
  }
  /** One lead note in the theme's voice, played legato with glides and bends where the phrase calls for it. */
  function leadNote(
    th: ThemeDef,
    n: N,
    m: number,
    t: number,
    dur: number,
    gain: number,
    I: number,
    double: boolean,
  ) {
    const sp = th.space;
    const vel = n[3] ?? 0.8;
    const g = gain * (vel / 0.8) * (0.92 + Math.random() * 0.16);
    const legato = lastLead.m > 0 && Math.abs(t - lastLead.end) < LEGATO_GAP_S;
    let from: number | undefined;
    let glide = 0.06;
    if (n[4] === 'bend') {
      from = m - 2;
      glide = 0.16;
    } else if ((n[4] === 'slide' || legato) && lastLead.m > 0) {
      from = lastLead.m;
      glide = n[4] === 'slide' ? 0.14 : 0.05;
    }
    // Legato notes ease in instead of re-attacking.
    const atk = (base: number) => (legato ? Math.max(base, 0.04) : base);
    lastLead = { m, end: t + dur };
    if (th.voice === 'guitar') {
      tone(leadDrive, m, t, dur, 0.3 * g, {
        cut: 2400,
        open: 1.8,
        atk: atk(0.006),
        rel: 0.25,
        det: [-5, 5],
        vib: 30,
        from,
        glide,
        rev: 0.3,
        dly: 0.18,
      });
    } else if (th.voice === 'piano') {
      piano(layers.lead, m, t, dur, clamp01(0.75 * g), 0.75);
      // In the chorus, strings double the piano so the melody sings over the band.
      if (double)
        tone(layers.lead, m, t, dur, 0.035 * g, {
          det: [-8, 8],
          cut: 1600,
          open: 0.6,
          atk: 0.25,
          rel: 0.8,
          vib: 12,
          rev: 0.7,
        });
    } else if (th.voice === 'soar') {
      tone(layers.lead, m, t, dur, 0.04 * g, {
        det: [-14, -5, 5, 14],
        cut: 2600 + 1500 * I,
        open: 2,
        atk: atk(0.03),
        rel: 0.5,
        vib: 20,
        from,
        glide: glide * 1.5,
        dly: 0.5,
        rev: 0.5,
      });
    } else {
      tone(layers.lead, m, t, dur, 0.045 * g, {
        cut: 3200 + 1500 * I,
        atk: 0.015,
        rel: 0.25,
        det: [-14, 0, 14],
        vib: 12,
        from,
        glide,
        dly: 0.25 + 0.2 * sp,
        rev: 0.25 + 0.3 * sp,
      });
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
    if ((sec.lead === 'sting') !== stingBoost) {
      stingBoost = !stingBoost;
      retarget(stingBoost ? 0.1 : 0.7);
    }
    // Section dynamics: lifts land on the downbeat, drops ease down.
    const targetLevel = sec.level ?? 1;
    if (targetLevel !== level) {
      mix.gain.setTargetAtTime(targetLevel, t, targetLevel > level ? 0.04 : 0.6);
      level = targetLevel;
    }
    const beat = 60 / th.bpm;
    const barDur = beat * 4;
    const s16 = beat / 4;
    const swing = th.swing * s16;
    /** Beat position in this bar -> time, with swing on off-beat 16ths. */
    const at = (b: number) => t + b * beat + (Math.round(b * 4) % 2 ? swing : 0);
    const human = (b: number) => at(b) + jitter(0.008);
    const I = effI();
    const sp = th.space;
    const lift = sec.lift ?? 0;
    const prog = sec.chords ?? th.chords;
    const chord = prog[((sec.chordOffset ?? 0) + barInSection) % prog.length]!;
    const root = chord.root + lift;
    const tones = chord.tones.map((m) => m + lift);
    const lastBar = barInSection === sec.bars - 1;
    delay.delayTime.setValueAtTime(beat * 0.75, t);
    fb.gain.setValueAtTime(0.25 + 0.35 * sp, t);

    if (sec.pad) {
      for (const m of tones)
        tone(layers.pad, m, t, barDur, 0.045, {
          cut: 600 + 1400 * I * (1 - 0.5 * sp),
          open: 0.4,
          atk: 0.08 + sp * 0.9,
          rel: 0.5 + sp * 1.5,
          det: [-10, -3, 4, 11],
          dly: 0.2 + 0.2 * sp,
          rev: 0.3 + 0.5 * sp,
        });
    }
    if (sec.strings) {
      for (const m of tones)
        tone(layers.orch, m + 12, human(0), barDur, 0.035, {
          cut: 2600,
          open: 0.5,
          atk: 0.35,
          rel: 0.6,
          det: [-12, 0, 12],
          vib: 8,
          rev: 0.45,
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
          vib: 6,
          rev: 0.7,
        });
    }
    if (sec.brass) {
      for (const b of [0, 2.5])
        for (const m of tones)
          tone(layers.orch, m, human(b), beat * 0.6, 0.06, {
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
        bell(
          layers.orch,
          tones[i % tones.length]! + 24,
          human(b),
          0.07 * (0.8 + Math.random() * 0.3),
          0.4 + 0.4 * sp,
        ),
      );
    }
    if (sec.keys) {
      // Left-hand broken chord: bass note, then the voicing rolled upwards and back.
      const pattern: [number, number, number][] = [
        [0, root + 12, 0.55],
        [1, tones[0]!, 0.4],
        [1.5, tones[1]!, 0.38],
        [2, tones[2]!, 0.42],
        [3, tones[1]!, 0.35],
      ];
      for (const [b, m, v] of pattern)
        piano(layers.orch, m, human(b), beat * 1.5, v * (0.85 + Math.random() * 0.3), 0.6);
    }
    if (sec.arp) {
      const ext = [...tones, ...tones.map((m) => m + 12), ...tones.map((m) => m + 24)];
      (th.arp ?? DEFAULT_ARP).forEach((idx, i) => {
        if (idx < 0) return;
        const accent = i % 4 === 0 ? 1.15 : 0.85 + Math.random() * 0.2;
        tone(layers.arp, ext[idx % ext.length]!, at(i / 4), s16 * 0.9, 0.09 * accent, {
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
    const bassCut = 400 + 1100 * I;
    const bassNote = (m: number, b: number, d: number, peak = 0.32) => {
      const p = peak * (0.9 + Math.random() * 0.15);
      tone(bassDest, m, at(b), d * beat * 0.9, p, {
        cut: bassCut,
        open: 1.6,
        pluck: true,
        rel: 0.06,
      });
      tone(layers.bass, m - 12, at(b), d * beat * 0.9, p * 0.8, {
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
    } else if (sec.bass === 'octaves') {
      for (let i = 0; i < 8; i++) bassNote(root + (i % 2) * 12, i / 2, 0.45, i % 2 ? 0.22 : 0.34);
    } else if (sec.bass === 'gallop') {
      for (let b = 0; b < 4; b++)
        for (const [o, d] of [
          [0, 0.5],
          [0.5, 0.25],
          [0.75, 0.25],
        ])
          bassNote(root, b + o!, d!, o ? 0.28 : 0.36);
    } else if (sec.bass === 'riff') {
      for (const n of th.riff ?? []) bassNote(root + n[0], n[1], n[2]);
    }

    // Guitar: power chord = root, fifth, octave from the low-E register.
    if (sec.gtr) {
      const r = root < 40 ? root + 12 : root;
      const power = (m: number, b: number, d: number, peak: number, cut: number) => {
        const tb = human(b);
        // Strummed: each string a few ms after the last.
        [m, m + 7, m + 12].forEach((p, s) =>
          tone(gtrDrive, p, tb + s * 0.006, d * beat, peak * (0.9 + Math.random() * 0.2), {
            cut,
            pluck: true,
            det: [-7, 7],
            rel: 0.08,
            rev: 0.12,
          }),
        );
      };
      if (sec.gtr === 'chug')
        for (let i = 0; i < 8; i++) power(r, i / 2, 0.35, i % 2 ? 0.07 : 0.09, 900);
      else if (sec.gtr === 'riff')
        for (const n of th.riff ?? []) power(r + n[0], n[1], n[2] * 0.85, 0.08, n[3] ? 2600 : 1200);
      else {
        power(r, 0, 2.3, 0.1, 3500);
        power(r, 2.5, 1.4, 0.1, 3500);
      }
    }

    // Lead and countermelody, positioned by the section bar on their 32-beat timelines.
    const w0 = (barInSection * 4) % 32;
    if (sec.lead) {
      const part = sec.lead;
      const line =
        part === 'sting' ? (th.sting ?? []) : part === 'verse' ? (th.verse ?? th.hook) : th.hook;
      // Teases only play the call (hook bars 1-2 and 5-6), quietly: the breakdown remembers the chorus.
      const skip = part === 'tease' && (w0 / 4) % 4 >= 2;
      if (!skip)
        lineBar(line, w0, (n, b) => {
          const m = n[0] + lift;
          const tn = human(b);
          const len = n[2] * beat * 0.97;
          if (part === 'solo')
            tone(layers.lead, m, tn, len, 0.12 * ((n[3] ?? 0.8) / 0.8), {
              type: 'triangle',
              cut: 2400,
              atk: 0.04,
              rel: 0.4,
              vib: 10,
              dly: 0.35 + 0.2 * sp,
              rev: 0.4 + 0.3 * sp,
            });
          else if (part === 'bells') bell(layers.lead, m, tn, 0.12, 0.6 + 0.3 * sp);
          else {
            const gain = part === 'verse' ? 0.8 : part === 'tease' ? 0.5 : 1.05;
            leadNote(th, n, m, tn, len, gain, I, part === 'hook' || part === 'sting');
          }
          if (part === 'sting')
            tone(layers.orch, m - 12, tn, len, 0.05, {
              cut: 1800,
              atk: 0.04,
              rel: 0.2,
              det: [-6, 6],
              rev: 0.3,
            });
        });
    }
    if (sec.counter && th.counter) {
      lineBar(th.counter, w0, (n, b) =>
        tone(layers.orch, n[0] + lift, human(b), n[2] * beat, 0.05 * (0.9 + Math.random() * 0.2), {
          det: [-6, 6],
          cut: 1300,
          open: 0.5,
          atk: 0.2,
          rel: 0.6,
          vib: 14,
          rev: 0.5,
        }),
      );
    }

    const drumsOn = sec.drums !== 'none' && I >= (sec.drumsMinI ?? 0);
    if (drumsOn) drums(sec, t, s16, swing, I, lastBar, 0.1 + 0.3 * sp);
    if (sec.crash && barInSection === 0) impact(t);
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
