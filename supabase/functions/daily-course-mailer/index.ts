// @ts-nocheck
/**
 * Supabase Edge Function: daily-course-mailer
 *
 * Walks every active course enrollment once per day and sends the next
 * lesson to the customer by email.
 *
 * For each enrollment:
 *   - Figure out which course day we're on: today - started_on + 1
 *   - If that day is greater than last_sent_day and not past total_days,
 *     look up the lesson, render it, send it, update last_sent_day.
 *   - If day >= total_days after sending, mark the enrollment completed.
 *
 * Schedule with Supabase cron:
 *   select cron.schedule(
 *     'heritage-kitchen-daily-course',
 *     '0 12 * * *',  -- daily at 12:00 UTC
 *     $$ select net.http_post(
 *          url := 'https://<project-ref>.functions.supabase.co/daily-course-mailer',
 *          headers := '{"Authorization":"Bearer <service-role-key>"}'::jsonb
 *        ) $$
 *   );
 *
 * Email delivery is stubbed out; fill in sendEmail() with your chosen
 * provider (Resend, Postmark, SendGrid). Until it's wired the function
 * runs as a dry-run and returns a structured preview of what would ship.
 */
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const EMAIL_API_KEY = Deno.env.get('EMAIL_API_KEY');
const FROM_ADDRESS = Deno.env.get('FROM_ADDRESS') ?? 'courses@heritagekitchen.app';

serve(async (_req) => {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // Start by promoting any 'scheduled' enrollments whose start date has arrived.
  const todayIso = new Date().toISOString().slice(0, 10);
  await supabase
    .from('course_enrollments')
    .update({ status: 'active' })
    .eq('status', 'scheduled')
    .lte('started_on', todayIso);

  // Load active enrollments with their course metadata
  const { data: enrollments, error } = await supabase
    .from('course_enrollments')
    .select('id, course_slug, email, started_on, last_sent_day, courses(title, total_days)')
    .eq('status', 'active');
  if (error) return json({ error: error.message }, 500);

  let sent = 0;
  let completed = 0;
  const previews: unknown[] = [];
  const today = new Date();

  for (const en of enrollments ?? []) {
    if (!en.started_on) continue;
    const started = new Date(en.started_on + 'T00:00:00');
    const dayNumber = Math.floor(
      (today.getTime() - started.getTime()) / 86400_000,
    ) + 1;
    const courseRef = (en as Record<string, any>).courses;
    const totalDays = courseRef?.total_days ?? 0;
    if (dayNumber < 1 || dayNumber > totalDays) continue;
    if (dayNumber <= en.last_sent_day) continue;

    // Look up the lesson for today's day number
    const { data: lesson } = await supabase
      .from('course_lessons')
      .select('title, body_markdown')
      .eq('course_slug', en.course_slug)
      .eq('day_number', dayNumber)
      .maybeSingle();
    if (!lesson) {
      previews.push({
        enrollment: en.id,
        skipped: 'no lesson for day ' + dayNumber,
      });
      continue;
    }

    const subject = `Day ${dayNumber} of ${totalDays}: ${lesson.title}`;
    const html = renderLessonHtml({
      courseTitle: courseRef?.title ?? en.course_slug,
      day: dayNumber,
      totalDays,
      lessonTitle: lesson.title,
      bodyMarkdown: lesson.body_markdown,
    });

    if (EMAIL_API_KEY) {
      await sendEmail({ to: en.email, from: FROM_ADDRESS, subject, html });
      sent++;
    } else {
      previews.push({ enrollment: en.id, to: en.email, subject });
    }

    // Advance the pointer so we don't double-send on a retry
    const newLastSent = dayNumber;
    const newStatus = dayNumber >= totalDays ? 'completed' : 'active';
    if (newStatus === 'completed') completed++;
    await supabase
      .from('course_enrollments')
      .update({
        last_sent_day: newLastSent,
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', en.id);
  }

  return json({ ok: true, sent, completed, dry_run: !EMAIL_API_KEY, previews });
});

function renderLessonHtml(opts: {
  courseTitle: string;
  day: number;
  totalDays: number;
  lessonTitle: string;
  bodyMarkdown: string;
}): string {
  // Minimal markdown -> HTML: paragraphs split on blank lines,
  // and leading "# " lines promoted to <h2>. Good enough for v1.
  const paragraphs = opts.bodyMarkdown
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      if (p.startsWith('# ')) return `<h2 style="font-family:Georgia,serif;">${escape(p.slice(2))}</h2>`;
      return `<p style="font-family:Georgia,serif;line-height:1.6;">${escape(p)}</p>`;
    })
    .join('');

  return `
    <div style="max-width:560px;margin:0 auto;color:#3B2314;">
      <p style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#A84B2F;">
        ${escape(opts.courseTitle)} Â· Day ${opts.day} of ${opts.totalDays}
      </p>
      <h1 style="font-family:Georgia,serif;font-size:26px;margin:6px 0 16px 0;">
        ${escape(opts.lessonTitle)}
      </h1>
      ${paragraphs}
      <p style="margin-top:32px;font-style:italic;font-family:Georgia,serif;color:#7A6B5D;">
        Ever ancient, ever new.
      </p>
    </div>
  `;
}

function escape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
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

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
