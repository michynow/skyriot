import { lazy, Suspense, useEffect, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
  FRAMES,
  MAPS,
  TICK_DT,
  createSim,
  gearOf,
  generateHeightfield,
  type JoinOptions,
  type ShipId,
  type ShipState,
  type TravelOrder,
} from '@skyriot/shared';
import { world } from './state/world';
import { MapScene } from './scene/MapScene';
import { AimPreview } from './scene/AimPreview';
import { Ships } from './frames/Ships';
import { ProjectilesFx } from './fx/ProjectilesFx';
import { ChaseCamera } from './scene/ChaseCamera';
import { PostFx } from './scene/PostFx';
import { Hud } from './hud/Hud';
import { addChatLine, addConsoleLine, handleHudEvent, useHud } from './hud/hudStore';
import { view } from './hud/view';
import { attachInput, inputState, sampleInput, trackAim } from './input/input';
import { connect, type Connection } from './net/connection';
import { createInterpolator } from './net/interpolator';
import { matchOwnShot, predictOwnShot } from './net/ownShots';
import { createPredictor } from './net/predictor';
import { session } from './net/session';
import { QUALITY_DPR, useSettings } from './ui/settings';
import { structureEvent } from './scene/Structures';
import { useProfile } from './state/profile';
import { music, setListener } from './audio/engine';
import { handleAudioEvent, resetAudioSession, updateAudio } from './audio/sfxDriver';
import './ui/lobby.css';

const DevPanel = import.meta.env.DEV ? lazy(() => import('./dev/DevPanel')) : null;
const PhysicsDebug = import.meta.env.DEV ? lazy(() => import('./dev/PhysicsDebug')) : null;

const FX_QUEUE_MAX = 600;

/** Start local prediction. Falls back to snapshot-only rendering if the shared sim can't be created. */
/** Prediction must run the own Ship with the same gear the server resolved from the same profile. */
function applyOwnGear(ownId: ShipId, frame: JoinOptions['frame']) {
  const profile = useProfile.getState().profile;
  if (profile) session.sim?.setGear(ownId, gearOf(profile, frame));
}

async function startPrediction(
  map: NonNullable<typeof world.map>,
  ownId: ShipId,
  frame: JoinOptions['frame'],
  isCurrent: () => boolean,
) {
  try {
    const rapier = await import('@dimforge/rapier3d-compat');
    await rapier.init();
    const sim = createSim(map, { rapier, authoritative: false });
    if (!isCurrent()) return sim.dispose();
    session.sim = sim;
    applyOwnGear(ownId, frame);
    session.predictor = createPredictor(sim, ownId);
  } catch (err) {
    console.warn('[predict] disabled, rendering own Ship from snapshots:', err);
    session.sim = null;
    session.predictor = null;
  }
}

function disablePrediction(err: unknown) {
  console.warn('[predict] error, falling back to snapshots:', err);
  session.predictor = null;
}

function GameLoop() {
  const camera = useThree((s) => s.camera);
  const dom = useThree((s) => s.gl.domElement);
  const state = useState(() => ({ acc: 0, seq: 0 }))[0];

  useEffect(() => attachInput(dom), [dom]);

  useFrame((_, delta) => {
    const interp = session.interp;
    const ownId = world.ownId;
    if (!interp || !ownId) return;
    view.camera = camera;
    setListener(camera.position, camera.quaternion);
    updateAudio();

    trackAim(camera, world.ships.get(ownId));
    world.shake *= Math.exp(-delta / 0.15);
    state.acc = Math.min(state.acc + delta, 0.25);
    while (state.acc >= TICK_DT) {
      state.acc -= TICK_DT;
      const input = sampleInput(++state.seq, interp.renderTick(), world.ships.get(ownId));
      if (session.predictor) {
        try {
          session.predictor.applyLocal(input);
          const own = session.sim?.getShip(ownId);
          const shot = own && predictOwnShot(own, input);
          if (shot) {
            world.fxQueue.push(shot);
            handleAudioEvent(shot);
          }
        } catch (err) {
          disablePrediction(err);
        }
      }
      session.conn?.sendInput(input);
    }

    const remotes = interp.sample(performance.now());
    world.ships.clear();
    for (const [id, ship] of remotes) world.ships.set(id, ship);
    let mine: ShipState | null = null;
    try {
      mine = session.predictor?.ownState(state.acc / TICK_DT) ?? null;
    } catch (err) {
      disablePrediction(err);
    }
    if (mine) world.ships.set(ownId, mine);

    world.boosting.clear();
    world.boostLevel.clear();
    for (const s of world.ships.values()) {
      if (!s.alive) continue;
      const fd = FRAMES[s.frame];
      const over = Math.min(
        1,
        Math.max(0, (s.speed - fd.cruiseSpeed) / Math.max(1, fd.boostSpeed - fd.cruiseSpeed)),
      );
      const level = 0.55 * (s.boostRamp ?? 0) + 0.45 * over;
      if (level > 0.01) world.boostLevel.set(s.id, level);
      if (level > 0.35) world.boosting.add(s.id);
    }
  }, -1);

  return null;
}

export function Game({
  options,
  onExit,
  onTravel,
}: {
  options: JoinOptions;
  onExit(): void;
  onTravel(order: TravelOrder): void;
}) {
  const status = useHud((h) => h.status);
  const error = useHud((h) => h.error);
  const quality = useSettings((s) => s.quality);
  const [map, setMap] = useState(world.map);

  useEffect(() => {
    let current = true;
    let conn: Connection | null = null;
    useHud.setState({ status: 'connecting', error: '', chat: [], killfeed: [], consoleLines: [] });
    const interp = createInterpolator();
    session.interp = interp;
    let lastSnap: Parameters<NonNullable<typeof session.predictor>['onServerSnapshot']>[0] | null =
      null;

    const fail = (error: string) => current && useHud.setState({ status: 'error', error });

    connect(options, {
      onWelcome(w) {
        const mapDef = MAPS[w.mapId];
        if (!mapDef) return fail(`Unknown map "${w.mapId}".`);
        world.map = mapDef;
        music.setMap(mapDef);
        world.heightfield = generateHeightfield(mapDef);
        world.ownId = w.shipId;
        session.dev = w.dev;
        setMap(mapDef);
        useHud.setState({ status: 'playing' });
        addChatLine(`Deployed to ${mapDef.name}. Enter = chat.`, 'sys');
        void startPrediction(mapDef, w.shipId, options.frame, () => current).then(() => {
          if (current && lastSnap && session.predictor)
            session.predictor.onServerSnapshot(lastSnap);
        });
      },
      onSnapshot(s) {
        lastSnap = s;
        interp.push(s, conn?.rtt ?? 0);
        world.missiles.clear();
        for (const mi of s.missiles)
          if (mi.guided) world.missiles.set(mi.id, { pos: mi.pos, vel: mi.vel });
        world.structures.clear();
        for (const st of s.structures) world.structures.set(st.id, st);
        world.match = s.match;
        try {
          session.predictor?.onServerSnapshot(s);
        } catch (err) {
          disablePrediction(err);
        }
      },
      onEvents(events) {
        for (const ev of events) {
          world.fxQueue.push(ev);
          handleHudEvent(ev);
          structureEvent(ev);
          // Own tracers already shown (and heard) when fired locally.
          const shown =
            ev.type === 'projectileSpawned' &&
            ev.owner === world.ownId &&
            ev.kind === 'tracer' &&
            session.predictor !== null &&
            matchOwnShot(ev);
          if (!shown) handleAudioEvent(ev);
          if (ev.type === 'teleport' && ev.id === world.ownId) session.predictor?.teleport();
        }
        if (world.fxQueue.length > FX_QUEUE_MAX)
          world.fxQueue.splice(0, world.fxQueue.length - FX_QUEUE_MAX);
      },
      onConsole: addConsoleLine,
      onProfile(profile) {
        useProfile.setState({ profile });
        if (world.ownId) applyOwnGear(world.ownId, options.frame);
      },
      onClose: fail,
      onTravel: (order) => current && onTravel(order),
    })
      .then((c) => {
        if (!current) return c.close();
        conn = c;
        session.conn = c;
      })
      .catch((err) =>
        fail(`Could not connect: ${err instanceof Error ? err.message : String(err)}`),
      );

    return () => {
      current = false;
      resetAudioSession();
      music.setMap(null);
      conn?.close();
      session.sim?.dispose();
      Object.assign(session, { conn: null, interp: null, predictor: null, sim: null });
      world.ships.clear();
      world.fxQueue.length = 0;
      world.boosting.clear();
      world.ownId = null;
      useProfile.setState({ profile: null });
      world.map = null;
      world.heightfield = null;
      inputState.targetId = null;
      inputState.manualTarget = false;
    };
  }, [options]);

  return (
    <>
      {status === 'playing' && map && (
        <>
          <Canvas
            shadows="percentage"
            dpr={QUALITY_DPR[quality]}
            camera={{ fov: 70, near: 0.5, far: 8000 }}
          >
            <MapScene map={map} />
            <Ships />
            <ProjectilesFx />
            <AimPreview />
            <ChaseCamera />
            <PostFx quality={quality} />
            <GameLoop />
            {PhysicsDebug && (
              <Suspense fallback={null}>
                <PhysicsDebug />
              </Suspense>
            )}
          </Canvas>
          <Hud onLeave={onExit} />
          {DevPanel && (
            <Suspense fallback={null}>
              <DevPanel />
            </Suspense>
          )}
        </>
      )}
      {status !== 'playing' && (
        <div className={`status-screen ${status}`}>
          {status === 'connecting' && <div className="status-ring" />}
          <h2>{status === 'error' ? 'CONNECTION LOST' : 'CONNECTING'}</h2>
          <p>
            {status === 'error'
              ? error
              : `Deploying to ${MAPS[options.mapId]?.name ?? options.mapId}…`}
          </p>
          <button className="ui-btn" onClick={onExit}>
            BACK TO HANGAR
          </button>
        </div>
      )}
    </>
  );
}
