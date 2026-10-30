import { useEffect, useMemo, useState } from 'react';
import { button, Leva, useControls } from 'leva';
import { FRAMES, type FrameId, type LaunchPhase } from '@skyriot/shared';
import { inputSettings, saveInputSettings } from '../input/input';
import { lag } from '../net/lagSim';
import { session } from '../net/session';
import { audioStats } from '../audio/engine';
import { useSettings, type Quality } from '../ui/settings';
import { addConsoleLine, useHud } from '../hud/hudStore';
import { hudMock, mockEvent, type MockBattle, type MockScenario } from './hudMock';

/** Latest slider values per Frame, for "Export tuning JSON". */
const exported: Record<string, Record<string, number>> = {};

function send(text: string) {
  session.conn?.sendChat(text);
  addConsoleLine(`> ${text}`);
}

/**
 * Flight tuning applies to the LOCAL prediction sim only (sim.tuning.frames). The server keeps its own
 * values, so large changes will show up as reconciliation snaps; export the JSON into content/frames.ts.
 */
function Tuning({ frame }: { frame: FrameId }) {
  const schema = useMemo(() => {
    const s: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(FRAMES[frame])) {
      if (typeof v !== 'number') continue;
      s[k] = {
        value: v,
        step: Math.abs(v) >= 20 ? 1 : 0.05,
        onChange: (val: number, _path: string, ctx: { initial: boolean }) => {
          (exported[frame] ??= {})[k] = val;
          if (ctx.initial) return;
          const tuning = session.sim?.tuning;
          if (tuning) (tuning.frames[frame] ??= {})[k] = val;
        },
      };
    }
    s['Export tuning JSON'] = button(() => {
      const json = JSON.stringify({ [frame]: exported[frame] }, null, 2);
      void navigator.clipboard?.writeText(json).catch(() => undefined);
      console.log(json);
      addConsoleLine('tuning JSON copied to clipboard / console');
    });
    return s;
  }, [frame]);
  useControls(`Tuning: ${FRAMES[frame].name} (local prediction only)`, schema as never, { collapsed: true }, [frame]);
  return null;
}

function Controls() {
  const frame = useHud((h) => h.frame);
  const setQuality = useSettings((s) => s.setQuality);
  const setPhysicsDebug = useSettings((s) => s.setPhysicsDebug);
  const l = useControls('Lag simulator', {
    latencyMs: { value: 0, min: 0, max: 500, step: 5, label: 'latency (each way)' },
    jitterMs: { value: 0, min: 0, max: 200, step: 5 },
    loss: { value: 0, min: 0, max: 0.5, step: 0.01 },
  });
  lag.latencyMs = l.latencyMs;
  lag.jitterMs = l.jitterMs;
  lag.loss = l.loss;
  useControls('Mouse steering', {
    sensitivity: {
      value: inputSettings.sensitivity,
      min: 0.0002,
      max: 0.003,
      step: 0.0001,
      onChange: (v: number) => {
        inputSettings.sensitivity = v;
        saveInputSettings();
      },
    },
  });
  const a = useSettings();
  useControls('Audio', {
    master: { value: a.master, min: 0, max: 1, step: 0.05, onChange: (v: number) => useSettings.getState().setAudio({ master: v }) },
    sfx: { value: a.sfx, min: 0, max: 1, step: 0.05, onChange: (v: number) => useSettings.getState().setAudio({ sfx: v }) },
    music: { value: a.music, min: 0, max: 1, step: 0.05, onChange: (v: number) => useSettings.getState().setAudio({ music: v }) },
    muted: { value: a.muted, onChange: (v: boolean) => useSettings.getState().setAudio({ muted: v }) },
  });
  useControls('Graphics & debug', {
    quality: { value: useSettings.getState().quality, options: ['low', 'med', 'high'], onChange: (q: Quality) => setQuality(q) },
    physicsDebug: { value: false, onChange: (on: boolean) => setPhysicsDebug(on) },
  });
  useControls('Server commands', {
    god: button(() => send('/god')),
    bots: { value: 20, min: 0, max: 60, step: 1 },
    'send /bots': button((get) => send(`/bots ${get('Server commands.bots')}`)),
    timescale: { value: 1, min: 0.1, max: 3, step: 0.1 },
    'send /timescale': button((get) => send(`/timescale ${get('Server commands.timescale')}`)),
  });
  // Fakes Bases / Battle / Launch Queue / stall until the server sends them; see dev/hudMock.ts.
  useControls('HUD mock', {
    scenario: {
      value: hudMock.scenario,
      options: ['off', 'intact', 'enemyStationDown', 'enemyShieldDown', 'ourShieldDown', 'coreCritical', 'bothExposed'],
      onChange: (v: MockScenario) => (hudMock.scenario = v),
    },
    battle: { value: hudMock.battle, options: ['battle', 'victory', 'defeat'], onChange: (v: MockBattle) => (hudMock.battle = v) },
    launchPhase: { value: hudMock.launchPhase, options: ['none', 'hangar', 'staging', 'ready', 'catapult'], onChange: (v: LaunchPhase) => (hudMock.launchPhase = v) },
    queuePos: { value: hudMock.queuePos, min: 0, max: 9, step: 1, onChange: (v: number) => (hudMock.queuePos = v) },
    tunnel: { value: hudMock.tunnel, min: 0, max: 2, step: 1, onChange: (v: number) => (hudMock.tunnel = v) },
    stalled: { value: false, onChange: (v: boolean) => (hudMock.stalled = v) },
    speed: { value: -1, min: -1, max: 200, step: 1, label: 'speed (-1 = real)', onChange: (v: number) => (hudMock.speed = v) },
    'enemy shield down': button(() => mockEvent('enemyShieldDown')),
    'our shield down': button(() => mockEvent('ourShieldDown')),
    'enemy station destroyed': button(() => mockEvent('enemyStationDestroyed')),
    'our station destroyed': button(() => mockEvent('ourStationDestroyed')),
    'our station hit': button(() => mockEvent('ourStationHit')),
    'battle begins': button(() => mockEvent('battleStarted')),
    catapult: button(() => mockEvent('catapult')),
  });
  return frame ? <Tuning frame={frame} /> : null;
}

function Console() {
  const lines = useHud((h) => h.consoleLines);
  const [text, setText] = useState('');
  const [rec, setRec] = useState('');
  useEffect(() => {
    let n = 0;
    const t = setInterval(() => {
      const st = session.predictor?.stats();
      if (!st) return setRec('prediction off');
      const line = `reconcile err avg ${st.avg.toFixed(2)} m  max ${st.max.toFixed(2)} m  (${st.count} snaps / 10 s)`;
      const au = audioStats();
      setRec(`${line}\naudio ${au.state} voices ${au.voices} (peak ${au.peak}, stolen ${au.dropped}) loops ${au.loops} music I=${au.music?.intensity.toFixed(2) ?? '-'}`);
      if (++n % 20 === 0) console.log('[reconcile]', line);
    }, 500);
    return () => clearInterval(t);
  }, []);
  return (
    <div
      data-ui
      style={{ position: 'fixed', left: 28, top: 330, width: 380, font: '13px ui-monospace, monospace', color: '#cfe', pointerEvents: 'auto' }}
    >
      <div style={{ background: '#000c', padding: '2px 6px', color: '#ffd24a' }}><span style={{ whiteSpace: 'pre-line' }}>{rec}</span></div>
      <div style={{ background: '#000a', padding: 6, maxHeight: 140, overflow: 'auto' }}>
        {lines.slice(-8).map((l, i) => (
          <div key={i}>{l}</div>
        ))}
      </div>
      <input
        value={text}
        placeholder="dev console: /god /bots n /timescale x"
        style={{ width: '100%', boxSizing: 'border-box', background: '#000c', color: '#fff', border: '1px solid #345', padding: 4 }}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Enter' && text.trim()) {
            send(text.trim());
            setText('');
          }
        }}
      />
    </div>
  );
}

export default function DevPanel() {
  return (
    <>
      <div data-ui>
        <Leva collapsed titleBar={{ title: 'SKYRIOT DEV', position: { x: -50, y: 48 } }} />
      </div>
      <Controls />
      <Console />
    </>
  );
}
