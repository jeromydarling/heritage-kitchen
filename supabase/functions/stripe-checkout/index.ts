// @ts-nocheck
/**
 * Supabase Edge Function: stripe-checkout
 *
 * Creates a Stripe Checkout Session for a cookbook order. The client has
 * already uploaded the PDF and received a quote from `lulu-quote`. The
 * shipping address is passed in; the customer total is RECOMPUTED here
 * server-side by re-quoting Lulu, so the browser cannot tamper with the
 * price between quote and checkout.
 *
 * Body: {
 *   project_id: string,
 *   customer_total: string,   // for sanity-check only -- server recomputes
 *   currency: string,         // for sanity-check only -- server recomputes
 *   shipping_address: {...},  // same shape as lulu-quote
 * }
 *
 * Returns: { url: string } - redirect the browser to this URL.
 *
 * Environment variables:
 *   STRIPE_SECRET_KEY     - sk_live_... or sk_test_...
 *   STRIPE_SUCCESS_URL    - e.g. "https://heritagekitchen.app/#/order/{id}?paid=1"
 *   STRIPE_CANCEL_URL     - e.g. "https://heritagekitchen.app/#/cookbook/build"
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   LULU_QUOTE_FN_URL     - optional; defaults to /functions/v1/lulu-quote on this project
 */
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')!;
const STRIPE_SUCCESS_URL =
  Deno.env.get('STRIPE_SUCCESS_URL') ??
  'https://heritagekitchen.app/#/order/{id}?paid=1';
const STRIPE_CANCEL_URL =
  Deno.env.get('STRIPE_CANCEL_URL') ??
  'https://heritagekitchen.app/#/cookbook/build';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Tolerance for the client-vs-server price diff. We allow a few cents to
// absorb floating-point quirks but anything bigger is rejected.
const PRICE_TOLERANCE_USD = 0.5;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const {
      project_id,
      customer_total: clientTotal,
      currency: clientCurrency,
      shipping_address,
    } = await req.json();

    if (!project_id || !shipping_address) {
      return json({ error: 'missing required fields' }, 400);
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: project } = await supabase
      .from('cookbook_projects')
      .select('id, title, subtitle, page_count, shipping_level')
      .eq('id', project_id)
      .single();
    if (!project) return json({ error: 'project not found' }, 404);

    // Re-quote server-side so the price the client claims has to match
    // what Lulu actually says today. This closes the gap where a
    // tampering client could send a $1 customer_total and we'd happily
    // charge them a dollar for a $40 book.
    const quoteUrl =
      Deno.env.get('LULU_QUOTE_FN_URL') ??
      `${SUPABASE_URL}/functions/v1/lulu-quote`;
    const quoteRes = await fetch(quoteUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        project_id,
        shipping_address,
        shipping_level: project.shipping_level ?? undefined,
      }),
    });
    if (!quoteRes.ok) {
      const detail = await quoteRes.text();
      return json({ error: 'server-side quote failed', detail }, 502);
    }
    const quote = await quoteRes.json();
    const serverTotal = parseFloat(quote.customer_total);
    const serverCurrency = (quote.currency ?? 'USD').toString();

    if (!Number.isFinite(serverTotal) || serverTotal <= 0) {
      return json({ error: 'server-side quote returned invalid total' }, 502);
    }

    // If the client sent a total, it must agree with the server within
    // tolerance. If it doesn't, the client's view is stale (Lulu prices
    // moved) or someone is tampering -- either way refuse and let them
    // re-quote.
    if (clientTotal != null) {
      const ct = parseFloat(clientTotal);
      if (Number.isFinite(ct) && Math.abs(ct - serverTotal) > PRICE_TOLERANCE_USD) {
        return json(
          {
            error: 'price changed since quote',
            server_total: serverTotal.toFixed(2),
            client_total: ct.toFixed(2),
            currency: serverCurrency,
          },
          409,
        );
      }
    }
    if (clientCurrency && clientCurrency.toUpperCase() !== serverCurrency.toUpperCase()) {
      return json(
        { error: 'currency mismatch', server: serverCurrency, client: clientCurrency },
        409,
      );
    }

    const cents = Math.round(serverTotal * 100);
    const curr = serverCurrency.toLowerCase();

    // Stash the shipping address on the project so the webhook doesn't
    // have to receive it from Stripe metadata (which has a 500-char limit).
    await supabase
      .from('cookbook_projects')
      .update({
        shipping_address,
        status: 'ready',
        updated_at: new Date().toISOString(),
      })
      .eq('id', project_id);

    const successUrl = STRIPE_SUCCESS_URL.replace('{id}', project_id);

    // Build Stripe Checkout Session via the form-encoded API (no SDK
    // needed; Stripe's API accepts application/x-www-form-urlencoded).
    const params = new URLSearchParams();
    params.set('mode', 'payment');
    params.set('success_url', successUrl);
    params.set('cancel_url', STRIPE_CANCEL_URL);
    params.set(
      'customer_email',
      (shipping_address.email ?? '').toString().trim().toLowerCase(),
    );
    params.set('metadata[project_id]', project_id);
    params.set('metadata[server_total]', serverTotal.toFixed(2));
    params.set('metadata[currency]', serverCurrency);
    params.set('line_items[0][quantity]', '1');
    params.set('line_items[0][price_data][currency]', curr);
    params.set('line_items[0][price_data][unit_amount]', cents.toString());
    params.set(
      'line_items[0][price_data][product_data][name]',
      project.title || 'Heritage Kitchen cookbook',
    );
    if (project.subtitle) {
      params.set(
        'line_items[0][price_data][product_data][description]',
        project.subtitle,
      );
    }
    params.set('shipping_address_collection[allowed_countries][0]', 'US');
    params.set('shipping_address_collection[allowed_countries][1]', 'CA');
    params.set('shipping_address_collection[allowed_countries][2]', 'GB');

    const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });
    if (!stripeRes.ok) {
      const errBody = await stripeRes.text();
      return json({ error: 'stripe create session failed', detail: errBody }, 502);
    }
    const session = await stripeRes.json();
    return json({
      url: session.url,
      id: session.id,
      server_total: serverTotal.toFixed(2),
      currency: serverCurrency,
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
