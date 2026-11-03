import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { FrameId, MapId, NationId, ShipId } from '@skyriot/shared';

/** What a Gate hands the target Map Instance. `from` picks the arrival Gate. */
export interface TravelClaim {
  shipId: ShipId;
  name: string;
  nation: NationId;
  frame: FrameId;
  from: MapId;
  to: MapId;
  /** Epoch ms. */
  exp: number;
}

const TTL_MS = 30_000;
// ponytail: per-process secret, fine while every Map Instance lives in one process; set TRAVEL_SECRET when split.
const SECRET = process.env.TRAVEL_SECRET ?? randomBytes(32).toString('hex');

const sign = (body: string) => createHmac('sha256', SECRET).update(body).digest('base64url');

export function signTravel(claim: Omit<TravelClaim, 'exp'>): string {
  const body = Buffer.from(JSON.stringify({ ...claim, exp: Date.now() + TTL_MS })).toString(
    'base64url',
  );
  return `${body}.${sign(body)}`;
}

/** Valid, unexpired and addressed to `mapId`, else null. */
// ponytail: not single-use; a token can be replayed within its 30 s TTL. Track used tokens if that matters.
export function verifyTravel(token: unknown, mapId: MapId): TravelClaim | null {
  if (typeof token !== 'string') return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const want = Buffer.from(sign(body));
  const got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  try {
    const c = JSON.parse(Buffer.from(body, 'base64url').toString()) as TravelClaim;
    return c.to === mapId && c.exp > Date.now() ? c : null;
  } catch {
    return null;
  }
}
