// @ts-nocheck
/**
 * Supabase Edge Function: lulu-cover-dimensions
 *
 * Asks Lulu's Print API for the cover template dimensions (width, height,
 * spine, safe zone) for the configured POD package and a given page count.
 *
 * Changes from the previous version (qa-reports/heritage-kitchen.md):
 *   - HIGH 13: pod_package_id is now read from server env (POD_PACKAGE_ID
 *              in luluClient). Client param is ignored. The cover geometry
 *              and the print-job SKU are guaranteed identical.
 *   - HIGH 7:  shared luluFetch caches the OAuth token per env.
 *   - LOW 25:  if any core dimension is missing from Lulu's response we
 *              now fail loudly instead of silently falling back to 0.625"
 *              wrap and 0.5" safe-zone defaults that could be wildly off.
 *
 * Body: { page_count: number }
 *
 * Returns: {
 *   pod_package_id: string,    // echoed for caller to verify
 *   width_in: number,
 *   height_in: number,
 *   spine_in: number,
 *   wrap_in: number,
 *   safe_zone_in: number,
 * }
 */
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { POD_PACKAGE_ID, luluFetch } from '../_shared/luluClient.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const { page_count } = await req.json();
    if (!page_count || typeof page_count !== 'number' || page_count < 4) {
      return json({ error: 'page_count must be a number ≥ 4' }, 400);
    }

    const res = await luluFetch('/cover-dimensions/', {
      method: 'POST',
      body: JSON.stringify({
        pod_package_id: POD_PACKAGE_ID,
        interior_page_count: page_count,
        unit: 'inch',
      }),
    });

    if (!res.ok) {
      return json({ error: 'lulu cover-dimensions failed', detail: (await res.text()).slice(0, 600) }, 502);
    }
    const body = await res.json();

    const dims = extractDimensions(body);
    if (!dims) {
      // HIGH 25: refuse to fabricate defaults — the cover would be the
      // wrong size and Lulu would reject the print job (or worse, accept
      // a misregistered cover and ship a defective book).
      return json({
        error: 'lulu cover-dimensions response missing required fields',
        raw: body,
      }, 502);
    }

    return json({ pod_package_id: POD_PACKAGE_ID, ...dims });
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
  const wrap_in = findNum(['wrap_size_in', 'wrap_size_inches', 'bleed_in', 'bleed']);
  const safe_zone_in = findNum(['safe_zone_in', 'safe_zone_inches']);
  // Treat ANY missing core field as a hard failure. Wrap and safe-zone
  // are also required: a wrong wrap means the cover bleeds wrong.
  if (width_in == null || height_in == null || spine_in == null
      || wrap_in == null || safe_zone_in == null) return null;
  return { width_in, height_in, spine_in, wrap_in, safe_zone_in };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...CORS },
  });
}
