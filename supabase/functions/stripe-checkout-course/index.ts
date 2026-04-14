// @ts-nocheck
/**
 * Supabase Edge Function: stripe-checkout-course
 *
 * Creates a Stripe Checkout Session for a multi-day email course
 * (e.g. "The Lenten Table"). One-time purchase, no subscription.
 *
 * Body: { course_slug: string }
 *
 * On success, the stripe-webhook creates a course_enrollments row and
 * the daily-course-mailer cron function walks active enrollments once
 * per day to send the next lesson email.
 */
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')!;
const STRIPE_SUCCESS_URL =
  Deno.env.get('STRIPE_SUCCESS_URL_COURSE') ??
  'https://heritagekitchen.app/#/courses/{slug}?paid=1';
const STRIPE_CANCEL_URL =
  Deno.env.get('STRIPE_CANCEL_URL_COURSE') ??
  'https://heritagekitchen.app/#/courses/{slug}';
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
    const { course_slug } = await req.json();
    if (!course_slug) return json({ error: 'course_slug is required' }, 400);

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: course } = await supabase
      .from('courses')
      .select('*')
      .eq('slug', course_slug)
      .eq('published', true)
      .maybeSingle();
    if (!course) return json({ error: 'course not found' }, 404);

    const cents = Math.round(Number(course.price_usd) * 100);
    const successUrl = STRIPE_SUCCESS_URL.replace('{slug}', course_slug);
    const cancelUrl = STRIPE_CANCEL_URL.replace('{slug}', course_slug);

    const params = new URLSearchParams();
    params.set('mode', 'payment');
    params.set('success_url', successUrl);
    params.set('cancel_url', cancelUrl);
    params.set('metadata[kind]', 'course');
    params.set('metadata[course_slug]', course_slug);
    params.set('line_items[0][quantity]', '1');
    params.set('line_items[0][price_data][currency]', 'usd');
    params.set('line_items[0][price_data][unit_amount]', cents.toString());
    params.set('line_items[0][price_data][product_data][name]', course.title);
    if (course.subtitle) {
      params.set(
        'line_items[0][price_data][product_data][description]',
        course.subtitle,
      );
    }
    // No shipping for a course, but we want the email address.
    params.set('customer_email', '');

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
