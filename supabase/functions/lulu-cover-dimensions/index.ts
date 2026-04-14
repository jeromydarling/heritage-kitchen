// @ts-nocheck
/**
 * Supabase Edge Function: lulu-cover-dimensions
 *
 * Asks Lulu's Print API for the exact cover template dimensions (width,
 * height, spine width, safe zone) for a given POD package and page count.
 * This is the source of truth for our cover generator's geometry â€” we
 * never compute spine width ourselves because Lulu's paper stock changes
 * and they publish the numbers.
 *
 * Body: { pod_package_id: string, page_count: number }
 *
 * Returns: {
 *   width_in: number,       // total cover width including wrap
 *   height_in: number,      // total cover height including wrap
 *   spine_in: number,       // just the spine width
 *   wrap_in: number,        // wrap size on the leading/trailing edge
 *   safe_zone_in: number    // recommended safe zone inside the trim
 * }
 */
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const LULU_CLIENT_KEY = Deno.env.get('LULU_CLIENT_KEY')!;
const LULU_CLIENT_SECRET = Deno.env.get('LULU_CLIENT_SECRET')!;
const LULU_ENV = Deno.env.get('LULU_ENV') ?? 'sandbox';

const LULU_BASE =
  LULU_ENV === 'production'
    ? 'https://api.lulu.com'
    : 'https://api.sandbox.lulu.com';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const { pod_package_id, page_count } = await req.json();
    if (!pod_package_id || !page_count) {
      return json({ error: 'pod_package_id and page_count are required' }, 400);
    }

    const token = await getLuluToken();

    // Lulu's cover-dimensions endpoint. This is the published route in
    // their Print API; the JSON shape may vary slightly between sandbox
    // and production â€” we extract the fields we care about by looking
    // for them under a few likely paths.
    const res = await fetch(`${LULU_BASE}/cover-dimensions/`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        pod_package_id,
        interior_page_count: page_count,
        unit: 'inch',
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return json({ error: 'lulu cover-dimensions failed', detail: errText }, 502);
    }
    const body = await res.json();

    // Best-effort extraction. Lulu's response fields are stable but
    // sometimes wrapped differently in sandbox vs prod.
    const dims = extractDimensions(body);
    if (!dims) return json({ error: 'could not parse lulu response', body }, 502);

    return json(dims);
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});

function extractDimensions(body: Record<string, unknown>) {
  const findNum = (keys: string[]): number | null => {
    for (const k of keys) {
      const v = body[k];
      if (typeof v === 'number') return v;
      if (typeof v === 'string' && !isNaN(parseFloat(v))) return parseFloat(v);
    }
    return null;
  };
  const width_in = findNum(['total_document_width_in', 'width_in', 'total_width_inches', 'width']);
  const height_in = findNum(['total_document_height_in', 'height_in', 'total_height_inches', 'height']);
  const spine_in = findNum(['spine_width_in', 'spine_width_inches', 'spine_width']);
  const wrap_in = findNum(['wrap_size_in', 'wrap_size_inches', 'bleed_in', 'bleed']) ?? 0.625;
  const safe_zone_in = findNum(['safe_zone_in', 'safe_zone_inches']) ?? 0.5;
  if (width_in == null || height_in == null || spine_in == null) return null;
  return { width_in, height_in, spine_in, wrap_in, safe_zone_in };
}

async function getLuluToken(): Promise<string> {
  const basic = btoa(`${LULU_CLIENT_KEY}:${LULU_CLIENT_SECRET}`);
  const res = await fetch(
    `${LULU_BASE}/auth/realms/glasstree/protocol/openid-connect/token`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    },
  );
  if (!res.ok) throw new Error('lulu auth failed: ' + (await res.text()));
  return (await res.json()).access_token;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...CORS },
  });
}
