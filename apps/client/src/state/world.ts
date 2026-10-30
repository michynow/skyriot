import type {
  Heightfield,
  MapDef,
  MatchState,
  ShipId,
  ShipState,
  SimEvent,
  StructureId,
  StructureState,
} from '@skyriot/shared';

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
  /**
   * Screen-shake intensity 0..1, set by the HUD on a bounced terrain impact and decayed by the game loop
   * (exp, ~0.15 s). B's ChaseCamera may read it to jitter the camera.
   */
  shake: number;
  /** Guided missiles from the latest snapshot (id -> pos/vel). Written by the net layer; read by ProjectilesFx. */
  missiles: Map<number, { pos: [number, number, number]; vel: [number, number, number] }>;
  /** Base structures from the latest snapshot. Empty until the server sends them: treat as all alive. */
  structures: Map<StructureId, StructureState>;
  /** Battle state from the latest snapshot. */
  match: MatchState | null;
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
  shake: 0,
  missiles: new Map(),
  structures: new Map(),
  match: null,
};
