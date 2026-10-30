import type { Sim } from '@skyriot/shared';
import type { Connection } from './connection';
import type { Interpolator } from './interpolator';
import type { Predictor } from './predictor';

/** Live handles for the current game session; read by the dev panel and HUD. Not React state. */
export const session: {
  conn: Connection | null;
  interp: Interpolator | null;
  predictor: Predictor | null;
  /** The local prediction sim (null when createSim is unavailable). */
  sim: Sim | null;
  dev: boolean;
} = { conn: null, interp: null, predictor: null, sim: null, dev: false };
