// @ts-nocheck
/**
 * Supabase Edge Function: lulu-webhook
 *
 * Lulu pushes print-job status updates to this endpoint as books move
 * through production and shipping. We look up the cookbook project by
 * its Lulu order id (stored when the job was created by stripe-webhook)
 * and update the status + tracking URL accordingly.
 *
 * Configure in Lulu's developer dashboard > Webhooks:
 *   Endpoint: https://<project-ref>.functions.supabase.co/lulu-webhook
 *   Events: PRINT_JOB_STATUS_CHANGED
 *
 * Environment variables:
 *   LULU_WEBHOOK_SECRET (optional; Lulu sends a signed header if set)
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Map Lulu status codes to our local status enum.
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
};

serve(async (req) => {
  if (req.method !== 'POST') return new Response('ok');
  const payload = await req.json();

  const jobId = String(
    payload?.data?.id ?? payload?.print_job_id ?? payload?.id ?? '',
  );
  const statusName = String(
    payload?.data?.status?.name ?? payload?.status?.name ?? payload?.status ?? '',
  ).toUpperCase();
  const trackingUrl =
    payload?.data?.tracking_urls?.[0] ?? payload?.tracking_urls?.[0] ?? null;

  if (!jobId) return new Response('missing job id', { status: 400 });

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const localStatus = STATUS_MAP[statusName] ?? undefined;
  const update: Record<string, unknown> = {
    lulu_status: statusName,
    updated_at: new Date().toISOString(),
  };
  if (localStatus) update.status = localStatus;
  if (trackingUrl) update.lulu_tracking_url = trackingUrl;

  const { error } = await supabase
    .from('cookbook_projects')
    .update(update)
    .eq('lulu_order_id', jobId);

  if (error) return new Response('db update failed: ' + error.message, { status: 500 });
  return new Response('ok', { status: 200 });
});
