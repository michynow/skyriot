import { createHmac, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { eq } from 'drizzle-orm';
import { db, schema } from './db';

// Email magic link -> stateless signed session token. Discord OAuth: not built yet (PRD M2 stretch).
// ponytail: session tokens never expire and can't be revoked; add a session table when that matters.

const SECRET =
  process.env.AUTH_SECRET ??
  (process.env.NODE_ENV === 'production'
    ? (() => {
        throw new Error('AUTH_SECRET must be set in production');
      })()
    : 'skyriot-dev-secret');
const PUBLIC_URL = process.env.PUBLIC_URL ?? `http://localhost:${process.env.PORT ?? 2567}`;
const CLIENT_URL = process.env.CLIENT_URL ?? 'http://localhost:5173';
const LINK_TTL_MS = 15 * 60_000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const mac = (payload: string) => createHmac('sha256', SECRET).update(payload).digest('base64url');

function sign(payload: string): string {
  return `${Buffer.from(payload).toString('base64url')}.${mac(payload)}`;
}

function verify(token: string): string | null {
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const payload = Buffer.from(body, 'base64url').toString();
  const want = Buffer.from(mac(payload));
  const got = Buffer.from(sig);
  return want.length === got.length && timingSafeEqual(want, got) ? payload : null;
}

/** Account id a session token belongs to, or null if the token is missing or forged. */
export function accountFromToken(token: unknown): string | null {
  if (typeof token !== 'string' || token.length > 512) return null;
  const p = verify(token)?.split('|');
  return p?.[0] === 'session' && p[1] ? p[1] : null;
}

type Handler = (req: IncomingMessage, res: ServerResponse, next: () => void) => void;

/** `POST /auth/link` (body: email, text/plain) logs a sign-in link; `GET /auth/verify` redeems it. */
export function authRoutes(): Handler {
  return (req, res, next) => {
    const url = new URL(req.url ?? '/', PUBLIC_URL);
    const fail = (err: Error) => {
      console.warn(`[auth] ${err.message}`);
      if (!res.headersSent) res.writeHead(500).end();
    };
    if (req.method === 'POST' && url.pathname === '/auth/link') requestLink(req, res).catch(fail);
    else if (req.method === 'GET' && url.pathname === '/auth/verify') redeem(url, res).catch(fail);
    else next();
  };

  async function requestLink(req: IncomingMessage, res: ServerResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    let body = '';
    for await (const chunk of req) {
      body += chunk;
      if (body.length > 300) return void res.writeHead(413).end();
    }
    const email = body.trim().toLowerCase();
    if (!EMAIL_RE.test(email) || email.length > 254) return void res.writeHead(400).end();
    if (!db) return void res.writeHead(503).end();
    const link = `${PUBLIC_URL}/auth/verify?t=${sign(`link|${email}|${Date.now() + LINK_TTL_MS}`)}`;
    // ponytail: dev logs the link instead of mailing it; plug an SMTP/API mailer in here for prod.
    console.log(`[auth] sign-in link for ${email}: ${link}`);
    res.writeHead(204).end();
  }

  async function redeem(url: URL, res: ServerResponse) {
    const [kind, email, exp] = verify(url.searchParams.get('t') ?? '')?.split('|') ?? [];
    if (kind !== 'link' || !email || !(Number(exp) > Date.now()))
      return void res.writeHead(400).end('Link invalid or expired.');
    if (!db) return void res.writeHead(503).end('Database unavailable.');
    await db.insert(schema.account).values({ email }).onConflictDoNothing();
    const [row] = await db
      .select({ id: schema.account.id })
      .from(schema.account)
      .where(eq(schema.account.email, email));
    // Fragment, not query: the token never reaches a server log.
    res.writeHead(302, { Location: `${CLIENT_URL}/#token=${sign(`session|${row!.id}`)}` }).end();
  }
}
