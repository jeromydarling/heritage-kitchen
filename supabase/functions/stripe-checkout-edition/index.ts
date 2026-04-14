// @ts-nocheck
/**
 * Supabase Edge Function: stripe-checkout-edition
 *
 * Creates a Stripe Checkout Session for an editorial Heritage Kitchen
 * edition (curated cookbook authored by HK, sold to anyone).
 *
 * Differences vs. the user-built cookbook checkout:
 *   - Anonymous friendly: no cookbook_projects row, customers don't
 *     need to sign in. We create an `edition_orders` row after payment
 *     via the webhook.
 *   - Fixed price from the `editions` table (customer never sees Lulu
 *     cost calculation â€” the margin is baked into the sticker price).
 *   - Shipping address is collected by Stripe's Checkout page, not by
 *     our own form, since we don't have it ahead of time.
 *
 * Body: { edition_slug: string }
 *
 * Environment variables:
 *   STRIPE_SECRET_KEY, STRIPE_SUCCESS_URL_EDITION, STRIPE_CANCEL_URL_EDITION
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')!;
const STRIPE_SUCCESS_URL =
  Deno.env.get('STRIPE_SUCCESS_URL_EDITION') ??
  'https://heritagekitchen.app/#/editions/{slug}?paid=1';
const STRIPE_CANCEL_URL =
  Deno.env.get('STRIPE_CANCEL_URL_EDITION') ??
  'https://heritagekitchen.app/#/editions/{slug}';
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
    const { edition_slug } = await req.json();
    if (!edition_slug) return json({ error: 'edition_slug is required' }, 400);

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: edition } = await supabase
      .from('editions')
      .select('*')
      .eq('slug', edition_slug)
      .eq('published', true)
      .maybeSingle();
    if (!edition) return json({ error: 'edition not found' }, 404);

    const cents = Math.round(Number(edition.price_usd) * 100);
    const successUrl = STRIPE_SUCCESS_URL.replace('{slug}', edition_slug);
    const cancelUrl = STRIPE_CANCEL_URL.replace('{slug}', edition_slug);

    const params = new URLSearchParams();
    params.set('mode', 'payment');
    params.set('success_url', successUrl);
    params.set('cancel_url', cancelUrl);
    params.set('metadata[edition_slug]', edition_slug);
    params.set('metadata[kind]', 'edition');
    params.set('line_items[0][quantity]', '1');
    params.set('line_items[0][price_data][currency]', 'usd');
    params.set('line_items[0][price_data][unit_amount]', cents.toString());
    params.set('line_items[0][price_data][product_data][name]', edition.title);
    if (edition.subtitle) {
      params.set(
        'line_items[0][price_data][product_data][description]',
        edition.subtitle,
      );
    }
    params.set('shipping_address_collection[allowed_countries][0]', 'US');
    params.set('shipping_address_collection[allowed_countries][1]', 'CA');
    params.set('shipping_address_collection[allowed_countries][2]', 'GB');
    params.set('shipping_address_collection[allowed_countries][3]', 'AU');
    params.set('phone_number_collection[enabled]', 'true');

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
