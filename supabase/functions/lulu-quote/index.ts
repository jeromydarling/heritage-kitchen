// @ts-nocheck
/**
 * Supabase Edge Function: lulu-quote
 *
 * Returns a Lulu price quote + customer-facing total for a cookbook
 * project that has its PDF uploaded.
 *
 * Body: {
 *   project_id: string,
 *   shipping_address: { name, street1, ..., country_code, phone_number, email },
 *   shipping_level?: 'MAIL' | 'PRIORITY_MAIL' | 'GROUND_HD' | 'EXPEDITED' | 'EXPRESS',
 * }
 *
 * Changes from the previous version (qa-reports/heritage-kitchen.md):
 *   - HIGH 7: now uses the shared luluClient with module-scoped OAuth caching
 *   - HIGH 10: shipping_level is parameterised (default falls back to env var
 *              LULU_DEFAULT_SHIPPING_LEVEL → 'GROUND_HD' for sane US delivery)
 *   - HIGH 13: pod_package_id is read from server env via the shared client,
 *              never from a client param, so the cover dimensions and the
 *              print job stay consistent
 *   - LOW 27: server re-derives page_count from the project row (cheap
 *              integrity check vs trusting the browser's claim)
 */
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { POD_PACKAGE_ID, luluFetch } from '../_shared/luluClient.ts';

const BOOK_MARKUP_USD = parseFloat(Deno.env.get('BOOK_MARKUP_USD') ?? '15');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const DEFAULT_SHIPPING_LEVEL = Deno.env.get('LULU_DEFAULT_SHIPPING_LEVEL') ?? 'GROUND_HD';

const ALLOWED_SHIPPING = new Set([
  'MAIL', 'PRIORITY_MAIL', 'GROUND_HD', 'EXPEDITED', 'EXPRESS',
]);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const { project_id, shipping_address, shipping_level } = await req.json();
    if (!project_id || !shipping_address) {
      return json({ error: 'project_id and shipping_address are required' }, 400);
    }

    const ship = ALLOWED_SHIPPING.has(String(shipping_level))
      ? String(shipping_level)
      : DEFAULT_SHIPPING_LEVEL;

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: project, error: projErr } = await supabase
      .from('cookbook_projects')
      .select('id, page_count, pdf_interior_path')
      .eq('id', project_id)
      .single();
    if (projErr || !project) return json({ error: 'project not found' }, 404);
    if (!project.page_count || !project.pdf_interior_path) {
      return json({ error: 'project has no pdf yet' }, 400);
    }
    if (project.page_count < 24) {
      // Lulu hardcover minimum (matches pdfGen.ts pad-up behaviour).
      return json({ error: 'page_count below Lulu minimum (24)' }, 400);
    }

    const quoteBody = {
      line_items: [
        {
          page_count: project.page_count,
          pod_package_id: POD_PACKAGE_ID,
          quantity: 1,
        },
      ],
      shipping_address: {
        city: shipping_address.city,
        country_code: shipping_address.country_code,
        name: shipping_address.name,
        phone_number: shipping_address.phone_number,
        postcode: shipping_address.postcode,
        state_code: shipping_address.state_code,
        street1: shipping_address.street1,
        ...(shipping_address.street2 ? { street2: shipping_address.street2 } : {}),
      },
      shipping_level: ship,
    };

    const res = await luluFetch('/print-job-cost-calculations/', {
      method: 'POST',
      body: JSON.stringify(quoteBody),
    });
    if (!res.ok) {
      const errBody = await res.text();
      return json({ error: 'lulu cost calc failed', detail: errBody.slice(0, 800) }, 502);
    }
    const quote = await res.json();
    const luluTotal = parseFloat(quote.total_cost_incl_tax ?? quote.total_cost ?? '0');
    const customerTotal = luluTotal + BOOK_MARKUP_USD;

    return json({
      project_id,
      page_count: project.page_count,
      pod_package_id: POD_PACKAGE_ID,
      lulu_cost: luluTotal.toFixed(2),
      markup: BOOK_MARKUP_USD.toFixed(2),
      customer_total: customerTotal.toFixed(2),
      currency: quote.currency ?? 'USD',
      shipping_level: ship,
      shipping_cost: quote.shipping_cost?.total_cost_incl_tax ?? null,
      estimated_ship_date: quote.estimated_shipping_dates?.dispatch ?? null,
    });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...CORS },
  });
}
