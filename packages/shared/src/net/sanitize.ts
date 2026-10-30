import type { PilotInput, Vec3 } from '../types';

const MAX_SEQ = 2 ** 31 - 1;

function num(v: unknown, lo: number, hi: number): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(Math.max(v, lo), hi) : null;
}

function bool(v: unknown): boolean {
  return v === true;
}

/** Validate and clamp a raw client message into a PilotInput, or null if malformed. */
export function sanitizeInput(raw: unknown): PilotInput | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const seq = num(r.seq, 0, MAX_SEQ);
  const throttle = num(r.throttle, -1, 1);
  const strafe = num(r.strafe, -1, 1);
  const vertical = num(r.vertical, -1, 1);
  const viewTick = num(r.viewTick, 0, MAX_SEQ);
  const hotbar = num(r.hotbar, -1, 9);
  const a = r.aim;
  if (seq === null || throttle === null || strafe === null || vertical === null) return null;
  if (!Array.isArray(a) || a.length !== 3) return null;
  const ax = num(a[0], -1e6, 1e6),
    ay = num(a[1], -1e6, 1e6),
    az = num(a[2], -1e6, 1e6);
  if (ax === null || ay === null || az === null) return null;
  const len = Math.hypot(ax, ay, az);
  if (len < 1e-6) return null;
  const aim: Vec3 = [ax / len, ay / len, az / len];
  return {
    seq: Math.floor(seq),
    aim,
    throttle,
    strafe,
    vertical,
    boost: bool(r.boost),
    brake: bool(r.brake),
    fire1: bool(r.fire1),
    fire2: bool(r.fire2),
    hotbar: hotbar === null ? -1 : Math.trunc(hotbar),
    rollLeft: bool(r.rollLeft),
    rollRight: bool(r.rollRight),
    launch: bool(r.launch),
    target: sanitizeTarget(r.target),
    viewTick: viewTick === null ? 0 : Math.floor(viewTick),
  };
}

const MAX_TARGET_LENGTH = 64;

function sanitizeTarget(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 && v.length < MAX_TARGET_LENGTH ? v : null;
}
