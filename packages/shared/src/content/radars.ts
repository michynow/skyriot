import type { FrameId, RadarDef } from '../types';
import { FRAMES } from './frames';

// One radar line per Frame, T1–T3. T1 = the Frame's stock radarStdM / radarAdvM / radarRangeM (balance freeze);
// T2 / T3 step the ranges up like the engine variants.
const LINES: Record<FrameId, [string, string, string]> = {
  wasp: ['picket-radar', 'sentry-radar', 'watchtower-radar'],
  anvil: ['bombsight-radar', 'plotter-radar', 'range-keeper-radar'],
  halo: ['choir-radar', 'chorus-radar', 'cantor-radar'],
  bulwark: ['spotter-radar', 'surveyor-radar', 'overseer-radar'],
};

/** Range multiplier per tier (rounded to 10 m). */
const STEPS = [1, 1.06, 1.12];

export const RADAR_NAMES: Record<string, string> = {
  'picket-radar': 'Picket Radar',
  'sentry-radar': 'Sentry Radar',
  'watchtower-radar': 'Watchtower Radar',
  'bombsight-radar': 'Bombsight Radar',
  'plotter-radar': 'Plotter Radar',
  'range-keeper-radar': 'Range-Keeper Radar',
  'choir-radar': 'Choir Radar',
  'chorus-radar': 'Chorus Radar',
  'cantor-radar': 'Cantor Radar',
  'spotter-radar': 'Spotter Radar',
  'surveyor-radar': 'Surveyor Radar',
  'overseer-radar': 'Overseer Radar',
};

export const RADARS: Record<string, RadarDef> = {};
/** Which Frame each radar fits. */
export const RADAR_FRAME: Record<string, FrameId> = {};
/** Tier (1–3) of each radar. */
export const RADAR_TIER: Record<string, number> = {};

const r10 = (m: number) => Math.round(m / 10) * 10;

for (const [frame, ids] of Object.entries(LINES) as [FrameId, string[]][]) {
  const f = FRAMES[frame];
  ids.forEach((id, i) => {
    const m = STEPS[i]!;
    RADARS[id] = {
      id,
      radarStdM: i ? r10(f.radarStdM * m) : f.radarStdM,
      radarAdvM: i ? r10(f.radarAdvM * m) : f.radarAdvM,
      radarRangeM: i ? r10(f.radarRangeM * m) : f.radarRangeM,
    };
    RADAR_FRAME[id] = frame;
    RADAR_TIER[id] = i + 1;
  });
}

/** Stock (T1) radar per Frame. */
export const STOCK_RADAR: Record<FrameId, string> = {
  wasp: LINES.wasp[0],
  anvil: LINES.anvil[0],
  halo: LINES.halo[0],
  bulwark: LINES.bulwark[0],
};
