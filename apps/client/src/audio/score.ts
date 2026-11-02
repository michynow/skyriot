/**
 * Composed score data (original material, ADR 0005). Pitches are MIDI numbers; times are in beats (4/4).
 * Lobby title themes share one 8-bar main hook (the "Skyriot theme") re-harmonised per nation; each Map
 * sky has its own song (rock / ambient / spacey): a quiet verse melody, a chorus hook that peaks, a countermelody,
 * an intro sting, and a key change (or borrowed chords) into the final chorus.
 * Hooks, progressions and stingers are written note-for-note; the engine in music.ts plays them.
 */
import type { MapDef } from '@skyriot/shared';

/** velocity 0..1 (default 0.8, 1 = accent); art: 'bend' = pre-bent a tone below and bent up, 'slide' = portamento from the previous note. */
export type N = [
  midi: number,
  startBeat: number,
  durBeats: number,
  velocity?: number,
  art?: 'bend' | 'slide',
];

// ---- The main hook (A minor), 8 bars = 32 beats. Question (bars 1-4) rises to E5; answer (5-8) descends home. ----
const HOOK_MINOR: N[] = [
  // bar 1-2: leap up a fifth, turn, climb to C5 and settle on A4
  [64, 0, 1],
  [69, 1, 1.5],
  [67, 2.5, 0.5],
  [69, 3, 1],
  [72, 4, 1.5],
  [71, 5.5, 0.5],
  [69, 6, 2],
  // bar 3-4: same shape, then lift to D5 -> E5 (open question)
  [64, 8, 1],
  [69, 9, 1.5],
  [67, 10.5, 0.5],
  [69, 11, 1],
  [74, 12, 1.5],
  [72, 13.5, 0.5],
  [76, 14, 2, 1],
  // bar 5-6: answer from E5, up to A5
  [76, 16, 1],
  [72, 17, 1.5],
  [74, 18.5, 0.5],
  [76, 19, 1],
  [81, 20, 1.5],
  [79, 21.5, 0.5],
  [76, 22, 2],
  // bar 7-8: stepwise fall F-E-D-C, then B-E-A home
  [77, 24, 1],
  [76, 25, 1],
  [74, 26, 1],
  [72, 27, 1],
  [71, 28, 1],
  [76, 29, 1],
  [69, 30, 2],
];

/** Concord: same notes, but the last bar resolves to C (relative major) for a heroic close. */
const HOOK_CONCORD: N[] = [...HOOK_MINOR.slice(0, -3), [71, 28, 1], [74, 29, 1], [72, 30, 2]];

/** Vex: B flattened (Phrygian b2) in bar 2 and the last bar ends on a tritone-sour Bb-E-A. */
const HOOK_VEX: N[] = HOOK_MINOR.map((n): N => (n[1] === 5.5 ? [70, 5.5, 0.5] : n))
  .slice(0, -3)
  .concat([
    [70, 28, 1],
    [76, 29, 1],
    [69, 30, 2],
  ]);

export interface ChordDef {
  root: number;
  tones: number[];
}
const C = (root: number, ...tones: number[]): ChordDef => ({ root, tones });

// Concord: C F Am G | C F Dm C  (major colour)
const CHORDS_CONCORD: ChordDef[] = [
  C(36, 55, 60, 64),
  C(41, 53, 57, 60),
  C(45, 57, 60, 64),
  C(43, 55, 59, 62),
  C(36, 55, 60, 64),
  C(41, 53, 57, 60),
  C(38, 53, 57, 62),
  C(36, 55, 60, 64),
];
// Vex: Am Bb Am E | Am Bb Dm E  (Phrygian b2 and harmonic-minor dominant)
const CHORDS_VEX: ChordDef[] = [
  C(45, 57, 60, 64),
  C(46, 58, 62, 65),
  C(45, 57, 60, 64),
  C(40, 56, 59, 64),
  C(45, 57, 60, 64),
  C(46, 58, 62, 65),
  C(38, 57, 62, 65),
  C(40, 56, 59, 64),
];

export type DrumStyle = 'none' | 'half' | 'drive' | 'build' | 'roll' | 'pulse' | 'taiko' | 'hits';
export type BassStyle = 'none' | 'drone' | 'eighths' | 'gallop' | 'riff' | 'octaves';

export interface SectionDef {
  name: string;
  bars: number;
  /** Progression for this section (defaults to the theme's `chords`). */
  chords?: ChordDef[];
  /** First chord bar to use (4-bar sections can borrow bars 5-8). */
  chordOffset?: number;
  /**
   * Section only plays at or above this intensity. Sections at 0.5+ are the "fight" part of the form:
   * entering combat jumps to the first of them at the next 2-bar line, leaving combat jumps back out.
   */
  minI?: number;
  /** Section loudness 0..1 (quiet verses, a dipped breakdown, then the lift). Default 1. */
  level?: number;
  drums: DrumStyle;
  /** Drums only play above this intensity (calm passes of a section stay drumless). */
  drumsMinI?: number;
  bass: BassStyle;
  pad?: boolean;
  strings?: boolean;
  choir?: boolean;
  brass?: boolean;
  bells?: boolean;
  arp?: boolean;
  /** Piano broken chords (left hand). */
  keys?: boolean;
  /** Distorted power-chord guitar: 'chug' palm-muted 8ths, 'riff' plays the theme riff, 'power' open hits. */
  gtr?: 'chug' | 'riff' | 'power';
  /**
   * 'solo' = soft hook (titles); 'verse' = the theme's verse melody; 'hook' = the chorus hook;
   * 'tease' = only the hook's call bars, quietly (breakdowns); 'bells' = hook on bells; 'sting' = intro fanfare.
   */
  lead?: 'solo' | 'verse' | 'tease' | 'bells' | 'hook' | 'sting';
  /** Play the theme's countermelody under the lead. */
  counter?: boolean;
  crash?: boolean;
  riser?: boolean;
  /** Key lift in semitones for the whole section (final-chorus key change). */
  lift?: number;
}

export interface ThemeDef {
  id: string;
  bpm: number;
  chords: ChordDef[];
  /** Chorus hook, 8 bars: bars 1-2 call, 3-4 answer, 5-6 the call again but higher (the peak), 7-8 resolution. */
  hook: N[];
  /** Verse melody, 8 bars: lower and quieter, with rests to breathe, leading into the hook. */
  verse?: N[];
  /** Long-note countermelody under the hook (8 bars). */
  counter?: N[];
  /** 2-bar heroic fanfare played once when the theme starts (built from the hook's call). */
  sting?: N[];
  gritty: boolean;
  sections: SectionDef[];
  /** Index to loop back to after the last section (skips the sting / intro). */
  loopFrom: number;
  /** One-bar riff; pitch is semitones above the bar's power-chord root (stick to 0/5/7/10/12 so it fits any chord). */
  riff?: N[];
  /** 16 arp steps, each an index into the bar's chord tones stacked over three octaves (-1 = rest). */
  arp?: number[];
  /** 0 dry .. 1 vast: pad attack/release, echo feedback and reverb send. */
  space: number;
  /** Lead voice: bending overdriven guitar, felt piano, soaring portamento supersaw, or plain supersaw. */
  voice: 'guitar' | 'piano' | 'soar' | 'supersaw';
  /** Sidechain-style duck of pads/bass on every kick, 0..1 depth (the "pump"). */
  pump: number;
  /** Delay of every off-beat 16th, as a fraction of a 16th (0 straight .. ~0.3 shuffled). */
  swing: number;
  /** Crashes are low thunder rolls instead of cymbals. */
  thunder?: boolean;
}

const TITLE_FORM = (gritty: boolean): SectionDef[] => [
  // Solo hook over pads: the whole 8-bar melody once, slow and majestic.
  { name: 'intro', bars: 8, drums: 'none', bass: 'drone', pad: true, lead: 'solo' },
  // Full arrangement.
  {
    name: 'main',
    bars: 8,
    drums: 'half',
    bass: 'eighths',
    pad: true,
    strings: true,
    choir: true,
    bells: !gritty,
    arp: gritty,
    lead: 'hook',
    crash: true,
  },
];

// ==== Rustwater (desert-dusk): anthemic rock, E minor, 144 bpm. ====
// Verse  Em9 Cmaj7 G Dsus4 | Em9 Cmaj7 Am7 B7
const RUST_VERSE_CHORDS: ChordDef[] = [
  C(40, 55, 59, 62, 66),
  C(36, 52, 55, 59, 64),
  C(43, 55, 59, 62, 67),
  C(38, 57, 62, 67),
  C(40, 55, 59, 62, 66),
  C(36, 52, 55, 59, 64),
  C(45, 55, 60, 64, 67),
  C(47, 54, 59, 63, 69),
];
// Chorus  Cadd9 G D Em7 | Cadd9 G Dsus4 B7  (VI-III-VII-i: lifts away from the verse's minor colour)
const RUST_CHORUS_CHORDS: ChordDef[] = [
  C(36, 55, 60, 62, 64),
  C(43, 55, 59, 62, 67),
  C(38, 54, 57, 62, 66),
  C(40, 55, 59, 62, 64),
  C(36, 55, 60, 62, 64),
  C(43, 55, 59, 62, 67),
  C(38, 57, 62, 67),
  C(47, 54, 59, 63, 69),
];
// Pre-chorus Am7 -> D9sus; the second one is Bm7 -> C#7 (iv-V of F#m) into the key change.
const RUST_PRE: ChordDef[] = [C(45, 55, 60, 64, 67), C(38, 55, 60, 64, 67)];
const RUST_PRE2: ChordDef[] = [C(47, 57, 62, 66, 69), C(37, 56, 59, 61, 65)];
const RIFF_RUST: N[] = [
  [0, 0, 0.5, 1],
  [0, 0.5, 0.25],
  [0, 0.75, 0.25],
  [12, 1, 0.5, 1],
  [0, 1.5, 0.5],
  [10, 2, 0.5, 1],
  [0, 2.5, 0.25],
  [0, 2.75, 0.25],
  [7, 3, 0.5, 1],
  [5, 3.5, 0.5],
];
// Verse: low and conversational, each phrase ends on a held note and a rest; the second half answers higher.
const VERSE_RUST: N[] = [
  [64, 0.5, 0.5, 0.6],
  [67, 1, 0.5, 0.7],
  [69, 1.5, 1, 0.8],
  [67, 2.5, 0.5, 0.6],
  [66, 3, 1, 0.7],
  [64, 4, 3, 0.75],
  [62, 8.5, 0.5, 0.6],
  [64, 9, 0.5, 0.65],
  [67, 9.5, 1, 0.75],
  [69, 10.5, 0.5, 0.7],
  [71, 11, 1, 0.85],
  [69, 12, 3, 0.8, 'slide'],
  [67, 15, 0.5, 0.6],
  [66, 15.5, 0.5, 0.6],
  [64, 16.5, 0.5, 0.65],
  [67, 17, 0.5, 0.7],
  [69, 17.5, 1, 0.8],
  [71, 18.5, 0.5, 0.75],
  [74, 19, 1, 0.9, 'bend'],
  [71, 20, 3, 0.85],
  [72, 24.5, 0.5, 0.7],
  [71, 25, 0.5, 0.7],
  [69, 25.5, 1, 0.75],
  [67, 26.5, 0.5, 0.65],
  [69, 27, 1, 0.75],
  [71, 28, 2, 0.8],
  [71, 31, 0.5, 0.7],
  [74, 31.5, 0.5, 0.8],
];
// Chorus: the call climbs E-D-E-G, the answer F#-E-F#-A; the repeat reaches a bent B5 (the peak) and falls home.
const HOOK_RUST: N[] = [
  [76, 0, 1.5, 0.9, 'slide'],
  [74, 1.5, 0.5, 0.7],
  [76, 2, 1, 0.85],
  [79, 3, 1, 0.95, 'bend'],
  [74, 4, 2, 0.85],
  [71, 6, 1, 0.7],
  [74, 7, 1, 0.8],
  [78, 8, 1.5, 0.9],
  [76, 9.5, 0.5, 0.7],
  [78, 10, 1, 0.85],
  [81, 11, 1, 0.95, 'bend'],
  [79, 12, 3, 0.9],
  [76, 15, 1, 0.75],
  [76, 16, 1.5, 0.9],
  [74, 17.5, 0.5, 0.7],
  [76, 18, 1, 0.85],
  [79, 19, 1, 0.95],
  [83, 20, 2, 1, 'bend'],
  [81, 22, 1, 0.9],
  [79, 23, 1, 0.85],
  [81, 24, 1.5, 0.9],
  [79, 25.5, 0.5, 0.75],
  [78, 26, 1, 0.8],
  [74, 27, 1, 0.75],
  [75, 28, 2, 0.85],
  [78, 30, 1, 0.8],
  [71, 31, 1, 0.75],
];
const COUNTER_RUST: N[] = [
  [64, 0, 4],
  [62, 4, 4],
  [62, 8, 2],
  [66, 10, 2],
  [67, 12, 4],
  [67, 16, 4],
  [67, 20, 2],
  [71, 22, 2],
  [69, 24, 4],
  [66, 28, 2],
  [63, 30, 2],
];
const STING_RUST: N[] = [
  [64, 0, 0.5, 1],
  [71, 0.5, 0.5],
  [76, 1, 1.5, 1, 'slide'],
  [74, 2.5, 0.5],
  [76, 3, 1],
  [79, 4, 0.75, 1, 'bend'],
  [78, 4.75, 0.75],
  [76, 5.5, 2.5, 1],
];
const ROCK_FORM: SectionDef[] = [
  {
    name: 'sting',
    bars: 2,
    chords: RUST_CHORUS_CHORDS,
    drums: 'hits',
    bass: 'drone',
    gtr: 'power',
    lead: 'sting',
    crash: true,
  },
  {
    name: 'intro',
    bars: 4,
    level: 0.6,
    drums: 'none',
    bass: 'drone',
    pad: true,
    gtr: 'chug',
    riser: true,
  },
  {
    name: 'verse',
    bars: 8,
    level: 0.7,
    drums: 'half',
    drumsMinI: 0.4,
    bass: 'eighths',
    gtr: 'chug',
    pad: true,
    lead: 'verse',
  },
  {
    name: 'verse2',
    bars: 8,
    level: 0.8,
    drums: 'drive',
    drumsMinI: 0.4,
    bass: 'riff',
    gtr: 'riff',
    lead: 'verse',
  },
  {
    name: 'pre',
    bars: 2,
    minI: 0.75,
    level: 0.85,
    chords: RUST_PRE,
    drums: 'build',
    bass: 'eighths',
    gtr: 'chug',
    strings: true,
    riser: true,
  },
  {
    name: 'chorus',
    bars: 8,
    minI: 0.75,
    chords: RUST_CHORUS_CHORDS,
    drums: 'drive',
    bass: 'gallop',
    gtr: 'power',
    pad: true,
    lead: 'hook',
    crash: true,
  },
  {
    name: 'breakdown',
    bars: 4,
    minI: 0.75,
    level: 0.5,
    chords: RUST_CHORUS_CHORDS,
    drums: 'none',
    bass: 'drone',
    pad: true,
    lead: 'tease',
  },
  {
    name: 'pre2',
    bars: 2,
    minI: 0.75,
    level: 0.9,
    chords: RUST_PRE2,
    drums: 'roll',
    bass: 'riff',
    gtr: 'riff',
    strings: true,
    riser: true,
  },
  {
    name: 'finale',
    bars: 8,
    minI: 0.75,
    chords: RUST_CHORUS_CHORDS,
    drums: 'drive',
    bass: 'gallop',
    gtr: 'power',
    pad: true,
    strings: true,
    brass: true,
    lead: 'hook',
    counter: true,
    crash: true,
    lift: 2,
  },
];

// ==== Thunderhead (storm): melancholic piano, D minor, 72 bpm, loose rubato swing. ====
// Verse  Dm9 Bbmaj7 Fmaj7 Csus2 | Dm9 Gm9 Bbmaj7 A7sus4
const STORM_VERSE_CHORDS: ChordDef[] = [
  C(38, 53, 57, 60, 64),
  C(34, 53, 57, 62, 65),
  C(41, 57, 60, 64),
  C(36, 55, 60, 62, 67),
  C(38, 53, 57, 60, 64),
  C(43, 58, 62, 65, 69),
  C(34, 53, 57, 62, 65),
  C(33, 57, 62, 64, 67),
];
// Chorus  Bbmaj7 C Dm Dm/C | Bbmaj7 C A7sus4 A7
const STORM_CHORUS_CHORDS: ChordDef[] = [
  C(34, 53, 57, 62, 65),
  C(36, 55, 60, 64, 67),
  C(38, 57, 62, 65, 69),
  C(36, 57, 62, 65),
  C(34, 53, 57, 62, 65),
  C(36, 55, 60, 64, 67),
  C(33, 57, 62, 64, 67),
  C(33, 55, 61, 64, 67),
];
const STORM_PRE: ChordDef[] = [C(43, 58, 62, 65, 69), C(33, 55, 61, 64, 67)];
// C -> Bb7 sets up Eb minor for the key-lifted finale.
const STORM_PRE2: ChordDef[] = [C(36, 55, 60, 64, 67), C(34, 56, 62, 65, 68)];
// Verse: a sighing A-C-D, then silence; each answer lands on a held colour tone (the 9th, the sus2).
const VERSE_STORM: N[] = [
  [69, 0, 1, 0.55],
  [72, 1, 1, 0.6],
  [74, 2, 2, 0.7],
  [72, 4, 1, 0.55],
  [69, 5, 3, 0.5],
  [69, 8, 1, 0.55],
  [72, 9, 1, 0.6],
  [76, 10, 2, 0.75],
  [74, 12, 4, 0.6],
  [69, 16, 1, 0.55],
  [72, 17, 1, 0.6],
  [74, 18, 1, 0.7],
  [77, 19, 1, 0.8],
  [76, 20, 2, 0.75],
  [74, 22, 2, 0.6],
  [72, 24, 1, 0.55],
  [74, 25, 1, 0.6],
  [69, 26, 2, 0.55],
  [67, 28, 2, 0.5],
  [73, 30, 2, 0.65],
];
// Chorus: climbs D-F-A, falls back by step; the repeat goes past A to Bb and a held high C (the peak), then sinks to A.
const HOOK_STORM: N[] = [
  [74, 0, 1.5, 0.8],
  [77, 1.5, 0.5, 0.75],
  [81, 2, 2, 0.9],
  [79, 4, 1.5, 0.8],
  [77, 5.5, 0.5, 0.65],
  [76, 6, 2, 0.75],
  [77, 8, 1, 0.75],
  [76, 9, 1, 0.7],
  [74, 10, 2, 0.75],
  [72, 12, 2, 0.65],
  [69, 14, 2, 0.6],
  [74, 16, 1.5, 0.8],
  [77, 17.5, 0.5, 0.75],
  [81, 18, 1, 0.9],
  [82, 19, 1, 0.95],
  [84, 20, 3, 1],
  [81, 23, 1, 0.8],
  [79, 24, 1, 0.8],
  [77, 25, 1, 0.75],
  [76, 26, 2, 0.7],
  [73, 28, 2, 0.7],
  [76, 30, 1, 0.6],
  [69, 31, 1, 0.55],
];
// Cello line: rises by step against the falling melody.
const COUNTER_STORM: N[] = [
  [50, 0, 4],
  [52, 4, 4],
  [53, 8, 4],
  [52, 12, 2],
  [50, 14, 2],
  [50, 16, 4],
  [52, 20, 4],
  [50, 24, 2],
  [52, 26, 2],
  [49, 28, 4],
];
const STING_STORM: N[] = [
  [62, 0, 1, 1],
  [69, 1, 1],
  [74, 2, 2, 1],
  [77, 4, 1],
  [76, 5, 1],
  [74, 6, 2, 1],
];
const ARP_STORM = [0, -1, -1, 2, -1, -1, 4, -1, 5, -1, -1, 4, -1, -1, 2, -1];
const STORM_FORM: SectionDef[] = [
  {
    name: 'sting',
    bars: 2,
    drums: 'hits',
    bass: 'drone',
    choir: true,
    keys: true,
    lead: 'sting',
    crash: true,
  },
  {
    name: 'calm',
    bars: 8,
    level: 0.55,
    drums: 'none',
    bass: 'drone',
    pad: true,
    keys: true,
    lead: 'verse',
  },
  {
    name: 'calm2',
    bars: 8,
    level: 0.7,
    drums: 'taiko',
    drumsMinI: 0.4,
    bass: 'drone',
    pad: true,
    keys: true,
    strings: true,
    lead: 'verse',
    counter: true,
  },
  {
    name: 'pre',
    bars: 2,
    minI: 0.75,
    level: 0.8,
    chords: STORM_PRE,
    drums: 'roll',
    bass: 'drone',
    strings: true,
    choir: true,
    keys: true,
    riser: true,
  },
  {
    name: 'storm',
    bars: 8,
    minI: 0.75,
    chords: STORM_CHORUS_CHORDS,
    drums: 'taiko',
    bass: 'eighths',
    pad: true,
    strings: true,
    choir: true,
    keys: true,
    arp: true,
    lead: 'hook',
    crash: true,
  },
  {
    name: 'eye',
    bars: 4,
    minI: 0.75,
    level: 0.45,
    chords: STORM_CHORUS_CHORDS,
    chordOffset: 4,
    drums: 'none',
    bass: 'drone',
    pad: true,
    keys: true,
    lead: 'tease',
  },
  {
    name: 'pre2',
    bars: 2,
    minI: 0.75,
    level: 0.85,
    chords: STORM_PRE2,
    drums: 'roll',
    bass: 'drone',
    strings: true,
    choir: true,
    riser: true,
  },
  {
    name: 'storm2',
    bars: 8,
    minI: 0.75,
    chords: STORM_CHORUS_CHORDS,
    drums: 'taiko',
    bass: 'gallop',
    pad: true,
    strings: true,
    choir: true,
    keys: true,
    arp: true,
    lead: 'hook',
    counter: true,
    crash: true,
    lift: 1,
  },
];

// ==== Nebula Drift (space-nebula): soaring synth over arps, A Lydian, 116 bpm. ====
// Verse  Amaj9 E/G# F#m9 Dmaj9#11 | Amaj9 C#m7 Dmaj7 Esus4
const NEBULA_VERSE_CHORDS: ChordDef[] = [
  C(45, 56, 61, 64, 71),
  C(44, 56, 59, 64, 66),
  C(42, 57, 61, 64, 68),
  C(38, 57, 61, 64, 68),
  C(45, 56, 61, 64, 71),
  C(37, 56, 59, 64, 68),
  C(38, 57, 61, 66, 69),
  C(40, 57, 59, 64, 66),
];
// Chorus  Dmaj7 E C#m7 F#m9 | Dmaj7 E Bm7 E7sus4
const NEBULA_CHORUS_CHORDS: ChordDef[] = [
  C(38, 57, 61, 66, 69),
  C(40, 56, 59, 64, 68),
  C(37, 56, 59, 64, 68),
  C(42, 57, 61, 64, 68),
  C(38, 57, 61, 66, 69),
  C(40, 56, 59, 64, 68),
  C(47, 57, 62, 66, 69),
  C(40, 57, 59, 62, 64),
];
// Borrowed bVI-bVII (Fmaj7, G6) from A minor: the classic lift back into the major chorus.
const NEBULA_PRE: ChordDef[] = [C(41, 57, 60, 64, 69), C(43, 55, 59, 62, 64)];
// Verse: floating C#-B-C# figures that settle on long #11 and maj7 colours.
const VERSE_NEBULA: N[] = [
  [73, 0, 1.5, 0.6],
  [71, 1.5, 0.5, 0.5],
  [73, 2, 2, 0.65],
  [76, 4, 3, 0.7, 'slide'],
  [73, 8, 1.5, 0.6],
  [71, 9.5, 0.5, 0.5],
  [69, 10, 2, 0.6],
  [68, 12, 4, 0.65],
  [73, 16, 1.5, 0.6],
  [71, 17.5, 0.5, 0.55],
  [73, 18, 1, 0.65],
  [76, 19, 1, 0.75],
  [80, 20, 3, 0.8, 'slide'],
  [78, 24, 1.5, 0.7],
  [76, 25.5, 0.5, 0.6],
  [73, 26, 2, 0.65],
  [71, 28, 4, 0.6],
];
// Chorus: rises A-B-C# to a held B, answers on F#; the repeat soars to a held E6 (the peak) and drifts down.
const HOOK_NEBULA: N[] = [
  [81, 0, 1, 0.8, 'slide'],
  [83, 1, 1, 0.85],
  [85, 2, 2, 0.9],
  [83, 4, 3, 0.85],
  [80, 7, 1, 0.7],
  [80, 8, 1, 0.75],
  [81, 9, 1, 0.8],
  [83, 10, 1.5, 0.85],
  [80, 11.5, 0.5, 0.7],
  [78, 12, 4, 0.8],
  [81, 16, 1, 0.8],
  [83, 17, 1, 0.85],
  [85, 18, 1, 0.9],
  [88, 19, 1, 0.95, 'slide'],
  [88, 20, 3, 1],
  [86, 24, 1.5, 0.85],
  [85, 25.5, 0.5, 0.75],
  [83, 26, 2, 0.8],
  [81, 28, 4, 0.75],
];
const COUNTER_NEBULA: N[] = [
  [69, 0, 2],
  [71, 2, 2],
  [68, 4, 4],
  [68, 8, 2],
  [69, 10, 2],
  [69, 12, 4],
  [69, 16, 4],
  [71, 20, 4],
  [74, 24, 4],
  [74, 28, 2],
  [73, 30, 2],
];
const STING_NEBULA: N[] = [
  [64, 0, 0.5],
  [69, 0.5, 0.5],
  [73, 1, 0.5],
  [76, 1.5, 2.5, 1, 'slide'],
  [80, 4, 1],
  [78, 5, 1],
  [81, 6, 2, 1, 'slide'],
];
const ARP_NEBULA = [0, 1, 2, 3, 4, 2, 3, 5, 6, 5, 4, 2, 3, 1, 2, 4];
const SPACE_FORM: SectionDef[] = [
  {
    name: 'sting',
    bars: 2,
    drums: 'hits',
    bass: 'drone',
    pad: true,
    bells: true,
    lead: 'sting',
    crash: true,
  },
  { name: 'orbit', bars: 4, level: 0.55, drums: 'none', bass: 'drone', pad: true, arp: true },
  {
    name: 'verse',
    bars: 8,
    level: 0.65,
    drums: 'pulse',
    drumsMinI: 0.4,
    bass: 'drone',
    pad: true,
    arp: true,
    lead: 'verse',
  },
  {
    name: 'verse2',
    bars: 8,
    level: 0.75,
    drums: 'pulse',
    drumsMinI: 0.4,
    bass: 'octaves',
    pad: true,
    arp: true,
    bells: true,
    lead: 'verse',
    counter: true,
  },
  {
    name: 'pre',
    bars: 2,
    minI: 0.75,
    level: 0.85,
    chords: NEBULA_PRE,
    drums: 'build',
    bass: 'octaves',
    pad: true,
    arp: true,
    riser: true,
  },
  {
    name: 'burn',
    bars: 8,
    minI: 0.75,
    chords: NEBULA_CHORUS_CHORDS,
    drums: 'pulse',
    bass: 'octaves',
    pad: true,
    choir: true,
    arp: true,
    lead: 'hook',
    crash: true,
  },
  {
    name: 'void',
    bars: 4,
    minI: 0.75,
    level: 0.45,
    chords: NEBULA_CHORUS_CHORDS,
    chordOffset: 4,
    drums: 'none',
    bass: 'drone',
    pad: true,
    arp: true,
    lead: 'tease',
  },
  {
    name: 'pre2',
    bars: 2,
    minI: 0.75,
    level: 0.9,
    chords: NEBULA_PRE,
    drums: 'build',
    bass: 'octaves',
    pad: true,
    choir: true,
    arp: true,
    riser: true,
  },
  {
    name: 'burn2',
    bars: 8,
    minI: 0.75,
    chords: NEBULA_CHORUS_CHORDS,
    drums: 'pulse',
    bass: 'octaves',
    pad: true,
    strings: true,
    arp: true,
    bells: true,
    lead: 'hook',
    counter: true,
    crash: true,
  },
];

const TITLE_EXTRAS = { space: 0.4, voice: 'supersaw', pump: 0, swing: 0 } as const;
export const THEMES: Record<string, ThemeDef> = {
  'title-concord': {
    id: 'title-concord',
    bpm: 96,
    chords: CHORDS_CONCORD,
    hook: HOOK_CONCORD,
    gritty: false,
    sections: TITLE_FORM(false),
    loopFrom: 1,
    ...TITLE_EXTRAS,
  },
  'title-vex': {
    id: 'title-vex',
    bpm: 92,
    chords: CHORDS_VEX,
    hook: HOOK_VEX,
    gritty: true,
    sections: TITLE_FORM(true),
    loopFrom: 1,
    ...TITLE_EXTRAS,
  },
  rustwater: {
    id: 'rustwater',
    bpm: 144,
    chords: RUST_VERSE_CHORDS,
    hook: HOOK_RUST,
    verse: VERSE_RUST,
    counter: COUNTER_RUST,
    sting: STING_RUST,
    riff: RIFF_RUST,
    gritty: true,
    sections: ROCK_FORM,
    loopFrom: 2,
    space: 0.2,
    voice: 'guitar',
    pump: 0.2,
    swing: 0.06,
  },
  thunderhead: {
    id: 'thunderhead',
    bpm: 72,
    chords: STORM_VERSE_CHORDS,
    hook: HOOK_STORM,
    verse: VERSE_STORM,
    counter: COUNTER_STORM,
    sting: STING_STORM,
    arp: ARP_STORM,
    gritty: false,
    sections: STORM_FORM,
    loopFrom: 1,
    space: 0.95,
    voice: 'piano',
    pump: 0,
    swing: 0.12,
    thunder: true,
  },
  'nebula-drift': {
    id: 'nebula-drift',
    bpm: 116,
    chords: NEBULA_VERSE_CHORDS,
    hook: HOOK_NEBULA,
    verse: VERSE_NEBULA,
    counter: COUNTER_NEBULA,
    sting: STING_NEBULA,
    arp: ARP_NEBULA,
    gritty: false,
    sections: SPACE_FORM,
    loopFrom: 1,
    space: 0.75,
    voice: 'soar',
    pump: 0.45,
    swing: 0,
  },
};

/** In-game theme per Map sky; the lobby plays the nation's title theme. */
export const MAP_THEMES: Record<MapDef['env']['sky'], ThemeDef> = {
  'desert-dusk': THEMES.rustwater!,
  storm: THEMES.thunderhead!,
  'space-nebula': THEMES['nebula-drift']!,
};

// ---- Stingers: one-shots that duck the music. inst picks the voice; times are beats at `bpm`. ----
export type StingerName = 'launch' | 'kill' | 'death' | 'respawn' | 'levelup';
export type Inst = 'brass' | 'bell' | 'lead' | 'strings' | 'choir' | 'kick';
export const STINGERS: Record<StingerName, { bpm: number; duckBeats: number; parts: [Inst, N][] }> =
  {
    // Launch fanfare, 2 bars: A - E - A (fifth leaps) then G - E - A held, brass over bells and timpani.
    launch: {
      bpm: 120,
      duckBeats: 8,
      parts: [
        ['kick', [36, 0, 1]],
        ['kick', [36, 4, 1]],
        ['brass', [57, 0, 1]],
        ['brass', [64, 1, 1]],
        ['brass', [69, 2, 2]],
        ['brass', [67, 4, 1]],
        ['brass', [64, 5, 1]],
        ['brass', [69, 6, 2]],
        ['bell', [81, 2, 2]],
        ['bell', [79, 4, 1]],
        ['bell', [76, 5, 1]],
        ['bell', [81, 6, 2]],
      ],
    },
    // Kill confirmed: quick rising A-C-E-A.
    kill: {
      bpm: 140,
      duckBeats: 3,
      parts: [
        ['lead', [69, 0, 0.25]],
        ['lead', [72, 0.25, 0.25]],
        ['lead', [76, 0.5, 0.25]],
        ['lead', [81, 0.75, 1]],
        ['bell', [93, 0.75, 1]],
      ],
    },
    // Death: slow falling minor phrase E-D-C-B-A on strings over a low thud.
    death: {
      bpm: 70,
      duckBeats: 8,
      parts: [
        ['kick', [34, 0, 1]],
        ['strings', [76, 0, 1]],
        ['strings', [74, 1, 1]],
        ['strings', [72, 2, 1]],
        ['strings', [71, 3, 0.5]],
        ['strings', [69, 3.5, 3]],
        ['strings', [57, 0, 6.5]],
      ],
    },
    // Respawn: rising bell arpeggio over a choir A-minor chord.
    respawn: {
      bpm: 110,
      duckBeats: 6,
      parts: [
        ['bell', [57, 0, 1]],
        ['bell', [60, 0.5, 1]],
        ['bell', [64, 1, 1]],
        ['bell', [69, 1.5, 1]],
        ['bell', [72, 2, 1]],
        ['bell', [76, 2.5, 1]],
        ['bell', [81, 3, 2]],
        ['choir', [57, 0, 5]],
        ['choir', [64, 0, 5]],
        ['choir', [69, 0, 5]],
      ],
    },
    // Level-up (reusable): C major arpeggio and a held major chord.
    levelup: {
      bpm: 130,
      duckBeats: 6,
      parts: [
        ['bell', [72, 0, 0.5]],
        ['bell', [76, 0.5, 0.5]],
        ['bell', [79, 1, 0.5]],
        ['bell', [84, 1.5, 2]],
        ['brass', [60, 1.5, 2.5]],
        ['brass', [64, 1.5, 2.5]],
        ['brass', [67, 1.5, 2.5]],
      ],
    },
  };
