// @ts-nocheck
/**
 * Supabase Edge Function: stripe-checkout
 *
 * Creates a Stripe Checkout Session for a cookbook order. The client has
 * already uploaded the PDF and received a quote from `lulu-quote`. The
 * shipping address and the quoted totals are passed in and stored on
 * the checkout session's metadata so the webhook can reconstruct the
 * order without any extra DB lookups.
 *
 * Body: {
 *   project_id: string,
 *   customer_total: string,   // e.g. "39.95"
 *   currency: string,         // "USD"
 *   shipping_address: {...},  // same shape as lulu-quote
 * }
 *
 * Returns: { url: string } â€” redirect the browser to this URL.
 *
 * Environment variables:
 *   STRIPE_SECRET_KEY     - sk_live_... or sk_test_...
 *   STRIPE_SUCCESS_URL    - e.g. "https://heritagekitchen.app/#/order/{id}?paid=1"
 *   STRIPE_CANCEL_URL     - e.g. "https://heritagekitchen.app/#/cookbook/build"
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
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

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const { project_id, customer_total, currency, shipping_address } =
      await req.json();

    if (!project_id || !customer_total || !shipping_address) {
      return json({ error: 'missing required fields' }, 400);
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: project } = await supabase
      .from('cookbook_projects')
      .select('id, title, subtitle, page_count')
      .eq('id', project_id)
      .single();
    if (!project) return json({ error: 'project not found' }, 404);

    const cents = Math.round(parseFloat(customer_total) * 100);
    const curr = (currency ?? 'USD').toLowerCase();

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
    params.set('customer_email', shipping_address.email ?? '');
    params.set('metadata[project_id]', project_id);
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
    return json({ url: session.url, id: session.id });
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
