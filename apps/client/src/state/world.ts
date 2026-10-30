import type { Heightfield, MapDef, ShipId, ShipState, SimEvent } from '@skyriot/shared';

/**
 * Mutable per-frame view of the world, the seam between net/game loop (writer) and
 * rendering (reader). Never put this in React state.
 */
export interface ClientWorld {
  map: MapDef | null;
  heightfield: Heightfield | null;
  ownId: ShipId | null;
  /** Render-ready Ships: own = predicted, others = interpolated. Updated every frame by the game loop. */
  ships: Map<ShipId, ShipState>;
  /** Visual-only flags per Ship, set by the game loop. */
  boosting: Set<ShipId>;
  /** Events pushed by net layer; FX layer drains (splice) each frame. */
  fxQueue: SimEvent[];
  /** Normalised aim cursor in screen space (-1..1), written by input, read by HUD/camera. */
  cursor: { x: number; y: number };
  freeLook: boolean;
  cameraZoom: number;
}

export const world: ClientWorld = {
  map: null,
  heightfield: null,
  ownId: null,
  ships: new Map(),
  boosting: new Set(),
  fxQueue: [],
  cursor: { x: 0, y: 0 },
  freeLook: false,
  cameraZoom: 1,
};
