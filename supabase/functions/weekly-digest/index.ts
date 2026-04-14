// @ts-nocheck
/**
 * Supabase Edge Function: weekly-digest
 *
 * Designed to be invoked by a Supabase cron job once a week (typically
 * Sunday evening local time). For every user who has
 * `weekly_digest_enabled = true` in their profile, it:
 *
 *   1. Computes the week ahead (7 days from tomorrow).
 *   2. Identifies the major liturgical feasts coming up.
 *   3. Picks a handful of suggested recipes from the library that match
 *      the week's liturgical mood.
 *   4. Pulls the user's "last year around this time" cook log entries
 *      for the annual-memory section.
 *   5. Sends an email via an external provider (Resend, Postmark, etc.)
 *
 * This file is an intentionally incomplete skeleton: the HTTP calls to
 * fetch recipes and the email-provider integration are stubbed out so
 * the function deploys and returns a structured preview of what WOULD
 * be sent. Flip the TODO switches once you pick a provider.
 *
 * Schedule with Supabase cron:
 *   select cron.schedule(
 *     'heritage-kitchen-weekly-digest',
 *     '0 22 * * 0',  -- Sundays at 22:00 UTC
 *     $$ select net.http_post(
 *          url := 'https://<project-ref>.functions.supabase.co/weekly-digest',
 *          headers := '{"Authorization":"Bearer <service-role-key>"}'::jsonb
 *        ) $$
 *   );
 */
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
// TODO: set this when you pick an email provider (e.g. Resend).
const EMAIL_API_KEY = Deno.env.get('EMAIL_API_KEY');
const FROM_ADDRESS = Deno.env.get('FROM_ADDRESS') ?? 'digest@heritagekitchen.app';

serve(async (_req) => {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // Pull all opted-in users
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('user_id, email, weekly_digest_enabled, last_digest_sent_at')
    .eq('weekly_digest_enabled', true);
  if (error) return json({ error: error.message }, 500);

  const now = new Date();
  const weekStart = addDays(now, 1);
  const weekEnd = addDays(now, 7);

  let sent = 0;
  let previews: unknown[] = [];

  for (const p of profiles ?? []) {
    // User's recipes cooked around this time last year
    const oneYearAgo = addDays(now, -365);
    const startIso = addDays(oneYearAgo, -7).toISOString().slice(0, 10);
    const endIso = addDays(oneYearAgo, 7).toISOString().slice(0, 10);
    const { data: annivs } = await supabase
      .from('cook_log')
      .select('recipe_id, cooked_on, liturgical_day')
      .eq('user_id', p.user_id)
      .gte('cooked_on', startIso)
      .lte('cooked_on', endIso)
      .order('cooked_on');

    const subject = `This week in the kitchen â€” ${fmt(weekStart)} to ${fmt(weekEnd)}`;
    const body = renderDigestHtml({
      weekStart,
      weekEnd,
      anniversaries: annivs ?? [],
    });

    if (EMAIL_API_KEY && p.email) {
      await sendEmail({
        to: p.email,
        from: FROM_ADDRESS,
        subject,
        html: body,
      });
      sent++;
      await supabase
        .from('profiles')
        .update({ last_digest_sent_at: new Date().toISOString() })
        .eq('user_id', p.user_id);
    } else {
      // Dry-run preview when provider is not configured
      previews.push({ user: p.user_id, subject, anniversaries: annivs });
    }
  }

  return json({ ok: true, sent, dry_run: !EMAIL_API_KEY, previews });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function fmt(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function renderDigestHtml(opts: {
  weekStart: Date;
  weekEnd: Date;
  anniversaries: Array<{ recipe_id: string; cooked_on: string; liturgical_day: string | null }>;
}): string {
  const { weekStart, weekEnd, anniversaries } = opts;
  return `
    <div style="font-family: Georgia, serif; max-width: 560px; margin: 0 auto; color: #3B2314;">
      <p style="font-size: 12px; letter-spacing: 2px; text-transform: uppercase; color: #A84B2F;">Heritage Kitchen</p>
      <h1 style="font-size: 28px; margin: 8px 0 0 0;">The week ahead</h1>
      <p style="font-size: 14px; color: #7A6B5D;">${fmt(weekStart)} &ndash; ${fmt(weekEnd)}</p>
      ${
        anniversaries.length > 0
          ? `<div style="margin-top: 32px; padding: 16px; background: #FAF6F0; border-left: 3px solid #A84B2F;">
               <p style="font-size: 13px; color: #7A6B5D; margin: 0;">One year ago this week</p>
               <ul style="padding-left: 20px;">
                 ${anniversaries
                   .map(
                     (a) =>
                       `<li>You cooked <strong>${a.recipe_id}</strong>${
                         a.liturgical_day ? ` on ${a.liturgical_day}` : ''
                       }.</li>`,
                   )
                   .join('')}
               </ul>
             </div>`
          : ''
      }
      <p style="margin-top: 32px; font-style: italic;">Ever ancient, ever new.</p>
    </div>
  `;
}

async function sendEmail(_opts: {
  to: string;
  from: string;
  subject: string;
  html: string;
}) {
  // TODO: wire a real provider. Example for Resend:
  //
  // await fetch('https://api.resend.com/emails', {
  //   method: 'POST',
  //   headers: {
  //     'Authorization': `Bearer ${EMAIL_API_KEY}`,
  //     'Content-Type': 'application/json',
  //   },
  //   body: JSON.stringify({
  //     from: _opts.from,
  //     to: _opts.to,
  //     subject: _opts.subject,
  //     html: _opts.html,
  //   }),
  // });
}
