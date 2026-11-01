/**
 * Composed score data (original material, ADR 0005). Pitches are MIDI numbers; times are in beats (4/4).
 * Lobby title themes share one 8-bar main hook (the "Skyriot theme") re-harmonised per nation; each Map
 * sky has its own song (rock / ambient / spacey) with its own hook.
 * Hooks, progressions and stingers are written note-for-note; the engine in music.ts plays them.
 */
import type { MapDef } from '@skyriot/shared';

export type N = [midi: number, startBeat: number, durBeats: number, velocity?: number];

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

export type DrumStyle = 'none' | 'half' | 'drive' | 'build' | 'roll' | 'pulse';
export type BassStyle = 'none' | 'drone' | 'eighths' | 'gallop' | 'riff';

export interface SectionDef {
  name: string;
  bars: number;
  /** First chord bar to use (4-bar sections can borrow bars 5-8). */
  chordOffset?: number;
  /**
   * Section only plays at or above this intensity. Sections at 0.5+ are the "fight" part of the form:
   * entering combat jumps to the first of them at the next 2-bar line, leaving combat jumps back out.
   */
  minI?: number;
  drums: DrumStyle;
  /** Drums only play above this intensity (calm passes of a section stay drumless). */
  drumsMinI?: number;
  bass: BassStyle;
  pad?: boolean;
  strings?: boolean;
  choir?: boolean;
  brass?: 'stabs' | 'hook';
  bells?: boolean;
  arp?: boolean;
  /** Distorted power-chord guitar: 'chug' palm-muted 8ths, 'riff' plays the theme riff, 'power' open hits. */
  gtr?: 'chug' | 'riff' | 'power';
  /** 'solo' = soft hook; 'bells' = hook on bells; 'hook' = supersaw hook (1 pass); 'hook2x' = double-time hook, twice. */
  lead?: 'solo' | 'bells' | 'hook' | 'hook2x';
  crash?: boolean;
  riser?: boolean;
  /** Key lift in semitones for the whole section (chorus key change). */
  lift?: number;
}

export interface ThemeDef {
  id: string;
  bpm: number;
  chords: ChordDef[];
  hook: N[];
  gritty: boolean;
  sections: SectionDef[];
  /** Index to loop back to after the last section (skips the intro). */
  loopFrom: number;
  /** One-bar riff; pitch is semitones above the bar's power-chord root (stick to 0/5/7/10/12 so it fits any chord). */
  riff?: N[];
  /** 16 arp steps, each an index into the bar's chord tones stacked over three octaves (-1 = rest). */
  arp?: number[];
  /** 0 dry .. 1 vast: pad attack/release, echo feedback and reverb send. */
  space: number;
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

// ---- Rustwater (desert-dusk): hard rock, E minor, 148 bpm. Riff-driven verse, soaring supersaw chorus. ----
// Em C G D | Em C Am B
const CHORDS_RUST: ChordDef[] = [
  C(40, 55, 59, 64),
  C(36, 55, 60, 64),
  C(43, 55, 59, 62),
  C(38, 57, 62, 66),
  C(40, 55, 59, 64),
  C(36, 55, 60, 64),
  C(45, 57, 60, 64),
  C(47, 54, 59, 63),
];
// Gallop chug with an octave jab, a flat-seven bark and a 5-4 pull back to the root.
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
// Short-long cell (B-E, F#-G) stated twice, climbing to a Bmaj7-over-C peak, then a D#-B turn back home.
const HOOK_RUST: N[] = [
  [71, 0, 0.5],
  [76, 0.5, 1],
  [78, 1.5, 0.5],
  [79, 2, 1.5],
  [78, 3.5, 0.5],
  [76, 4, 2],
  [79, 6, 0.5],
  [76, 6.5, 1.5],
  [74, 8, 0.5],
  [71, 8.5, 0.5],
  [74, 9, 1],
  [79, 10, 1],
  [81, 11, 1],
  [78, 12, 3, 1],
  [74, 15, 0.5],
  [76, 15.5, 0.5],
  [71, 16, 0.5],
  [76, 16.5, 1],
  [78, 17.5, 0.5],
  [79, 18, 1.5],
  [81, 19.5, 0.5],
  [83, 20, 1.5, 1],
  [81, 21.5, 0.5],
  [79, 22, 2],
  [81, 24, 1],
  [79, 25, 0.5],
  [76, 25.5, 0.5],
  [72, 26, 1],
  [76, 27, 1],
  [75, 28, 1],
  [78, 29, 1],
  [75, 30, 0.5],
  [71, 30.5, 1.5],
];
const ROCK_FORM: SectionDef[] = [
  {
    name: 'intro',
    bars: 4,
    drums: 'build',
    drumsMinI: 0.4,
    bass: 'drone',
    gtr: 'chug',
    riser: true,
  },
  { name: 'riff', bars: 8, drums: 'drive', drumsMinI: 0.4, bass: 'riff', gtr: 'riff', pad: true },
  {
    name: 'verse',
    bars: 8,
    drums: 'half',
    drumsMinI: 0.4,
    bass: 'eighths',
    gtr: 'chug',
    pad: true,
    lead: 'solo',
  },
  {
    name: 'chorus',
    bars: 8,
    minI: 0.75,
    drums: 'drive',
    bass: 'gallop',
    gtr: 'power',
    pad: true,
    strings: true,
    lead: 'hook',
    crash: true,
  },
  {
    name: 'bridge',
    bars: 4,
    minI: 0.75,
    chordOffset: 4,
    drums: 'roll',
    bass: 'drone',
    gtr: 'riff',
    choir: true,
    riser: true,
  },
  {
    name: 'chorus2',
    bars: 8,
    minI: 0.75,
    drums: 'drive',
    bass: 'gallop',
    gtr: 'power',
    pad: true,
    strings: true,
    brass: 'stabs',
    lead: 'hook',
    crash: true,
    lift: 2,
  },
];

// ---- Thunderhead (storm): ambient, D minor, 76 bpm. Sparse bell melody in wide reverb; the storm breaks in combat. ----
// Dm Bb F C | Dm Gm Bb A
const CHORDS_STORM: ChordDef[] = [
  C(38, 57, 62, 65),
  C(34, 58, 62, 65),
  C(41, 57, 60, 65),
  C(36, 55, 60, 64),
  C(38, 57, 62, 65),
  C(43, 58, 62, 67),
  C(34, 58, 62, 65),
  C(33, 57, 61, 64),
];
// A rising fourth (A-D) answered by falling thirds; the second half reaches G5 and ends on a C#-E question.
const HOOK_STORM: N[] = [
  [69, 0, 1.5],
  [74, 1.5, 2.5],
  [77, 4, 1.5],
  [76, 5.5, 0.5],
  [74, 6, 2],
  [72, 8, 1.5],
  [69, 9.5, 0.5],
  [72, 10, 2],
  [67, 12, 4],
  [69, 16, 1.5],
  [74, 17.5, 2.5],
  [79, 20, 1.5, 1],
  [77, 21.5, 0.5],
  [74, 22, 2],
  [77, 24, 1],
  [76, 25, 1],
  [74, 26, 1],
  [72, 27, 1],
  [73, 28, 2],
  [76, 30, 2],
];
const ARP_STORM = [0, -1, -1, 2, -1, -1, 4, -1, 5, -1, -1, 4, -1, -1, 2, -1];
const STORM_FORM: SectionDef[] = [
  { name: 'calm', bars: 8, drums: 'none', bass: 'drone', pad: true, lead: 'bells' },
  {
    name: 'drift',
    bars: 8,
    drums: 'half',
    drumsMinI: 0.4,
    bass: 'drone',
    pad: true,
    choir: true,
    arp: true,
  },
  {
    name: 'gust',
    bars: 8,
    drums: 'half',
    drumsMinI: 0.4,
    bass: 'eighths',
    pad: true,
    strings: true,
    arp: true,
    lead: 'solo',
  },
  {
    name: 'build',
    bars: 4,
    minI: 0.75,
    drums: 'build',
    bass: 'eighths',
    strings: true,
    arp: true,
    riser: true,
  },
  {
    name: 'storm',
    bars: 8,
    minI: 0.75,
    drums: 'half',
    bass: 'gallop',
    pad: true,
    strings: true,
    choir: true,
    brass: 'stabs',
    arp: true,
    lead: 'hook',
    crash: true,
  },
  {
    name: 'eye',
    bars: 4,
    minI: 0.75,
    chordOffset: 4,
    drums: 'roll',
    bass: 'drone',
    choir: true,
    bells: true,
    riser: true,
  },
  {
    name: 'storm2',
    bars: 8,
    minI: 0.75,
    drums: 'half',
    bass: 'gallop',
    pad: true,
    strings: true,
    choir: true,
    brass: 'hook',
    arp: true,
    lead: 'hook',
    crash: true,
    lift: 1,
  },
];

// ---- Nebula Drift (space-nebula): spacey synth, A major / Lydian, 118 bpm. Arps through dotted echoes, airy pads. ----
// Amaj7 E F#m D(#11) | Amaj7 C#m D E(add9)
const CHORDS_NEBULA: ChordDef[] = [
  C(45, 57, 61, 64, 68),
  C(40, 56, 59, 64),
  C(42, 57, 61, 66),
  C(38, 57, 62, 66, 68),
  C(45, 57, 61, 64, 68),
  C(37, 56, 61, 64),
  C(38, 57, 62, 66),
  C(40, 56, 59, 64, 66),
];
// 3-3-2 rhythm cell (E-C#-B), a leap to G# on the dominant, a Lydian G# shimmer over D, and a rising close.
const HOOK_NEBULA: N[] = [
  [76, 0, 1.5],
  [73, 1.5, 1.5],
  [71, 3, 1],
  [76, 4, 1.5],
  [80, 5.5, 2.5, 1],
  [78, 8, 1.5],
  [76, 9.5, 1.5],
  [73, 11, 1],
  [74, 12, 1.5],
  [78, 13.5, 1],
  [80, 14.5, 1.5],
  [76, 16, 1.5],
  [73, 17.5, 1.5],
  [71, 19, 1],
  [76, 20, 1.5],
  [80, 21.5, 1],
  [83, 22.5, 1.5, 1],
  [81, 24, 1.5],
  [78, 25.5, 1.5],
  [74, 27, 1],
  [76, 28, 1.5],
  [78, 29.5, 1],
  [80, 30.5, 1.5],
];
const ARP_NEBULA = [0, 1, 2, 3, 4, 2, 3, 5, 6, 5, 4, 2, 3, 1, 2, 4];
const SPACE_FORM: SectionDef[] = [
  { name: 'intro', bars: 4, drums: 'none', bass: 'none', pad: true, bells: true, riser: true },
  { name: 'orbit', bars: 8, drums: 'pulse', drumsMinI: 0.4, bass: 'drone', pad: true, arp: true },
  {
    name: 'signal',
    bars: 8,
    drums: 'pulse',
    drumsMinI: 0.4,
    bass: 'eighths',
    pad: true,
    arp: true,
    bells: true,
    lead: 'solo',
  },
  {
    name: 'burn',
    bars: 8,
    minI: 0.75,
    drums: 'drive',
    bass: 'gallop',
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
    chordOffset: 4,
    drums: 'build',
    bass: 'drone',
    pad: true,
    choir: true,
    arp: true,
    riser: true,
  },
  {
    name: 'burn2',
    bars: 8,
    minI: 0.75,
    drums: 'drive',
    bass: 'gallop',
    pad: true,
    strings: true,
    arp: true,
    lead: 'hook2x',
    crash: true,
    lift: 2,
  },
];

export const THEMES: Record<string, ThemeDef> = {
  'title-concord': {
    id: 'title-concord',
    bpm: 96,
    chords: CHORDS_CONCORD,
    hook: HOOK_CONCORD,
    gritty: false,
    sections: TITLE_FORM(false),
    loopFrom: 1,
    space: 0.4,
  },
  'title-vex': {
    id: 'title-vex',
    bpm: 92,
    chords: CHORDS_VEX,
    hook: HOOK_VEX,
    gritty: true,
    sections: TITLE_FORM(true),
    loopFrom: 1,
    space: 0.4,
  },
  rustwater: {
    id: 'rustwater',
    bpm: 148,
    chords: CHORDS_RUST,
    hook: HOOK_RUST,
    riff: RIFF_RUST,
    gritty: true,
    sections: ROCK_FORM,
    loopFrom: 1,
    space: 0.2,
  },
  thunderhead: {
    id: 'thunderhead',
    bpm: 76,
    chords: CHORDS_STORM,
    hook: HOOK_STORM,
    arp: ARP_STORM,
    gritty: false,
    sections: STORM_FORM,
    loopFrom: 0,
    space: 0.9,
  },
  'nebula-drift': {
    id: 'nebula-drift',
    bpm: 118,
    chords: CHORDS_NEBULA,
    hook: HOOK_NEBULA,
    arp: ARP_NEBULA,
    gritty: false,
    sections: SPACE_FORM,
    loopFrom: 1,
    space: 0.75,
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
