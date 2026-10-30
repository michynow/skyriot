import { Vector3, type Camera } from 'three';
import { EMPTY_INPUT, type PilotInput, type ShipId, type ShipState } from '@skyriot/shared';
import { world } from '../state/world';

/** Mutable input-side state shared with the HUD (read per frame, never React state). */
export const inputState = {
  targetId: null as ShipId | null,
  typing: false,
  /** Called when Enter requests the chat line. Set by the HUD. */
  onOpenChat: null as (() => void) | null,
};

const DOUBLE_TAP_MS = 250;
const SENSITIVITY = 0.0022;
const AIM_DISTANCE = 600;

const keys = new Set<string>();
const lastTap: Record<string, number> = {};
let rollLeft = false;
let rollRight = false;
let hotbar = -1;
let fire1 = false;
let fire2 = false;
let lockFailed = false;
let pointerX = 0;
let pointerY = 0;

const _aim = new Vector3();
const _cam = new Vector3();

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

/** Tab: select the next enemy (nearest first). Local only; the server derives locks from aim. */
export function cycleTarget(): void {
  const own = world.ownId ? world.ships.get(world.ownId) : undefined;
  if (!own) return;
  const enemies = [...world.ships.values()]
    .filter((s) => s.alive && s.nation !== own.nation)
    .map((s) => ({ id: s.id, d: Math.hypot(s.pos[0] - own.pos[0], s.pos[1] - own.pos[1], s.pos[2] - own.pos[2]) }))
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
    if (e.code === 'Tab' || e.code === 'Space' || e.code.startsWith('Alt')) e.preventDefault();
    if (e.repeat) return;
    keys.add(e.code);
    if (e.code === 'KeyA' || e.code === 'KeyD') {
      const now = performance.now();
      const prev = lastTap[e.code];
      if (prev !== undefined && now - prev <= DOUBLE_TAP_MS) {
        if (e.code === 'KeyA') rollLeft = true;
        else rollRight = true;
        lastTap[e.code] = -1e9;
      } else lastTap[e.code] = now;
    } else if (e.code === 'Tab') cycleTarget();
    else if (e.code.startsWith('Alt')) world.freeLook = true;
    else if (e.code.startsWith('Digit')) {
      const n = Number(e.code.slice(5));
      hotbar = n === 0 ? 9 : n - 1;
    }
  };
  const onKeyUp = (e: KeyboardEvent) => {
    keys.delete(e.code);
    if (e.code.startsWith('Alt')) world.freeLook = false;
  };
  const onMouseMove = (e: MouseEvent) => {
    if (inputState.typing) return;
    pointerX = (e.clientX / window.innerWidth) * 2 - 1;
    pointerY = -((e.clientY / window.innerHeight) * 2 - 1);
    if (isLocked()) {
      world.cursor.x += e.movementX * SENSITIVITY;
      world.cursor.y -= e.movementY * SENSITIVITY;
    } else if (lockFailed && !isUi(e.target)) {
      // Pointer lock refused (iframe, headless): fall back to the absolute mouse position.
      world.cursor.x = pointerX;
      world.cursor.y = pointerY;
    }
    clampCursor();
  };
  const onMouseDown = (e: MouseEvent) => {
    if (isUi(e.target) || inputState.typing) return;
    if (!isLocked() && !lockFailed) {
      void Promise.resolve(canvas.requestPointerLock()).catch(() => (lockFailed = true));
      return;
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
    world.cameraZoom = Math.min(2, Math.max(0.6, world.cameraZoom * (1 + Math.sign(e.deltaY) * 0.08)));
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

/** Build this tick's PilotInput. One-shot flags (roll, hotbar) are consumed. */
export function sampleInput(
  seq: number,
  viewTick: number,
  camera: Camera,
  own: ShipState | undefined,
): PilotInput {
  const typing = inputState.typing;
  const k = (code: string) => (!typing && keys.has(code) ? 1 : 0);

  // Aim: cursor ray through the camera, converted to a direction from the Ship to a far point on it.
  _aim.set(world.cursor.x, world.cursor.y, 0.5).unproject(camera);
  _cam.setFromMatrixPosition(camera.matrixWorld);
  _aim.sub(_cam).normalize();
  let aim: [number, number, number] = [_aim.x, _aim.y, _aim.z];
  if (own) {
    _aim.multiplyScalar(AIM_DISTANCE).add(_cam);
    _aim.set(_aim.x - own.pos[0], _aim.y - own.pos[1], _aim.z - own.pos[2]).normalize();
    aim = [_aim.x, _aim.y, _aim.z];
    if (world.freeLook) {
      // Alt: camera looks around, Ship keeps its heading.
      const [x, y, z, w] = own.rot;
      aim = [-2 * (x * z + w * y), -2 * (y * z - w * x), -(1 - 2 * (x * x + y * y))];
    }
  }
  if (!aim.every(Number.isFinite)) aim = [0, 0, -1];

  const input: PilotInput = {
    ...EMPTY_INPUT,
    seq,
    viewTick: Math.round(viewTick),
    aim,
    throttle: k('KeyW') - k('KeyS'),
    strafe: k('KeyD') - k('KeyA'),
    vertical: k('KeyE') - k('KeyQ'),
    boost: !!k('ShiftLeft') || !!k('ShiftRight'),
    brake: !!k('Space'),
    fire1: !typing && fire1,
    fire2: !typing && fire2,
    hotbar: typing ? -1 : hotbar,
    rollLeft: !typing && rollLeft,
    rollRight: !typing && rollRight,
  };
  rollLeft = rollRight = false;
  hotbar = -1;
  return input;
}
