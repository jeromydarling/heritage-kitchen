// @ts-nocheck
/**
 * Supabase Edge Function: lulu-webhook
 *
 * Lulu pushes print-job status updates to this endpoint.
 *
 * Changes from the previous version (qa-reports/heritage-kitchen.md):
 *   - MEDIUM 15: HMAC-SHA256 signature verification against
 *                LULU_WEBHOOK_SECRET. Fails closed (401) unless
 *                LULU_WEBHOOK_ALLOW_UNSIGNED=true (dev escape hatch).
 *   - HIGH 6:    Idempotency table (lulu_webhook_events) so re-deliveries
 *                are no-ops. Synthesises a stable event id when Lulu
 *                doesn't supply one.
 *   - MEDIUM 16: Now updates BOTH cookbook_projects (user-built) and
 *                edition_orders (editorial). Reconciles by external_id
 *                first (= our row id), then falls back to lulu_order_id.
 *
 * Configure in Lulu's developer dashboard > Webhooks:
 *   Endpoint: https://<project-ref>.functions.supabase.co/lulu-webhook
 *   Events: PRINT_JOB_STATUS_CHANGED
 */
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { verifyLuluSignature } from '../_shared/luluClient.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Lulu status → local status enum. Used to update both projects and orders.
const STATUS_MAP: Record<string, string> = {
  CREATED: 'ordered',
  UNPAID: 'ordered',
  PAYMENT_IN_PROGRESS: 'ordered',
  PRODUCTION_READY: 'in_production',
  PRODUCTION_DELAYED: 'in_production',
  IN_PRODUCTION: 'in_production',
  SHIPPED: 'shipped',
  REJECTED: 'failed',
  CANCELED: 'cancelled',
  ERROR: 'failed',
};

serve(async (req) => {
  if (req.method !== 'POST') return new Response('ok');

  const rawBody = await req.text();
  const sigHeader =
    req.headers.get('Lulu-HMAC-SHA256')
    ?? req.headers.get('lulu-hmac-sha256')
    ?? req.headers.get('X-Lulu-Signature');

  const sigOk = await verifyLuluSignature(rawBody, sigHeader);
  if (!sigOk) {
    return new Response(JSON.stringify({ error: 'invalid signature' }), {
      status: 401, headers: { 'content-type': 'application/json' },
    });
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response('invalid json', { status: 400 });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // Lulu's payload shape varies between v0 and v1; pull from likely paths.
  const jobId = String(
    payload?.data?.id ?? payload?.print_job_id ?? payload?.id ?? '',
  );
  const externalId = String(
    payload?.data?.external_id ?? payload?.external_id ?? '',
  );
  const statusName = String(
    payload?.data?.status?.name ?? payload?.status?.name ?? payload?.status ?? '',
  ).toUpperCase();
  const trackingUrl =
    payload?.data?.tracking_urls?.[0]
    ?? payload?.tracking_urls?.[0]
    ?? payload?.data?.line_items?.[0]?.tracking_urls?.[0]
    ?? null;
  const trackingId =
    payload?.data?.line_items?.[0]?.tracking_id
    ?? payload?.line_items?.[0]?.tracking_id
    ?? null;

  if (!jobId && !externalId) {
    return new Response(JSON.stringify({ error: 'missing job id and external_id' }), {
      status: 400, headers: { 'content-type': 'application/json' },
    });
  }

  // ── Idempotency (HIGH 6) ────────────────────────────────────────────
  const eventId = String(
    payload?.event_id
    ?? payload?.id_event
    ?? `${jobId || externalId}:${statusName}:${trackingId ?? ''}`,
  );

  const { error: insErr } = await supabase
    .from('lulu_webhook_events')
    .insert({ event_id: eventId, lulu_print_job_id: jobId, status: statusName, payload });
  if (insErr && insErr.code === '23505') {
    return new Response(JSON.stringify({ ok: true, duplicate: true }), {
      status: 200, headers: { 'content-type': 'application/json' },
    });
  }
  // Non-23505 errors are logged but non-fatal — don't loop Lulu retries
  // because of an idempotency table issue.
  if (insErr) console.warn('lulu_webhook_events insert failed:', insErr.message);

  const localStatus = STATUS_MAP[statusName];

  // ── Build update payload ────────────────────────────────────────────
  // Different column names between cookbook_projects and edition_orders
  // for tracking — handled in the per-table update calls below.
  const baseUpdate: Record<string, unknown> = {
    lulu_status: statusName,
    updated_at: new Date().toISOString(),
  };
  if (localStatus) baseUpdate.status = localStatus;

  // ── Update cookbook_projects ────────────────────────────────────────
  const projectUpdate = {
    ...baseUpdate,
    ...(trackingUrl ? { lulu_tracking_url: trackingUrl } : {}),
    ...(trackingId ? { tracking_id: trackingId } : {}),
  };
  let updatedRow: any = null;

  if (externalId) {
    const r = await supabase
      .from('cookbook_projects')
      .update(projectUpdate)
      .eq('external_id', externalId)
      .select('id');
    if (r.data?.length) updatedRow = { kind: 'cookbook_project', id: r.data[0].id };
  }
  if (!updatedRow && jobId) {
    const r = await supabase
      .from('cookbook_projects')
      .update(projectUpdate)
      .eq('lulu_order_id', jobId)
      .select('id');
    if (r.data?.length) updatedRow = { kind: 'cookbook_project', id: r.data[0].id };
  }

  // ── Update edition_orders (MEDIUM 16) ───────────────────────────────
  if (!updatedRow) {
    const orderUpdate = {
      ...baseUpdate,
      ...(trackingUrl ? { tracking_url: trackingUrl } : {}),
      ...(trackingId ? { tracking_id: trackingId } : {}),
    };
    if (externalId) {
      const r = await supabase
        .from('edition_orders')
        .update(orderUpdate)
        .eq('external_id', externalId)
        .select('id');
      if (r.data?.length) updatedRow = { kind: 'edition_order', id: r.data[0].id };
    }
    if (!updatedRow && jobId) {
      const r = await supabase
        .from('edition_orders')
        .update(orderUpdate)
        .eq('lulu_order_id', jobId)
        .select('id');
      if (r.data?.length) updatedRow = { kind: 'edition_order', id: r.data[0].id };
    }
  }

  if (!updatedRow) {
    // Event recorded in lulu_webhook_events for forensics, but no matching
    // row found. Don't 500 — Lulu will retry the otherwise-fine webhook.
    return new Response(JSON.stringify({ ok: true, no_match: true, event_id: eventId }), {
      status: 200, headers: { 'content-type': 'application/json' },
    });
  }

  return new Response(
    JSON.stringify({ ok: true, ...updatedRow, status: localStatus ?? statusName }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
});
