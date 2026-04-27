// @ts-nocheck
/**
 * Supabase Edge Function: edition-order-by-session
 *
 * Public, anonymous-callable endpoint used by the post-payment download
 * page for editions. Given a Stripe Checkout Session id, this function:
 *
 *   1. Verifies the session id with Stripe (so a random caller can't
 *      enumerate edition_orders rows by guessing UUIDs).
 *   2. Confirms payment_status === 'paid' before returning anything.
 *   3. Looks up the matching edition_orders row using the service role
 *      key -- bypassing RLS, but only after Stripe has vouched for the
 *      session. We also re-check that the email on the order matches
 *      what Stripe has on the session.
 *   4. Returns ONLY the four fields the download page needs:
 *      edition_slug, pdf_download_url, pdf_download_expires_at, status.
 *
 * This replaces the broken anonymous SELECT path on edition_orders --
 * RLS does not let signed-out PDF buyers read their own row, but we
 * still need to hand them the signed PDF URL after they pay. Going
 * through Stripe as the trust anchor means the row is only readable
 * with the stripe_session_id (a 66-char opaque token from Stripe's
 * own session creation), and only while payment_status === 'paid'.
 *
 * Body: { session_id: string }
 * Returns: { edition_slug, pdf_download_url, pdf_download_expires_at, status } | null
 *
 * Environment variables:
 *   STRIPE_SECRET_KEY
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')!;
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
    const { session_id } = await req.json();
    if (!session_id || typeof session_id !== 'string') {
      return json({ error: 'session_id required' }, 400);
    }

    // 1. Verify the session with Stripe directly.
    const stripeRes = await fetch(
      `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(session_id)}`,
      {
        headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` },
      },
    );
    if (!stripeRes.ok) {
      // 404 from Stripe = session id was bogus or from a different
      // environment. Don't leak which.
      return json(null, 200);
    }
    const session = await stripeRes.json();
    if (session.payment_status !== 'paid') {
      return json(null, 200);
    }

    // 2. Look up the order row server-side.
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: order, error } = await supabase
      .from('edition_orders')
      .select(
        'edition_slug, pdf_download_url, pdf_download_expires_at, status, customer_email',
      )
      .eq('stripe_session_id', session_id)
      .maybeSingle();
    if (error) {
      return json({ error: 'lookup failed', detail: error.message }, 500);
    }
    if (!order) return json(null, 200);

    // 3. Belt-and-suspenders email check. If for any reason the row's
    // email does not match the session's customer email, refuse. This
    // prevents a hypothetical session-swap attack where an attacker
    // crafts a session id that happens to collide with someone else's
    // legit order id.
    const sessEmail = (
      session.customer_details?.email ??
      session.customer_email ??
      ''
    )
      .toLowerCase()
      .trim();
    const rowEmail = (order.customer_email ?? '').toLowerCase().trim();
    if (sessEmail && rowEmail && sessEmail !== rowEmail) {
      return json(null, 200);
    }

    // 4. Strip the email before returning.
    return json({
      edition_slug: order.edition_slug,
      pdf_download_url: order.pdf_download_url,
      pdf_download_expires_at: order.pdf_download_expires_at,
      status: order.status,
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
