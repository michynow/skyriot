import { lazy, Suspense, useEffect, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
  FRAMES,
  MAPS,
  TICK_DT,
  createSim,
  generateHeightfield,
  type JoinOptions,
  type ShipId,
  type ShipState,
} from '@skyriot/shared';
import { world } from './state/world';
import { MapScene } from './scene/MapScene';
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
import { createPredictor } from './net/predictor';
import { session } from './net/session';
import { QUALITY_DPR, useSettings } from './ui/settings';
import { music, setListener } from './audio/engine';
import { handleAudioEvent, resetAudioSession, updateAudio } from './audio/sfxDriver';
import './ui/lobby.css';

const DevPanel = import.meta.env.DEV ? lazy(() => import('./dev/DevPanel')) : null;
const PhysicsDebug = import.meta.env.DEV ? lazy(() => import('./dev/PhysicsDebug')) : null;

const FX_QUEUE_MAX = 600;

/** Start local prediction. Falls back to snapshot-only rendering if the shared sim can't be created. */
async function startPrediction(map: NonNullable<typeof world.map>, ownId: ShipId, isCurrent: () => boolean) {
  try {
    const rapier = await import('@dimforge/rapier3d-compat');
    await rapier.init();
    const sim = createSim(map, { rapier, authoritative: false });
    if (!isCurrent()) return sim.dispose();
    session.sim = sim;
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
    for (const s of world.ships.values()) {
      if (s.alive && s.speed > FRAMES[s.frame].maxSpeed * 1.02) world.boosting.add(s.id);
    }
  }, -1);

  return null;
}

export function Game({ options, onExit }: { options: JoinOptions; onExit(): void }) {
  const status = useHud((h) => h.status);
  const error = useHud((h) => h.error);
  const quality = useSettings((s) => s.quality);
  const [map, setMap] = useState(world.map);

  useEffect(() => {
    let current = true;
    let conn: Connection | null = null;
    music.setMode('game');
    music.setNation(options.nation);
    useHud.setState({ status: 'connecting', error: '', chat: [], killfeed: [], consoleLines: [] });
    const interp = createInterpolator();
    session.interp = interp;
    let lastSnap: Parameters<NonNullable<typeof session.predictor>['onServerSnapshot']>[0] | null = null;

    const fail = (error: string) => current && useHud.setState({ status: 'error', error });

    connect(options, {
      onWelcome(w) {
        const mapDef = MAPS[w.mapId];
        if (!mapDef) return fail(`Unknown map "${w.mapId}".`);
        world.map = mapDef;
        world.heightfield = generateHeightfield(mapDef);
        world.ownId = w.shipId;
        session.dev = w.dev;
        setMap(mapDef);
        useHud.setState({ status: 'playing' });
        addChatLine(`Deployed to ${mapDef.name}. Enter = chat.`, 'sys');
        void startPrediction(mapDef, w.shipId, () => current).then(() => {
          if (current && lastSnap && session.predictor) session.predictor.onServerSnapshot(lastSnap);
        });
      },
      onSnapshot(s) {
        lastSnap = s;
        interp.push(s, conn?.rtt ?? 0);
        world.missiles.clear();
        for (const mi of s.missiles) if (mi.guided) world.missiles.set(mi.id, { pos: mi.pos, vel: mi.vel });
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
          handleAudioEvent(ev);
          if (ev.type === 'teleport' && ev.id === world.ownId) session.predictor?.teleport();
        }
        if (world.fxQueue.length > FX_QUEUE_MAX) world.fxQueue.splice(0, world.fxQueue.length - FX_QUEUE_MAX);
      },
      onConsole: addConsoleLine,
      onClose: fail,
    })
      .then((c) => {
        if (!current) return c.close();
        conn = c;
        session.conn = c;
      })
      .catch((err) => fail(`Could not connect: ${err instanceof Error ? err.message : String(err)}`));

    return () => {
      current = false;
      resetAudioSession();
      music.setMode('lobby');
      conn?.close();
      session.sim?.dispose();
      Object.assign(session, { conn: null, interp: null, predictor: null, sim: null });
      world.ships.clear();
      world.fxQueue.length = 0;
      world.boosting.clear();
      world.ownId = null;
      world.map = null;
      world.heightfield = null;
      inputState.targetId = null;
    };
  }, [options]);

  return (
    <>
      {status === 'playing' && map && (
        <>
          <Canvas shadows="percentage" dpr={QUALITY_DPR[quality]} camera={{ fov: 70, near: 0.5, far: 8000 }}>
            <MapScene map={map} />
            <Ships />
            <ProjectilesFx />
            <ChaseCamera />
            <PostFx quality={quality} />
            <GameLoop />
            {PhysicsDebug && (
              <Suspense fallback={null}>
                <PhysicsDebug />
              </Suspense>
            )}
          </Canvas>
          <Hud />
          {DevPanel && (
            <Suspense fallback={null}>
              <DevPanel />
            </Suspense>
          )}
        </>
      )}
      {status !== 'playing' && (
        <div className="status-screen">
          <div>{status === 'error' ? 'CONNECTION LOST' : 'CONNECTING…'}</div>
          {status === 'error' && <div style={{ fontSize: 16, letterSpacing: '.05em' }}>{error}</div>}
          <button onClick={onExit}>BACK TO HANGAR</button>
        </div>
      )}
    </>
  );
}
