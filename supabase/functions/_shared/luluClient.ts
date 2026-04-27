// @ts-nocheck
/**
 * _shared/luluClient.ts — single source of truth for Lulu Print API access
 * across Heritage Kitchen edge functions.
 *
 * Why this file:
 *   - lulu-quote, lulu-cover-dimensions, and stripe-webhook each had their
 *     own copy of getLuluToken() with no caching. Quote latency was
 *     doubled (every call did a fresh client_credentials grant) and a
 *     traffic burst could trip Lulu's auth rate limits (HIGH 7 in QA).
 *   - The fallback `pod_package_id` was a 6×9 B&W paperback SKU that
 *     contradicted the marketing copy. Centralising the constant means
 *     one bad guess can't drift across files (BLOCKER 1).
 *   - Webhook signature verification was missing entirely (MEDIUM 15);
 *     this file exposes verifyLuluSignature() so the webhook just calls it.
 *
 * Validated against Lulu sandbox 2026-04-27:
 *   60-page cookbook, MAIL to Austin TX → $22.37 USD using
 *   pod_package_id 0700X1000FCSTDCW080CW444GXX (7×10 full-color casewrap
 *   hardcover, 80lb coated white, gloss cover finish).
 */

/** Lulu environment toggle — sandbox by default. */
export const LULU_ENV = (Deno.env.get('LULU_ENV') ?? 'sandbox') as 'sandbox' | 'production';

/** API base URL for the chosen environment. */
export const LULU_BASE =
  LULU_ENV === 'production' ? 'https://api.lulu.com' : 'https://api.sandbox.lulu.com';

/**
 * Default POD package id — 7×10 full-color casewrap hardcover.
 * Validated 2026-04-27 in /home/user/workspace/heritage-kitchen-work via
 * /tmp/heritage_sku_probe.py (one-shot SKU probe). Override per-tenant by
 * setting LULU_POD_PACKAGE_ID; this is only the fallback.
 */
export const DEFAULT_POD_PACKAGE_ID = '0700X1000FCSTDCW080CW444GXX';

/** Resolved POD package id — env override wins. */
export const POD_PACKAGE_ID =
  Deno.env.get('LULU_POD_PACKAGE_ID') ?? DEFAULT_POD_PACKAGE_ID;

/** All Lulu requests need a User-Agent or Cloudflare returns 1010. */
export const LULU_USER_AGENT =
  Deno.env.get('LULU_USER_AGENT') ?? 'heritage-kitchen-print/1.0 (+https://heritagekitchen.app)';

// ─── OAuth caching (HIGH 7) ──────────────────────────────────────────
// Module-scope cache keyed by env. Token TTLs from Lulu are ~30-60 min;
// we refresh 30 s early for clock skew and to dodge boundary failures.
type CachedToken = { token: string; expiresAt: number };
const tokenCache = new Map<string, CachedToken>();

function readCreds(): { id: string; secret: string } {
  // Per-env credentials win; legacy single-pair vars accepted for back-compat.
  const id =
    Deno.env.get(LULU_ENV === 'production' ? 'LULU_PRODUCTION_CLIENT_KEY' : 'LULU_SANDBOX_CLIENT_KEY')
    ?? Deno.env.get('LULU_CLIENT_KEY')
    ?? '';
  const secret =
    Deno.env.get(LULU_ENV === 'production' ? 'LULU_PRODUCTION_CLIENT_SECRET' : 'LULU_SANDBOX_CLIENT_SECRET')
    ?? Deno.env.get('LULU_CLIENT_SECRET')
    ?? '';
  if (!id || !secret) {
    throw new Error(
      `Lulu credentials missing for env=${LULU_ENV}. Set ` +
      `${LULU_ENV === 'production' ? 'LULU_PRODUCTION_CLIENT_KEY/SECRET' : 'LULU_SANDBOX_CLIENT_KEY/SECRET'}` +
      ' (or fall back to LULU_CLIENT_KEY/SECRET).',
    );
  }
  return { id, secret };
}

export async function getLuluToken(): Promise<string> {
  const cached = tokenCache.get(LULU_ENV);
  if (cached && Date.now() < cached.expiresAt - 30_000) return cached.token;

  const { id, secret } = readCreds();
  const basic = btoa(`${id}:${secret}`);
  const res = await fetch(
    `${LULU_BASE}/auth/realms/glasstree/protocol/openid-connect/token`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': LULU_USER_AGENT,
        Accept: 'application/json',
      },
      body: 'grant_type=client_credentials',
    },
  );
  if (!res.ok) throw new Error(`Lulu auth failed [${res.status}]: ${await res.text()}`);
  const body = await res.json();
  const ttlMs = (body.expires_in ?? 1800) * 1000;
  tokenCache.set(LULU_ENV, {
    token: body.access_token as string,
    expiresAt: Date.now() + ttlMs,
  });
  return body.access_token as string;
}

/**
 * Authenticated fetch wrapper. Adds bearer token, content-type, and the
 * required User-Agent. Caller passes the path (e.g. '/print-jobs/').
 */
export async function luluFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getLuluToken();
  const headers = new Headers(init.headers ?? {});
  headers.set('Authorization', `Bearer ${token}`);
  if (!headers.has('User-Agent')) headers.set('User-Agent', LULU_USER_AGENT);
  if (!headers.has('Accept')) headers.set('Accept', 'application/json');
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  return fetch(`${LULU_BASE}${path}`, { ...init, headers });
}

// ─── Webhook signature verification (MEDIUM 15) ─────────────────────
/**
 * Verify Lulu's HMAC-SHA256 signature against the raw body. Lulu's docs
 * describe a header `Lulu-HMAC-SHA256` carrying lower-case hex of the
 * digest. Caller must pass the raw body BEFORE JSON.parse.
 *
 * Returns true if the secret is unset and `headerSig` is also missing
 * ONLY when LULU_WEBHOOK_ALLOW_UNSIGNED=true (dev escape hatch). Otherwise
 * fails closed.
 */
export async function verifyLuluSignature(
  rawBody: string,
  headerSig: string | null,
): Promise<boolean> {
  const secret = Deno.env.get('LULU_WEBHOOK_SECRET') ?? '';
  if (!secret) {
    return Deno.env.get('LULU_WEBHOOK_ALLOW_UNSIGNED') === 'true';
  }
  if (!headerSig) return false;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(rawBody));
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  // Lulu may send the digest in upper or lower case; normalize before comparing.
  const expected = hex.toLowerCase();
  const actual = headerSig.toLowerCase().replace(/^sha256=/, '');
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ actual.charCodeAt(i);
  }
  return diff === 0;
}
