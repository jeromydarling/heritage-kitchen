// @ts-nocheck
/**
 * Supabase Edge Function: stripe-webhook
 *
 * Handles `checkout.session.completed` from Stripe. Three branches by
 * metadata.kind:
 *   - 'edition'   → editorial cookbook order (anonymous-friendly)
 *   - 'course'    → course enrollment
 *   - (default)   → user-built cookbook from cookbook_projects
 *
 * Changes from the previous version (qa-reports/heritage-kitchen.md):
 *   - HIGH 6:  Idempotency via stripe_webhook_events.event_id and
 *              lulu_order_id-already-set guards. A re-delivery is now a
 *              no-op instead of a duplicate Lulu print-job. (One Stripe
 *              re-delivery used to mean the customer pays once and the
 *              printer charges Heritage Kitchen twice.)
 *   - HIGH 7:  Uses shared luluClient with cached OAuth.
 *   - HIGH 8:  production_delay: 120 removed. Customers paid; books
 *              should start printing.
 *   - HIGH 9:  Cover-fallback to interior PDF removed. If cover
 *              generation failed and LULU_COVER_URL isn't set, the order
 *              is marked 'failed' instead of silently shipping a book
 *              whose case wrap is the title page.
 *   - HIGH 10: shipping_level read from project.shipping_level (set by
 *              stripe-checkout from the customer's choice), defaults to
 *              LULU_DEFAULT_SHIPPING_LEVEL → 'GROUND_HD'.
 *   - external_id + signed URL pattern matches Vigilia & Schola.
 */
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { POD_PACKAGE_ID, LULU_USER_AGENT, luluFetch } from '../_shared/luluClient.ts';

const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const DEFAULT_SHIPPING_LEVEL = Deno.env.get('LULU_DEFAULT_SHIPPING_LEVEL') ?? 'GROUND_HD';
const LULU_COVER_URL = Deno.env.get('LULU_COVER_URL') ?? '';

serve(async (req) => {
  if (req.method !== 'POST') return new Response('ok');
  const body = await req.text();
  const sig = req.headers.get('stripe-signature') ?? '';

  const verified = await verifyStripeSignature(body, sig, STRIPE_WEBHOOK_SECRET);
  if (!verified) return new Response('invalid signature', { status: 400 });

  const event = JSON.parse(body);
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // ── Idempotency: dedupe by Stripe event id (HIGH 6) ─────────────────
  // Insert first; PG unique violation = already-processed.
  const { error: idemErr } = await supabase
    .from('stripe_webhook_events')
    .insert({ event_id: event.id, type: event.type, payload: event });
  if (idemErr && idemErr.code === '23505') {
    return new Response(JSON.stringify({ ok: true, duplicate: true }), {
      status: 200, headers: { 'content-type': 'application/json' },
    });
  }
  // Non-23505 idempotency errors are logged but non-fatal.
  if (idemErr) console.warn('stripe_webhook_events insert failed:', idemErr.message);

  if (event.type !== 'checkout.session.completed') {
    return new Response('ignored', { status: 200 });
  }

  const session = event.data.object;
  const kind = session.metadata?.kind as string | undefined;
  if (kind === 'edition') return await handleEditionOrder(session, supabase);
  if (kind === 'course') return await handleCourseEnrollment(session, supabase);

  // ── User-built cookbook ─────────────────────────────────────────────
  const project_id = session.metadata?.project_id as string | undefined;
  if (!project_id) return new Response('missing project_id metadata', { status: 400 });

  const { data: project } = await supabase
    .from('cookbook_projects')
    .select('*')
    .eq('id', project_id)
    .single();
  if (!project || !project.pdf_interior_path || !project.shipping_address) {
    return new Response('project not ready', { status: 400 });
  }

  // Idempotency at the row level too (belt & suspenders): if this
  // project already has a Lulu order, return success without re-creating.
  if (project.lulu_order_id) {
    return new Response(JSON.stringify({
      ok: true, already_submitted: true, lulu_order_id: project.lulu_order_id,
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  }

  // ── Cover fallback hard-fail (HIGH 9) ───────────────────────────────
  // If the browser failed to generate a cover, we used to silently use
  // the interior PDF as the cover, which means the case-wrap on the
  // hardcover is whatever the first page of the interior is. That ships
  // a defective book to a paying customer. Now we fail fast unless an
  // explicit LULU_COVER_URL fallback is configured.
  let coverUrl: string | null = null;
  if (project.pdf_cover_path) {
    coverUrl = supabase.storage
      .from('cookbook-pdfs')
      .getPublicUrl(project.pdf_cover_path).data.publicUrl;
  } else if (LULU_COVER_URL) {
    coverUrl = LULU_COVER_URL;
  } else {
    await supabase
      .from('cookbook_projects')
      .update({
        status: 'failed',
        lulu_status: 'create_failed: no cover PDF and no LULU_COVER_URL fallback configured',
        updated_at: new Date().toISOString(),
      })
      .eq('id', project_id);
    return new Response(
      'cover PDF missing and no LULU_COVER_URL fallback — order marked failed',
      { status: 400 },
    );
  }

  const { data: pub } = supabase.storage
    .from('cookbook-pdfs')
    .getPublicUrl(project.pdf_interior_path);
  const interiorUrl = pub.publicUrl;

  const externalId = String(project.external_id ?? project.id);
  const shippingLevel = String(
    project.shipping_level || DEFAULT_SHIPPING_LEVEL,
  );
  const phone = String(project.shipping_address.phone_number ?? '').trim();
  if (!phone || phone.length < 7) {
    await supabase.from('cookbook_projects').update({
      status: 'failed',
      lulu_status: 'create_failed: shipping address missing phone_number',
    }).eq('id', project_id);
    return new Response('phone_number required', { status: 400 });
  }

  const printJobBody = {
    contact_email: project.shipping_address.email,
    external_id: externalId,
    line_items: [
      {
        external_id: `${externalId}-line`,
        printable_normalization: {
          cover: { source_url: coverUrl },
          interior: { source_url: interiorUrl },
          pod_package_id: POD_PACKAGE_ID,
        },
        quantity: 1,
        title: project.title,
      },
    ],
    shipping_address: mapShipping(project.shipping_address),
    shipping_level: shippingLevel,
    // production_delay removed (HIGH 8). Customers want their books shipped.
  };

  const res = await luluFetch('/print-jobs/', {
    method: 'POST',
    headers: { 'User-Agent': LULU_USER_AGENT },
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
      external_id: externalId,
      shipping_level: shippingLevel,
      updated_at: new Date().toISOString(),
    })
    .eq('id', project_id);

  return new Response('ok', { status: 200 });
});

async function handleEditionOrder(session, supabase) {
  const meta = (session.metadata ?? {}) as Record<string, string>;
  const edition_slug = meta.edition_slug;
  const format = (meta.format ?? 'print') as 'print' | 'pdf';
  if (!edition_slug) return new Response('missing edition_slug metadata', { status: 400 });

  // Idempotency at the order level — if a row exists for this stripe
  // session, this is a re-delivery (HIGH 6).
  const { data: existing } = await supabase
    .from('edition_orders')
    .select('id, lulu_order_id, status')
    .eq('stripe_session_id', session.id)
    .maybeSingle();
  if (existing) {
    return new Response(JSON.stringify({
      ok: true, already_processed: true, order_id: existing.id,
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  }

  const { data: edition } = await supabase
    .from('editions').select('*').eq('slug', edition_slug).single();
  if (!edition) return new Response('edition not found', { status: 404 });

  // ── PDF format ──────────────────────────────────────────────────────
  if (format === 'pdf') {
    const customer = (session.customer_details ?? {}) as Record<string, string>;
    if (!edition.pdf_storage_path) {
      return new Response('edition has no pdf_storage_path configured', { status: 500 });
    }
    const expiresIn = 60 * 60 * 24 * 365; // one year
    const { data: signed, error: signErr } = await supabase.storage
      .from('cookbook-pdfs')
      .createSignedUrl(edition.pdf_storage_path, expiresIn);
    if (signErr || !signed) return new Response('failed to sign download url', { status: 500 });
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    const insertedId = crypto.randomUUID();
    await supabase.from('edition_orders').insert({
      id: insertedId,
      external_id: insertedId,
      edition_slug,
      customer_email: (customer.email ?? '').toLowerCase(),
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

  // ── Print format ────────────────────────────────────────────────────
  const shipping = (session.shipping_details ?? session.shipping) ?? {};
  const shippingAddress = shipping.address ?? {};
  if (!shippingAddress.line1) return new Response('missing shipping details on session', { status: 400 });

  const customer = (session.customer_details ?? {}) as Record<string, string>;
  const phone = String(customer.phone ?? '').trim();
  if (!phone || phone.length < 7) {
    return new Response('phone_number required from Stripe', { status: 400 });
  }

  const addr = {
    name: shipping.name ?? customer.name ?? '',
    street1: shippingAddress.line1,
    street2: shippingAddress.line2 ?? '',
    city: shippingAddress.city ?? '',
    state_code: shippingAddress.state ?? '',
    postcode: shippingAddress.postal_code ?? '',
    country_code: shippingAddress.country ?? 'US',
    phone_number: phone,
    email: (customer.email ?? '').toLowerCase(),
  };

  const insertedId = crypto.randomUUID();
  const { data: order, error: orderErr } = await supabase
    .from('edition_orders')
    .insert({
      id: insertedId,
      external_id: insertedId,
      edition_slug,
      customer_email: addr.email,
      customer_name: addr.name,
      shipping_address: addr,
      status: 'pending',
      stripe_session_id: session.id,
      amount_paid_cents: session.amount_total,
      currency: String(session.currency ?? 'USD').toUpperCase(),
    })
    .select('id, external_id')
    .single();
  if (orderErr || !order) return new Response('order insert failed', { status: 500 });

  const interiorUrl = (edition as any).interior_pdf_url;
  if (!interiorUrl) {
    return new Response('ok (pending manual print)', { status: 200 });
  }

  // Cover-fallback hard-fail (HIGH 9)
  let coverUrl: string | null = null;
  if ((edition as any).cover_pdf_url) coverUrl = (edition as any).cover_pdf_url;
  else if (LULU_COVER_URL) coverUrl = LULU_COVER_URL;
  else {
    await supabase.from('edition_orders').update({
      status: 'failed',
      lulu_status: 'create_failed: edition has no cover_pdf_url and no LULU_COVER_URL fallback',
    }).eq('id', order.id);
    return new Response('cover URL missing — order marked failed', { status: 400 });
  }

  const externalId = String(order.external_id);
  const printJobBody = {
    contact_email: addr.email,
    external_id: externalId,
    line_items: [
      {
        external_id: `${externalId}-line`,
        printable_normalization: {
          cover: { source_url: coverUrl },
          interior: { source_url: interiorUrl },
          pod_package_id: POD_PACKAGE_ID,
        },
        quantity: 1,
        title: edition.title,
      },
    ],
    shipping_address: mapShipping(addr),
    shipping_level: DEFAULT_SHIPPING_LEVEL,
  };

  const res = await luluFetch('/print-jobs/', {
    method: 'POST',
    headers: { 'User-Agent': LULU_USER_AGENT },
    body: JSON.stringify(printJobBody),
  });
  if (!res.ok) {
    const errText = await res.text();
    await supabase.from('edition_orders').update({
      status: 'failed',
      lulu_status: `create_failed: ${errText.slice(0, 500)}`,
      updated_at: new Date().toISOString(),
    }).eq('id', order.id);
    return new Response('lulu create failed: ' + errText, { status: 502 });
  }
  const job = await res.json();
  await supabase.from('edition_orders').update({
    status: 'ordered',
    lulu_order_id: String(job.id),
    lulu_status: job.status?.name ?? 'CREATED',
    shipping_level: DEFAULT_SHIPPING_LEVEL,
    updated_at: new Date().toISOString(),
  }).eq('id', order.id);

  return new Response('ok', { status: 200 });
}

async function handleCourseEnrollment(session, supabase) {
  // Course enrollment logic preserved verbatim from the prior version.
  const meta = (session.metadata ?? {}) as Record<string, string>;
  const course_slug = meta.course_slug;
  if (!course_slug) return new Response('missing course_slug metadata', { status: 400 });

  const { data: course } = await supabase
    .from('courses').select('*').eq('slug', course_slug).single();
  if (!course) return new Response('course not found', { status: 404 });

  const customer = (session.customer_details ?? {}) as Record<string, string>;
  const email = (customer.email ?? '').toLowerCase();
  const name = customer.name ?? '';

  let started_on: string | null = null;
  let status: 'active' | 'scheduled' = 'active';
  const today = new Date();
  if (course.start_trigger === 'on_purchase') {
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
    course_slug, email, customer_name: name, started_on,
    last_sent_day: 0, status, stripe_session_id: session.id,
    amount_paid_cents: session.amount_total,
    currency: String(session.currency ?? 'USD').toUpperCase(),
  });

  return new Response('ok (enrolled)', { status: 200 });
}

// Butcher's algorithm — Gregorian Easter; ash wednesday = easter - 46
function easterSunday(year: number): Date {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4;
  const L = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * L) / 451);
  const month = Math.floor((h + L - 7 * m + 114) / 31);
  const day = ((h + L - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}
function nextAshWednesday(after: Date): Date {
  let y = after.getFullYear();
  let cand = new Date(easterSunday(y).getTime() - 46 * 86400_000);
  if (cand <= after) cand = new Date(easterSunday(y + 1).getTime() - 46 * 86400_000);
  return cand;
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

/**
 * Stripe webhook signature verification. Same scheme as before — kept
 * inline to keep stripe-only logic out of the shared luluClient.
 */
async function verifyStripeSignature(payload: string, sigHeader: string, secret: string): Promise<boolean> {
  if (!sigHeader || !secret) return false;
  const parts = Object.fromEntries(
    sigHeader.split(',').map((p) => p.split('=').map((s) => s.trim()) as [string, string]),
  );
  const ts = parts['t'], v1 = parts['v1'];
  if (!ts || !v1) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(`${ts}.${payload}`));
  const hex = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
  if (hex.length !== v1.length) return false;
  let diff = 0;
  for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ v1.charCodeAt(i);
  return diff === 0;
}
