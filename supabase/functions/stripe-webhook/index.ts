// @ts-nocheck
/**
 * Supabase Edge Function: stripe-webhook
 *
 * Called by Stripe on events. We care about `checkout.session.completed`:
 * when a cookbook order has been paid, we create the real Lulu print-job
 * against the site-owner's Lulu account and store the resulting order id
 * on the cookbook project.
 *
 * Configure in Stripe Dashboard > Developers > Webhooks:
 *   Endpoint: https://<project-ref>.functions.supabase.co/stripe-webhook
 *   Events: checkout.session.completed
 *   Signing secret: store in STRIPE_WEBHOOK_SECRET env var
 *
 * Environment variables:
 *   STRIPE_WEBHOOK_SECRET
 *   LULU_CLIENT_KEY, LULU_CLIENT_SECRET, LULU_ENV, LULU_POD_PACKAGE_ID
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;
const LULU_CLIENT_KEY = Deno.env.get('LULU_CLIENT_KEY')!;
const LULU_CLIENT_SECRET = Deno.env.get('LULU_CLIENT_SECRET')!;
const LULU_ENV = Deno.env.get('LULU_ENV') ?? 'sandbox';
const LULU_POD_PACKAGE_ID =
  Deno.env.get('LULU_POD_PACKAGE_ID') ?? '0600X0900BWSTDPB060UW444MXX';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const LULU_BASE =
  LULU_ENV === 'production'
    ? 'https://api.lulu.com'
    : 'https://api.sandbox.lulu.com';

serve(async (req) => {
  if (req.method !== 'POST') return new Response('ok');
  const body = await req.text();
  const sig = req.headers.get('stripe-signature') ?? '';

  // Verify the webhook signature
  const verified = await verifyStripeSignature(body, sig, STRIPE_WEBHOOK_SECRET);
  if (!verified) {
    return new Response('invalid signature', { status: 400 });
  }

  const event = JSON.parse(body);
  if (event.type !== 'checkout.session.completed') {
    return new Response('ignored', { status: 200 });
  }

  const session = event.data.object;
  const project_id = session.metadata?.project_id as string | undefined;
  if (!project_id) {
    return new Response('missing project_id metadata', { status: 400 });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // Pull the project back, including the saved shipping address and PDF path.
  const { data: project } = await supabase
    .from('cookbook_projects')
    .select('*')
    .eq('id', project_id)
    .single();
  if (!project || !project.pdf_interior_path || !project.shipping_address) {
    return new Response('project not ready', { status: 400 });
  }

  // Build the PDF's public URL so Lulu can fetch it.
  const { data: pub } = supabase.storage
    .from('cookbook-pdfs')
    .getPublicUrl(project.pdf_interior_path);
  const interior_url = pub.publicUrl;

  // Create the Lulu print job
  const token = await getLuluToken();
  const printJobBody = {
    contact_email: project.shipping_address.email,
    external_id: project.id,
    line_items: [
      {
        external_id: `${project.id}-interior`,
        printable_normalization: {
          cover: {
            // We pass the same interior PDF as a stub cover; in practice
            // Lulu will auto-generate a plain cover or reject without one,
            // depending on the POD package. For the first version we use
            // a shared template cover URL set via env var.
            source_url:
              Deno.env.get('LULU_COVER_URL') ??
              interior_url,
          },
          interior: {
            source_url: interior_url,
          },
          pod_package_id: LULU_POD_PACKAGE_ID,
        },
        quantity: 1,
        title: project.title,
      },
    ],
    production_delay: 120,
    shipping_address: mapShipping(project.shipping_address),
    shipping_level: 'MAIL',
  };

  const res = await fetch(`${LULU_BASE}/print-jobs/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
    },
    body: JSON.stringify(printJobBody),
  });

  if (!res.ok) {
    const errText = await res.text();
    await supabase
      .from('cookbook_projects')
      .update({
        status: 'failed',
        lulu_status: `create_failed: ${errText.slice(0, 500)}`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', project_id);
    return new Response('lulu create failed: ' + errText, { status: 502 });
  }

  const job = await res.json();
  await supabase
    .from('cookbook_projects')
    .update({
      status: 'ordered',
      lulu_order_id: String(job.id),
      lulu_status: job.status?.name ?? 'CREATED',
      lulu_total_cost: session.amount_total ? session.amount_total / 100 : null,
      lulu_currency: (session.currency ?? 'USD').toUpperCase(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', project_id);

  return new Response('ok', { status: 200 });
});

function mapShipping(addr: Record<string, string>) {
  return {
    city: addr.city,
    country_code: addr.country_code,
    name: addr.name,
    phone_number: addr.phone_number,
    postcode: addr.postcode,
    state_code: addr.state_code,
    street1: addr.street1,
    ...(addr.street2 ? { street2: addr.street2 } : {}),
  };
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

/**
 * Stripe webhook signature verification, minus the @stripe/stripe-node
 * package so we can stay dependency-free in Deno. Implements the v1
 * signature scheme documented at
 * https://stripe.com/docs/webhooks/signatures#verify-manually
 */
async function verifyStripeSignature(
  payload: string,
  sigHeader: string,
  secret: string,
): Promise<boolean> {
  if (!sigHeader || !secret) return false;
  const parts = Object.fromEntries(
    sigHeader.split(',').map((p) => p.split('=').map((s) => s.trim()) as [string, string]),
  );
  const ts = parts['t'];
  const v1 = parts['v1'];
  if (!ts || !v1) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(`${ts}.${payload}`));
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  // constant-time compare
  if (hex.length !== v1.length) return false;
  let diff = 0;
  for (let i = 0; i < hex.length; i++) {
    diff |= hex.charCodeAt(i) ^ v1.charCodeAt(i);
  }
  return diff === 0;
}
