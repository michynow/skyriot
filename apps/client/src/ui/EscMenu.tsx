import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { useHud } from '../hud/hudStore';
import { inputSettings, inputState, saveInputSettings, setTyping } from '../input/input';
import { Controls } from './Controls';
import { useSettings, type Quality } from './settings';
import './escMenu.css';

export const useEscMenu = create<{ open: boolean }>(() => ({ open: false }));

/** Opening marks the input as "typing" so steering, fire and hotkeys are ignored while the menu is up. */
export function openEscMenu(): void {
  if (inputState.typing) return;
  setTyping(true);
  useEscMenu.setState({ open: true });
}

function closeEscMenu() {
  useEscMenu.setState({ open: false });
  setTyping(false);
}

// Sensitivity is shown on a 1–15 scale; the raw value is radians per pixel.
const SENS_SCALE = 5000;

function Settings() {
  const st = useSettings();
  const [sens, setSens] = useState(() => Math.round(inputSettings.sensitivity * SENS_SCALE));
  const slider = (label: string, key: 'master' | 'sfx' | 'music') => (
    <label className="esc-row">
      <span>{label}</span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={st[key]}
        onChange={(e) => st.setAudio({ [key]: Number(e.target.value) })}
      />
      <b>{Math.round(st[key] * 100)}%</b>
    </label>
  );
  return (
    <>
      <h3>Audio</h3>
      {slider('Master', 'master')}
      {slider('Effects', 'sfx')}
      {slider('Music', 'music')}
      <label className="esc-row">
        <span>Mute</span>
        <button
          type="button"
          className={`esc-toggle ${st.muted ? 'on' : ''}`}
          onClick={st.toggleMute}
        >
          {st.muted ? 'MUTED' : 'SOUND ON'}
        </button>
        <b>
          <kbd>M</kbd>
        </b>
      </label>

      <h3>Video</h3>
      <div className="esc-row">
        <span>Quality</span>
        <div className="esc-seg">
          {(['low', 'med', 'high'] as Quality[]).map((q) => (
            <button
              key={q}
              type="button"
              className={st.quality === q ? 'on' : ''}
              onClick={() => st.setQuality(q)}
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      <h3>Mouse</h3>
      <label className="esc-row">
        <span>Sensitivity</span>
        <input
          type="range"
          min={1}
          max={15}
          step={1}
          value={sens}
          onChange={(e) => {
            const v = Number(e.target.value);
            setSens(v);
            inputSettings.sensitivity = v / SENS_SCALE;
            saveInputSettings();
          }}
        />
        <b>{sens}</b>
      </label>
    </>
  );
}

export function EscMenu({ onLeave }: { onLeave(): void }) {
  const open = useEscMenu((s) => s.open);
  const frame = useHud((h) => h.frame);
  const nation = useHud((h) => h.nation);
  const [tab, setTab] = useState<'settings' | 'controls'>('settings');
  const [confirmLeave, setConfirmLeave] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Escape') return;
      if (useEscMenu.getState().open) closeEscMenu();
      else if (!(e.target instanceof HTMLInputElement)) openEscMenu();
    };
    // Browsers release pointer lock on Esc before the page sees the key; chat typing releases it too.
    const onLockChange = () => {
      if (!document.pointerLockElement) openEscMenu();
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('pointerlockchange', onLockChange);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerlockchange', onLockChange);
      if (useEscMenu.getState().open) closeEscMenu();
    };
  }, []);

  useEffect(() => {
    if (!open) setConfirmLeave(false);
  }, [open]);

  if (!open) return null;

  const resume = () => {
    closeEscMenu();
    const canvas = document.querySelector('canvas');
    if (canvas) void Promise.resolve(canvas.requestPointerLock()).catch(() => undefined);
  };

  return (
    <div
      className={`esc ${nation ?? ''}`}
      data-ui
      onMouseDown={(e) => e.target === e.currentTarget && resume()}
    >
      <div className="esc-panel">
        <header className="esc-head">
          <h1>
            SKY<span>RIOT</span>
          </h1>
          <p>Menu · the battle continues while this is open</p>
        </header>
        <nav className="esc-nav">
          <button type="button" className="ui-btn primary" onClick={resume}>
            RESUME
          </button>
          <button
            type="button"
            className={`esc-tab ${tab === 'settings' ? 'on' : ''}`}
            onClick={() => setTab('settings')}
          >
            SETTINGS
          </button>
          <button
            type="button"
            className={`esc-tab ${tab === 'controls' ? 'on' : ''}`}
            onClick={() => setTab('controls')}
          >
            CONTROLS
          </button>
          <button
            type="button"
            className={`ui-btn danger esc-leave ${confirmLeave ? 'confirm' : ''}`}
            onClick={() => (confirmLeave ? onLeave() : setConfirmLeave(true))}
            onBlur={() => setConfirmLeave(false)}
          >
            {confirmLeave ? 'CONFIRM — LEAVE' : 'LEAVE TO HANGAR'}
          </button>
        </nav>
        <section className="esc-body">
          {tab === 'settings' ? <Settings /> : <Controls frame={frame} />}
        </section>
      </div>
    </div>
  );
}
