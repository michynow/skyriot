import { Vector3, type Camera } from 'three';
import {
  EMPTY_INPUT,
  FRAMES,
  type PilotInput,
  type ShipId,
  type ShipState,
} from '@skyriot/shared';
import { world } from '../state/world';
import { useSettings } from '../ui/settings';

/** Mutable input-side state shared with the HUD (read per frame, never React state). */
export const inputState = {
  targetId: null as ShipId | null,
  typing: false,
  /** Called when Enter requests the chat line. Set by the HUD. */
  onOpenChat: null as (() => void) | null,
  /** Last aim direction sent (unit, world space); HUD range feedback raycasts along it from the Ship. */
  aim: [0, 0, -1] as [number, number, number],
};

const SETTINGS_KEY = 'skyriot.input.v2';
/** Mouse-aim feel: radians of aim per pixel of mouse travel. Persisted; edited from the dev panel. */
export const inputSettings = { sensitivity: 0.0012 };
try {
  Object.assign(inputSettings, JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}'));
} catch {
  /* storage unavailable */
}
export function saveInputSettings(): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(inputSettings));
  } catch {
    /* ignore */
  }
}

const DOUBLE_TAP_MS = 300; // max gap from the first key release to the second press
export const AIM_DISTANCE = 600;

const keys = new Set<string>();
const lastUp: Record<string, number> = {};
let rollLeft = false;
let rollRight = false;
let hotbar = -1;
let launch = false;
let fire1 = false;
let fire2 = false;
let lockFailed = false;
let pointerX = 0;
let pointerY = 0;
// Mouse-aim: the mouse turns a world-space aim direction freely; the Ship steers toward it on its own.
let aimYaw = 0;
let aimPitch = 0;
let aimFor: ShipId | null = null;
const AIM_PITCH_MAX = 1.45;
/** Cursor is kept inside this NDC box so the aim point never leaves the screen. */
const CURSOR_EDGE = 0.92;

const _aim = new Vector3();
const _cam = new Vector3();
const _p = new Vector3();

const isUi = (t: EventTarget | null) => t instanceof Element && t.closest('[data-ui]') !== null;
const isLocked = () => document.pointerLockElement !== null;

function clampCursor() {
  const c = world.cursor;
  const len = Math.hypot(c.x, c.y);
  if (len > 1) {
    c.x /= len;
    c.y /= len;
  }
}

function reset() {
  keys.clear();
  fire1 = fire2 = false;
  world.freeLook = false;
}

/** Tab: select the next enemy within radar range, nearest first. Sent as PilotInput.target. */
export function cycleTarget(): void {
  const own = world.ownId ? world.ships.get(world.ownId) : undefined;
  if (!own) return;
  const range = FRAMES[own.frame].radarRangeM;
  const enemies = [...world.ships.values()]
    .filter((s) => s.alive && s.nation !== own.nation)
    .map((s) => ({
      id: s.id,
      d: Math.hypot(s.pos[0] - own.pos[0], s.pos[1] - own.pos[1], s.pos[2] - own.pos[2]),
    }))
    .filter((e) => e.d <= range)
    .sort((a, b) => a.d - b.d);
  if (!enemies.length) {
    inputState.targetId = null;
    return;
  }
  const i = enemies.findIndex((e) => e.id === inputState.targetId);
  inputState.targetId = enemies[(i + 1) % enemies.length]!.id;
}

export function setTyping(on: boolean): void {
  inputState.typing = on;
  if (on) {
    reset();
    if (isLocked()) document.exitPointerLock();
  }
}

/** Attach DOM listeners; returns detach. `canvas` receives pointer lock. */
export function attachInput(canvas: HTMLElement): () => void {
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (e.code === 'Enter') {
      e.preventDefault();
      inputState.onOpenChat?.();
      return;
    }
    if (inputState.typing) return;
    if (e.code === 'KeyM' && !e.repeat) {
      useSettings.getState().toggleMute();
      return;
    }
    if (e.code === 'Tab' || e.code === 'Space' || e.code.startsWith('Alt')) e.preventDefault();
    if (e.repeat) return;
    keys.add(e.code);
    if (e.code === 'KeyA' || e.code === 'KeyD') {
      // Roll = second press within DOUBLE_TAP_MS of the first key's release (a held-then-released key counts).
      const up = lastUp[e.code];
      if (up !== undefined && performance.now() - up <= DOUBLE_TAP_MS) {
        if (e.code === 'KeyA') rollLeft = true;
        else rollRight = true;
        lastUp[e.code] = -1e9;
      }
    } else if (e.code === 'Tab') cycleTarget();
    else if (e.code === 'KeyR' && !e.repeat) launch = true;
    else if (e.code.startsWith('Alt')) {
      world.freeLook = true;
      world.cursor.x = world.cursor.y = 0;
    } else if (e.code.startsWith('Digit')) {
      const n = Number(e.code.slice(5));
      hotbar = n === 0 ? 9 : n - 1;
    }
  };
  const onKeyUp = (e: KeyboardEvent) => {
    keys.delete(e.code);
    if (e.code === 'KeyA' || e.code === 'KeyD') lastUp[e.code] = performance.now();
    if (e.code.startsWith('Alt')) world.freeLook = false;
  };
  const onMouseMove = (e: MouseEvent) => {
    if (inputState.typing) return;
    pointerX = (e.clientX / window.innerWidth) * 2 - 1;
    pointerY = -((e.clientY / window.innerHeight) * 2 - 1);
    if (!isLocked()) return;
    if (world.freeLook) {
      // Alt: the cursor orbits the camera instead of moving the aim.
      world.cursor.x += e.movementX * 0.0015;
      world.cursor.y -= e.movementY * 0.0015;
      clampCursor();
      return;
    }
    aimYaw -= e.movementX * inputSettings.sensitivity;
    aimPitch = Math.max(
      -AIM_PITCH_MAX,
      Math.min(AIM_PITCH_MAX, aimPitch - e.movementY * inputSettings.sensitivity),
    );
  };
  const onMouseDown = (e: MouseEvent) => {
    if (isUi(e.target) || inputState.typing) return;
    if (!isLocked() && !lockFailed) {
      void Promise.resolve(canvas.requestPointerLock()).catch(() => (lockFailed = true));
      // the first click also fires
    }
    if (e.button === 0) fire1 = true;
    if (e.button === 2) fire2 = true;
  };
  const onMouseUp = (e: MouseEvent) => {
    if (e.button === 0) fire1 = false;
    if (e.button === 2) fire2 = false;
  };
  const onWheel = (e: WheelEvent) => {
    if (isUi(e.target)) return;
    world.cameraZoom = Math.min(
      2,
      Math.max(0.6, world.cameraZoom * (1 + Math.sign(e.deltaY) * 0.08)),
    );
  };
  const onLockChange = () => {
    if (!isLocked()) fire1 = fire2 = false;
  };
  const onLockError = () => (lockFailed = true);
  const onContext = (e: Event) => e.preventDefault();

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', reset);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  window.addEventListener('wheel', onWheel, { passive: true });
  window.addEventListener('contextmenu', onContext);
  document.addEventListener('pointerlockchange', onLockChange);
  document.addEventListener('pointerlockerror', onLockError);
  return () => {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', reset);
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mousedown', onMouseDown);
    window.removeEventListener('mouseup', onMouseUp);
    window.removeEventListener('wheel', onWheel);
    window.removeEventListener('contextmenu', onContext);
    document.removeEventListener('pointerlockchange', onLockChange);
    document.removeEventListener('pointerlockerror', onLockError);
    reset();
    if (isLocked()) document.exitPointerLock();
  };
}

function setAimFrom(dx: number, dy: number, dz: number) {
  const len = Math.hypot(dx, dy, dz) || 1;
  aimPitch = Math.asin(Math.max(-1, Math.min(1, dy / len)));
  aimYaw = Math.atan2(-dx, -dz);
}

/**
 * Per render frame: projects the aim point onto the screen as world.cursor, pinning it to the screen edge
 * (and pulling the aim back with it) so the crosshair stays visible while the Ship turns to catch up.
 */
export function trackAim(camera: Camera, own: ShipState | undefined): void {
  if (!own || world.freeLook) return;
  if (aimFor !== own.id) {
    aimFor = own.id;
    const [x, y, z, w] = own.rot;
    setAimFrom(-2 * (x * z + w * y), -2 * (y * z - w * x), -(1 - 2 * (x * x + y * y)));
  }
  camera.updateMatrixWorld();
  let cx: number, cy: number;
  if (!isLocked() && lockFailed) {
    // Pointer lock refused (iframe, headless): the absolute mouse position is the cursor.
    cx = pointerX;
    cy = pointerY;
  } else {
    const cp = Math.cos(aimPitch);
    _p.set(-Math.sin(aimYaw) * cp, Math.sin(aimPitch), -Math.cos(aimYaw) * cp)
      .multiplyScalar(AIM_DISTANCE)
      .add(_aim.set(own.pos[0], own.pos[1], own.pos[2]))
      .project(camera);
    cx = _p.x;
    cy = _p.y;
    // Behind the camera the projection mirrors: flip and push to the edge.
    if (_p.z > 1) {
      cx = -cx * 1e3;
      cy = -cy * 1e3;
    }
  }
  const m = Math.max(Math.abs(cx), Math.abs(cy)) / CURSOR_EDGE;
  const pinned = m > 1;
  if (pinned) {
    cx /= m;
    cy /= m;
  }
  world.cursor.x = cx;
  world.cursor.y = cy;
  if (pinned || (!isLocked() && lockFailed)) {
    // Re-derive the aim from the on-screen cursor: camera ray to a far point, then direction from the Ship.
    _aim.set(cx, cy, 0.5).unproject(camera);
    _cam.setFromMatrixPosition(camera.matrixWorld);
    _aim.sub(_cam).normalize().multiplyScalar(AIM_DISTANCE).add(_cam);
    setAimFrom(_aim.x - own.pos[0], _aim.y - own.pos[1], _aim.z - own.pos[2]);
  }
}

/** Build this tick's PilotInput. One-shot flags (roll, hotbar) are consumed. */
export function sampleInput(seq: number, viewTick: number, own: ShipState | undefined): PilotInput {
  const typing = inputState.typing;
  const k = (code: string) => (!typing && keys.has(code) ? 1 : 0);

  const cp = Math.cos(aimPitch);
  let aim: [number, number, number] = [
    -Math.sin(aimYaw) * cp,
    Math.sin(aimPitch),
    -Math.cos(aimYaw) * cp,
  ];
  if (own && world.freeLook) {
    // Alt: camera looks around, Ship keeps its heading.
    const [x, y, z, w] = own.rot;
    aim = [-2 * (x * z + w * y), -2 * (y * z - w * x), -(1 - 2 * (x * x + y * y))];
  }
  if (!aim.every(Number.isFinite)) aim = [0, 0, -1];
  inputState.aim = aim;
  // The Target is only ever picked with Tab and held until the next Tab; it drops when it dies or leaves view.
  const target = inputState.targetId ? world.ships.get(inputState.targetId) : undefined;
  if (!own || !target?.alive) inputState.targetId = null;

  const input: PilotInput = {
    ...EMPTY_INPUT,
    seq,
    viewTick: Math.round(viewTick),
    aim,
    throttle: k('KeyW') - k('KeyS'),
    strafe: k('KeyD') - k('KeyA'),
    vertical: k('KeyE') - k('KeyQ'),
    boost: !!k('Space'),
    brake: !!k('ShiftLeft') || !!k('ShiftRight'),
    fire1: !typing && fire1,
    fire2: !typing && fire2,
    hotbar: typing ? -1 : hotbar,
    rollLeft: !typing && rollLeft,
    rollRight: !typing && rollRight,
    launch: !typing && launch,
    target: inputState.targetId,
  };
  if (import.meta.env.DEV && (input.rollLeft || input.rollRight))
    console.debug('[roll] sent', input.rollLeft ? 'left' : 'right', 'seq', seq);
  rollLeft = rollRight = false;
  launch = false;
  hotbar = -1;
  return input;
}
