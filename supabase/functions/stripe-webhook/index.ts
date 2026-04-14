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
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // Branch by kind: edition orders, course enrollments, user-built cookbooks
  const kind = session.metadata?.kind as string | undefined;
  if (kind === 'edition') {
    return await handleEditionOrder(session, supabase);
  }
  if (kind === 'course') {
    return await handleCourseEnrollment(session, supabase);
  }

  const project_id = session.metadata?.project_id as string | undefined;
  if (!project_id) {
    return new Response('missing project_id metadata', { status: 400 });
  }

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

async function handleCourseEnrollment(
  session: Record<string, unknown>,
  supabase: ReturnType<typeof createClient>,
) {
  const meta = (session.metadata ?? {}) as Record<string, string>;
  const course_slug = meta.course_slug;
  if (!course_slug) {
    return new Response('missing course_slug metadata', { status: 400 });
  }

  const { data: course } = await supabase
    .from('courses')
    .select('*')
    .eq('slug', course_slug)
    .single();
  if (!course) return new Response('course not found', { status: 404 });

  const customer =
    (session.customer_details as Record<string, string> | undefined) ?? {};
  const email = customer.email ?? '';
  const name = customer.name ?? '';

  // Decide when to start based on the course's start_trigger.
  let started_on: string | null = null;
  let status: 'active' | 'scheduled' = 'active';
  const today = new Date();
  if (course.start_trigger === 'on_purchase') {
    // First lesson ships tomorrow; store today's date so day 1 is t+1.
    started_on = today.toISOString().slice(0, 10);
    status = 'active';
  } else if (course.start_trigger === 'fixed_date' && course.start_date) {
    started_on = course.start_date;
    status = new Date(course.start_date) <= today ? 'active' : 'scheduled';
  } else if (course.start_trigger === 'ash_wednesday') {
    started_on = nextAshWednesday(today).toISOString().slice(0, 10);
    status = 'scheduled';
  } else if (course.start_trigger === 'first_sunday_advent') {
    started_on = nextFirstSundayAdvent(today).toISOString().slice(0, 10);
    status = 'scheduled';
  }

  await supabase.from('course_enrollments').insert({
    course_slug,
    email,
    customer_name: name,
    started_on,
    last_sent_day: 0,
    status,
    stripe_session_id: session.id,
    amount_paid_cents: session.amount_total,
    currency: String(session.currency ?? 'USD').toUpperCase(),
  });

  return new Response('ok (enrolled)', { status: 200 });
}

// Butcher's algorithm â€” Gregorian Easter, ash wednesday = easter - 46
function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const L = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * L) / 451);
  const month = Math.floor((h + L - 7 * m + 114) / 31);
  const day = ((h + L - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function nextAshWednesday(after: Date): Date {
  let y = after.getFullYear();
  let candidate = new Date(easterSunday(y).getTime() - 46 * 86400_000);
  if (candidate <= after) {
    candidate = new Date(easterSunday(y + 1).getTime() - 46 * 86400_000);
  }
  return candidate;
}

function nextFirstSundayAdvent(after: Date): Date {
  const pickYear = (year: number) => {
    const dec24 = new Date(year, 11, 24);
    const back = dec24.getDay();
    const fourth = new Date(year, 11, 24 - back);
    const first = new Date(fourth);
    first.setDate(first.getDate() - 21);
    return first;
  };
  let cand = pickYear(after.getFullYear());
  if (cand <= after) cand = pickYear(after.getFullYear() + 1);
  return cand;
}

async function handleEditionOrder(
  session: Record<string, unknown>,
  supabase: ReturnType<typeof createClient>,
) {
  const meta = (session.metadata ?? {}) as Record<string, string>;
  const edition_slug = meta.edition_slug;
  const format = (meta.format ?? 'print') as 'print' | 'pdf';
  if (!edition_slug) {
    return new Response('missing edition_slug metadata', { status: 400 });
  }

  // Load the edition so we know what to print or deliver
  const { data: edition } = await supabase
    .from('editions')
    .select('*')
    .eq('slug', edition_slug)
    .single();
  if (!edition) {
    return new Response('edition not found', { status: 404 });
  }

  // Digital delivery path: no shipping, no Lulu. Generate a signed
  // download URL for the stored PDF, expire it in a year, store it on
  // the order row so the customer's success page can read it.
  if (format === 'pdf') {
    const customer =
      (session.customer_details as Record<string, string> | undefined) ?? {};
    if (!edition.pdf_storage_path) {
      return new Response('edition has no pdf_storage_path configured', {
        status: 500,
      });
    }
    const expiresIn = 60 * 60 * 24 * 365; // one year
    const { data: signed, error: signErr } = await supabase.storage
      .from('cookbook-pdfs')
      .createSignedUrl(edition.pdf_storage_path, expiresIn);
    if (signErr || !signed) {
      return new Response('failed to sign download url', { status: 500 });
    }
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
    await supabase.from('edition_orders').insert({
      edition_slug,
      customer_email: customer.email ?? '',
      customer_name: customer.name ?? '',
      format: 'pdf',
      status: 'delivered',
      stripe_session_id: session.id,
      amount_paid_cents: session.amount_total,
      currency: String(session.currency ?? 'USD').toUpperCase(),
      pdf_download_url: signed.signedUrl,
      pdf_download_expires_at: expiresAt,
    });
    return new Response('ok (pdf delivered)', { status: 200 });
  }

  // Extract shipping from Stripe's shipping_details (collected on checkout)
  const shipping = (session.shipping_details ?? session.shipping) as
    | { name?: string; address?: Record<string, string> }
    | undefined;
  if (!shipping?.address) {
    return new Response('missing shipping details on session', { status: 400 });
  }

  const addr = {
    name: shipping.name ?? '',
    street1: shipping.address.line1 ?? '',
    street2: shipping.address.line2 ?? '',
    city: shipping.address.city ?? '',
    state_code: shipping.address.state ?? '',
    postcode: shipping.address.postal_code ?? '',
    country_code: shipping.address.country ?? 'US',
    phone_number: (session.customer_details as Record<string, string> | undefined)?.phone ?? '',
    email: (session.customer_details as Record<string, string> | undefined)?.email ?? '',
  };

  // Create an edition_orders row immediately so we have something to
  // show in the admin UI even if Lulu creation fails.
  const { data: order } = await supabase
    .from('edition_orders')
    .insert({
      edition_slug,
      customer_email: addr.email,
      customer_name: addr.name,
      shipping_address: addr,
      status: 'pending',
      stripe_session_id: session.id,
      amount_paid_cents: session.amount_total,
      currency: String(session.currency ?? 'USD').toUpperCase(),
    })
    .select('id')
    .single();

  // If the edition has an interior PDF URL pre-rendered (published
  // cookbooks should; we'll add an admin flow to upload once),
  // create the Lulu print-job. If not, leave the order in "pending"
  // for the admin to handle manually.
  const interior_url = (edition as Record<string, unknown>).interior_pdf_url as
    | string
    | undefined;
  if (!interior_url) {
    return new Response('ok (pending manual print)', { status: 200 });
  }

  const token = await getLuluToken();
  const printJobBody = {
    contact_email: addr.email,
    external_id: order?.id ?? session.id,
    line_items: [
      {
        external_id: `${order?.id ?? session.id}-interior`,
        printable_normalization: {
          cover: {
            source_url: Deno.env.get('LULU_COVER_URL') ?? interior_url,
          },
          interior: {
            source_url: interior_url,
          },
          pod_package_id: LULU_POD_PACKAGE_ID,
        },
        quantity: 1,
        title: edition.title,
      },
    ],
    production_delay: 120,
    shipping_address: mapShipping(addr),
    shipping_level: 'MAIL',
  };

  const res = await fetch(`${LULU_BASE}/print-jobs/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(printJobBody),
  });
  if (!res.ok) {
    const errText = await res.text();
    await supabase
      .from('edition_orders')
      .update({
        status: 'failed',
        lulu_status: `create_failed: ${errText.slice(0, 500)}`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', order?.id);
    return new Response('lulu create failed: ' + errText, { status: 502 });
  }
  const job = await res.json();
  await supabase
    .from('edition_orders')
    .update({
      status: 'ordered',
      lulu_order_id: String(job.id),
      lulu_status: job.status?.name ?? 'CREATED',
      updated_at: new Date().toISOString(),
    })
    .eq('id', order?.id);

  return new Response('ok', { status: 200 });
}

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
