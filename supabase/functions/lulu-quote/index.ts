// @ts-nocheck
/**
 * Supabase Edge Function: lulu-quote
 *
 * Called from the browser once a cookbook project has a PDF uploaded to
 * the cookbook-pdfs storage bucket. Returns a Lulu price quote plus the
 * markup we're charging the customer.
 *
 * Body: {
 *   project_id: string,
 *   shipping_address: {
 *     name, street1, street2?, city, state_code, postcode,
 *     country_code, phone_number, email
 *   }
 * }
 *
 * Environment variables:
 *   LULU_CLIENT_KEY      - from developers.lulu.com
 *   LULU_CLIENT_SECRET   - from developers.lulu.com
 *   LULU_ENV             - "sandbox" | "production" (defaults to sandbox)
 *   LULU_POD_PACKAGE_ID  - the print spec, e.g. 0600X0900BWSTDPB060UW444MXX
 *                         (6x9 B&W paperback 60lb uncoated white matte)
 *   BOOK_MARKUP_USD      - flat markup added on top of Lulu's cost (e.g. "15.00")
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const LULU_CLIENT_KEY = Deno.env.get('LULU_CLIENT_KEY')!;
const LULU_CLIENT_SECRET = Deno.env.get('LULU_CLIENT_SECRET')!;
const LULU_ENV = Deno.env.get('LULU_ENV') ?? 'sandbox';
const LULU_POD_PACKAGE_ID =
  Deno.env.get('LULU_POD_PACKAGE_ID') ?? '0600X0900BWSTDPB060UW444MXX';
const BOOK_MARKUP_USD = parseFloat(Deno.env.get('BOOK_MARKUP_USD') ?? '15');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

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
    const { project_id, shipping_address } = await req.json();
    if (!project_id || !shipping_address) {
      return json({ error: 'project_id and shipping_address are required' }, 400);
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Verify the project exists and belongs to a real user
    const { data: project, error: projErr } = await supabase
      .from('cookbook_projects')
      .select('*')
      .eq('id', project_id)
      .single();
    if (projErr || !project) {
      return json({ error: 'project not found' }, 404);
    }
    if (!project.page_count) {
      return json({ error: 'project has no pdf yet' }, 400);
    }

    const token = await getLuluToken();

    const quoteBody = {
      line_items: [
        {
          page_count: project.page_count,
          pod_package_id: LULU_POD_PACKAGE_ID,
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
      shipping_level: 'MAIL',
    };

    const res = await fetch(`${LULU_BASE}/print-job-cost-calculations/`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(quoteBody),
    });
    if (!res.ok) {
      const errBody = await res.text();
      return json({ error: 'lulu cost calc failed', detail: errBody }, 502);
    }
    const quote = await res.json();
    const luluTotal = parseFloat(quote.total_cost_incl_tax ?? quote.total_cost ?? '0');
    const customerTotal = luluTotal + BOOK_MARKUP_USD;

    return json({
      project_id,
      page_count: project.page_count,
      lulu_cost: luluTotal.toFixed(2),
      markup: BOOK_MARKUP_USD.toFixed(2),
      customer_total: customerTotal.toFixed(2),
      currency: quote.currency ?? 'USD',
      shipping_cost: quote.shipping_cost?.total_cost_incl_tax ?? null,
      estimated_ship_date: quote.estimated_shipping_dates?.dispatch ?? null,
    });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});

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
  const body = await res.json();
  return body.access_token as string;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...CORS },
  });
}
