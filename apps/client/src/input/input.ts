import type { Camera } from 'three';
import {
  EMPTY_INPUT,
  FRAMES,
  HOTBAR_BARS,
  HOTBAR_BAR_SLOTS,
  STRUCTURES,
  TICK_HZ,
  type PilotInput,
  type ShipId,
  type ShipState,
} from '@skyriot/shared';
import { world } from '../state/world';
import { useSettings } from '../ui/settings';

/** Mutable input-side state shared with the HUD (read per frame, never React state). */
export const inputState = {
  targetId: null as ShipId | null,
  /** Target picked by hand (Shift or Tab): auto-lock leaves it alone until the next Shift/Tab. */
  manualTarget: false,
  typing: false,
  /** Called when Enter requests the chat line. Set by the HUD. */
  onOpenChat: null as (() => void) | null,
  /** performance.now() until which a first B press waits for confirmation (B again or Y) to halt. */
  haltPromptUntil: 0,
  /** performance.now() of the last double-tap made while the Barrel Roll was still recharging. */
  rollDeniedAt: 0,
  /** Hotbar bar the number keys fire (0-based); C cycles, F1-F3 pick. */
  hotbarBar: 0,
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

const DOUBLE_TAP_MS = 380; // max gap from the first key release to the second press
/** A roll request is re-sent this long, so a tap a few ticks early (recharge ending) or a frozen tick isn't lost. */
const ROLL_ARM_MS = 300;
export const AIM_DISTANCE = 600;

const keys = new Set<string>();
const lastUp: Record<string, number> = {};
/** performance.now() until which a roll request (-1 left / +1 right) is armed. */
let rollArmUntil = 0;
let rollArmDir = 0;
let hotbar = -1;
let launch = false;
let halt = false;
const HALT_CONFIRM_MS = 3000;
let fire1 = false;
let fire2 = false;
let lockFailed = false;
let pointerX = 0;
let pointerY = 0;
// Mouse-aim: the mouse turns a world-space aim direction freely; the Ship steers toward it on its own.
let aimYaw = 0;
let aimPitch = 0;
/** Virtual stick: cursor offset from screen centre (unit disc). It stays put; the Ship turns while it is off-centre. */
let stickX = 0;
let stickY = 0;
let flipYaw = 0;
let flipUntil = 0;
const AIM_PITCH_MAX = 1.45;
/** Shift picks enemies within ~55 degrees of the nose. */
const LOCK_PICK_COS = Math.cos((55 * Math.PI) / 180);
/** Auto-lock takes an enemy within ~15 degrees of the nose (in the crosshair) when nothing is picked by hand. */
const AUTO_LOCK_COS = Math.cos((15 * Math.PI) / 180);
/** Cursor is kept inside this NDC box so the aim point never leaves the screen. */
const CURSOR_EDGE = 0.92;
/** Full stick asks for this fraction of the Frame's turn rate (the sim turns at angle-to-aim * TURN_GAIN). */
const STICK_MAX_RATE = 0.7;
const SIM_TURN_GAIN = 5;
/** Response curve exponent: fine control near centre, full rate only at the rim. */
const STICK_CURVE = 1.7;
/** Stick travel per pixel of mouse movement, and the centre dead zone. */
const STICK_PER_PX = 0.0018;
const STICK_DEAD = 0.05;
const FLIP_MS = 700;

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
  world.lookBack = false;
}

/** Enemy (Ship or Base structure) nearest the centre crosshair within `minCos` of the nose and radar range. */
function nearestToCrosshair(own: ShipState, minCos: number): ShipId | null {
  const range = FRAMES[own.frame].radarRangeM;
  const [x, y, z, w] = own.rot;
  const fx = -2 * (x * z + w * y),
    fy = -2 * (y * z - w * x),
    fz = -(1 - 2 * (x * x + y * y));
  let best: ShipId | null = null;
  let bestCos = minCos;
  const consider = (id: string, dx: number, dy: number, dz: number) => {
    const d = Math.hypot(dx, dy, dz);
    if (d > range || d < 1) return;
    const cos = (dx * fx + dy * fy + dz * fz) / d;
    if (cos > bestCos) {
      bestCos = cos;
      best = id;
    }
  };
  for (const s of world.ships.values())
    if (s.alive && s.nation !== own.nation)
      consider(s.id, s.pos[0] - own.pos[0], s.pos[1] - own.pos[1], s.pos[2] - own.pos[2]);
  // Enemy Base structures (Shield Stations, Turrets, Core) can be locked too.
  for (const st of world.structures.values())
    if (st.alive && st.nation !== own.nation)
      consider(
        st.id,
        st.pos[0] - own.pos[0],
        st.pos[1] + STRUCTURES[st.kind].height / 2 - own.pos[1],
        st.pos[2] - own.pos[2],
      );
  return best;
}

/** Shift: lock onto the enemy nearest the centre crosshair and hold it; Shift on it again (or on nothing) releases to auto-lock. */
export function lockNearestToCrosshair(): void {
  const own = world.ownId ? world.ships.get(world.ownId) : undefined;
  if (!own) return;
  const best = nearestToCrosshair(own, LOCK_PICK_COS);
  const release = best === null || (inputState.manualTarget && best === inputState.targetId);
  inputState.targetId = release ? null : best;
  inputState.manualTarget = !release;
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
    inputState.manualTarget = false;
    return;
  }
  const i = enemies.findIndex((e) => e.id === inputState.targetId);
  inputState.targetId = enemies[(i + 1) % enemies.length]!.id;
  inputState.manualTarget = true;
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
        rollArmDir = e.code === 'KeyA' ? -1 : 1;
        rollArmUntil = performance.now() + ROLL_ARM_MS;
        lastUp[e.code] = -1e9;
        const own = world.ownId ? world.ships.get(world.ownId) : undefined;
        // Still recharging past the arm window: the roll won't happen, say so instead of failing silently.
        if (own && own.rollCooldownTicks / TICK_HZ > ROLL_ARM_MS / 1000)
          inputState.rollDeniedAt = performance.now();
      }
    } else if (e.code === 'Tab') cycleTarget();
    else if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') lockNearestToCrosshair();
    else if (e.code === 'KeyX') world.lookBack = true;
    else if (e.code === 'KeyB' || (e.code === 'KeyY' && inputState.haltPromptUntil > 0)) {
      const own = world.ownId ? world.ships.get(world.ownId) : undefined;
      const now = performance.now();
      // Leaving a halt needs no confirmation; entering one does (B, then B or Y within 3 s).
      if (own?.halted || now < inputState.haltPromptUntil) {
        halt = true;
        inputState.haltPromptUntil = 0;
      } else if (e.code === 'KeyB') inputState.haltPromptUntil = now + HALT_CONFIRM_MS;
    } else if (e.code === 'KeyR' && !e.repeat) launch = true;
    else if (e.code.startsWith('Alt')) {
      world.freeLook = true;
      world.cursor.x = world.cursor.y = 0;
    } else if (e.code === 'KeyC' && !e.repeat) {
      inputState.hotbarBar = (inputState.hotbarBar + 1) % HOTBAR_BARS;
    } else if (/^F[1-9]$/.test(e.code) && Number(e.code.slice(1)) <= HOTBAR_BARS) {
      e.preventDefault();
      inputState.hotbarBar = Number(e.code.slice(1)) - 1;
    } else if (e.code.startsWith('Digit')) {
      const n = Number(e.code.slice(5));
      hotbar = inputState.hotbarBar * HOTBAR_BAR_SLOTS + (n === 0 ? 9 : n - 1);
      const own = world.ownId ? world.ships.get(world.ownId) : undefined;
      // Pivot Flip turns the steering aim around; the sim only lifts the turn-rate cap.
      if (own && FRAMES[own.frame].hotbar[hotbar] === 'pivot-flip' && !own.cooldowns[hotbar]) {
        const [x, y, z, w] = own.rot;
        flipYaw = Math.atan2(2 * (x * z + w * y), 1 - 2 * (x * x + y * y)) + Math.PI;
        flipUntil = performance.now() + FLIP_MS;
      }
    }
  };
  const onKeyUp = (e: KeyboardEvent) => {
    keys.delete(e.code);
    if (e.code === 'KeyA' || e.code === 'KeyD') lastUp[e.code] = performance.now();
    if (e.code.startsWith('Alt')) world.freeLook = false;
    if (e.code === 'KeyX') world.lookBack = false;
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
    // Sensitivity is tuned in rad/px for the old free aim; keep its ratio so the dev slider still works.
    const k = (STICK_PER_PX * inputSettings.sensitivity) / 0.0012;
    stickX += e.movementX * k;
    stickY -= e.movementY * k;
    const len = Math.hypot(stickX, stickY);
    if (len > 1) {
      stickX /= len;
      stickY /= len;
    }
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

/**
 * Per render frame: the cursor shows the virtual stick; the steering aim is the Ship's heading led by the stick
 * offset, so a held offset keeps turning (circle by parking the mouse off-centre) and centring it flies straight.
 */
export function trackAim(_camera: Camera, own: ShipState | undefined): void {
  if (!own || world.freeLook) return;
  let sx = stickX,
    sy = stickY;
  if (!isLocked() && lockFailed) {
    // Pointer lock refused (iframe, headless): the absolute mouse position is the stick.
    sx = pointerX;
    sy = pointerY;
  }
  world.cursor.x = sx * CURSOR_EDGE;
  world.cursor.y = sy * CURSOR_EDGE;
  const [x, y, z, w] = own.rot;
  const fx = -2 * (x * z + w * y),
    fy = -2 * (y * z - w * x),
    fz = -(1 - 2 * (x * x + y * y));
  const yaw = Math.atan2(-fx, -fz);
  const pitch = Math.asin(Math.max(-1, Math.min(1, fy)));
  if (performance.now() < flipUntil) {
    aimYaw = flipYaw;
    aimPitch = 0;
    return;
  }
  const len = Math.hypot(sx, sy);
  const mag = len < STICK_DEAD ? 0 : ((len - STICK_DEAD) / (1 - STICK_DEAD)) ** STICK_CURVE;
  const k = mag / (len || 1);
  const lead = (FRAMES[own.frame].turnRate * STICK_MAX_RATE) / SIM_TURN_GAIN;
  aimYaw = yaw - sx * k * lead;
  aimPitch = Math.max(-AIM_PITCH_MAX, Math.min(AIM_PITCH_MAX, pitch + sy * k * lead));
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
  // A hand-picked Target (Shift/Tab) is held until the next Shift/Tab; otherwise auto-lock takes whoever is in
  // the crosshair and keeps them until someone else is. Either drops when it dies.
  const id = inputState.targetId;
  const alive = id ? (world.ships.get(id) ?? world.structures.get(id))?.alive : false;
  if (!own || !alive) {
    inputState.targetId = null;
    inputState.manualTarget = false;
  }
  if (own && !inputState.manualTarget)
    inputState.targetId = nearestToCrosshair(own, AUTO_LOCK_COS) ?? inputState.targetId;

  // Armed roll: resent every tick of the window; the sim ignores it once the roll has started.
  const rollArm = performance.now() < rollArmUntil ? rollArmDir : 0;
  const input: PilotInput = {
    ...EMPTY_INPUT,
    seq,
    viewTick: Math.round(viewTick),
    aim,
    throttle: k('KeyW') - k('KeyS'),
    strafe: k('KeyD') - k('KeyA'),
    vertical: k('KeyE') - k('KeyQ'),
    boost: !!k('Space'),
    // S is the brake: down to the engine's min speed, or onto the Launch Deck when over it.
    brake: !!k('KeyS'),
    fire1: !typing && fire1,
    fire2: !typing && fire2,
    hotbar: typing ? -1 : hotbar,
    rollLeft: !typing && rollArm === -1,
    rollRight: !typing && rollArm === 1,
    launch: !typing && launch,
    halt: !typing && halt,
    target: inputState.targetId,
  };
  if (import.meta.env.DEV && (input.rollLeft || input.rollRight))
    console.debug('[roll] sent', input.rollLeft ? 'left' : 'right', 'seq', seq);
  launch = false;
  halt = false;
  hotbar = -1;
  return input;
}
