-- ════════════════════════════════════════════════════════════════════
-- 20260427220000_print_pipeline_fixes — Heritage Kitchen print pipeline
-- ════════════════════════════════════════════════════════════════════
--
-- Closes BLOCKERs 3 & 5 and HIGHs 6 & 14 from qa-reports/heritage-kitchen.md.
-- Schema-side companion to the edge-function changes in this commit:
--
--   BLOCKER 3 — cookbook-pdfs bucket has zero storage.objects RLS, so any
--               signed-in user can overwrite any other user's PDF and the
--               admin-owned editions PDFs.
--   BLOCKER 5 — '<ADMIN_USER_ID>'::uuid placeholder is referenced 28 times.
--               Without substitution, every admin policy fails to cast at
--               runtime and admin writes silently 0-row.
--   HIGH 6    — webhooks have no idempotency. Stripe re-deliveries cause
--               double Lulu submissions / customer re-charge at the printer.
--   HIGH 14   — `editions_public_read` exposes `interior_pdf_url` and
--               `pdf_storage_path`, letting anonymous users grab PDFs that
--               paying customers downloaded.
--
-- Idempotent: every change uses IF NOT EXISTS / DROP IF EXISTS so this can
-- be applied repeatedly. Safe on top of the existing supabase/schema.sql.

-- ─── 1. Admin identity ──────────────────────────────────────────────
-- Replaces the 28 hard-coded '<ADMIN_USER_ID>'::uuid references with a
-- proper admin_users table. The is_admin(uuid) helper is what RLS
-- policies call. Keeping it as a function (not inlining the subquery)
-- so future role changes (e.g. multi-admin, org-scoped admins) only
-- touch one definition.
create table if not exists public.admin_users (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  email      text,
  notes      text,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

-- Admin list is service-role-only — never expose membership to clients
drop policy if exists "admin_users_service_only" on public.admin_users;
create policy "admin_users_service_only" on public.admin_users
  for all using (false) with check (false);

create or replace function public.is_admin(uid uuid default auth.uid())
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from public.admin_users where user_id = uid);
$$;

grant execute on function public.is_admin(uuid) to authenticated, anon;

-- Rewrite every admin policy that referenced the placeholder. Names are
-- preserved so dropping by name is sufficient.
do $$
declare
  -- (table_name, policy_name) pairs touched by the placeholder
  -- Discovered via: grep -n "<ADMIN_USER_ID>" supabase/schema.sql
  rec record;
begin
  for rec in
    select * from (values
      ('recipes',          'Admin write'),
      ('lessons',          'lessons_admin_write'),
      ('editions',         'editions_admin_write'),
      ('edition_orders',   'edition_orders_admin_write'),
      ('service_enquiries','service_enquiries_admin_read'),
      ('service_enquiries','service_enquiries_admin_write'),
      ('sponsors',         'sponsors_admin_write'),
      ('recipe_adoptions', 'recipe_adoptions_admin_write')
    ) as t(table_name, policy_name)
  loop
    execute format('drop policy if exists %I on public.%I', rec.policy_name, rec.table_name);
  end loop;
end $$;

create policy "Admin write" on public.recipes
  for all using (public.is_admin()) with check (public.is_admin());

create policy "lessons_admin_write" on public.lessons
  for all using (public.is_admin()) with check (public.is_admin());

create policy "editions_admin_write" on public.editions
  for all using (public.is_admin()) with check (public.is_admin());

create policy "edition_orders_admin_write" on public.edition_orders
  for all using (public.is_admin()) with check (public.is_admin());

-- service_enquiries had a separate admin_read policy; preserve the split
create policy "service_enquiries_admin_read" on public.service_enquiries
  for select using (public.is_admin());

create policy "service_enquiries_admin_write" on public.service_enquiries
  for update using (public.is_admin());

create policy "sponsors_admin_write" on public.sponsors
  for all using (public.is_admin()) with check (public.is_admin());

create policy "recipe_adoptions_admin_write" on public.recipe_adoptions
  for all using (public.is_admin()) with check (public.is_admin());

-- ─── 2. edition_orders self-read (BLOCKER 4 helper) ─────────────────
-- Anonymous PDF buyers (no auth.uid, no JWT email) can't read their
-- own row under the email-match policy. The edge function we add
-- (edition-order-by-session) does the actual exposure with a Stripe-
-- session lookup; here we widen the policy so authed buyers + admins
-- still see their orders, and we move the case-insensitive email
-- comparison into the policy itself (HIGH 18).
drop policy if exists "edition_orders_self" on public.edition_orders;
create policy "edition_orders_self" on public.edition_orders
  for select using (
    public.is_admin()
    or (auth.jwt() ->> 'email') is not null
       and lower(auth.jwt() ->> 'email') = lower(customer_email)
  );

-- ─── 3. editions public read — drop sensitive columns (HIGH 14, 20) ─
-- The simplest fix is column-level grants. We grant the public role
-- access only to the safe columns; the policy (published=true) is
-- preserved. The edge function paths (which use service_role) still
-- see everything.
revoke select on public.editions from anon;
revoke select on public.editions from authenticated;
grant select (
  id, slug, title, subtitle, description, cover_image_url,
  price_print_cents, price_pdf_cents, currency,
  formats, published, published_at, created_at, updated_at
) on public.editions to anon, authenticated;
-- (interior_pdf_url and pdf_storage_path intentionally NOT granted)

-- ─── 4. cookbook-pdfs storage RLS (BLOCKER 3) ───────────────────────
-- The bucket is public-read by URL (Supabase semantics: rows with
-- bucket.public=true serve via /object/public/... without auth check),
-- but listing and writes still need RLS. Without these, any signed-in
-- user can overwrite another user's PDF or the admin's editions PDFs.
--
-- Folder convention:
--   {auth.uid()}/...    user-built cookbooks (write by self only)
--   editions/...        admin-owned editorial PDFs (write by admin only)
--
-- INSERT and UPDATE both checked because uploadInteriorPdf uses upsert.
drop policy if exists "cookbook_pdfs_user_read"   on storage.objects;
drop policy if exists "cookbook_pdfs_user_insert" on storage.objects;
drop policy if exists "cookbook_pdfs_user_update" on storage.objects;
drop policy if exists "cookbook_pdfs_user_delete" on storage.objects;
drop policy if exists "cookbook_pdfs_admin_all"   on storage.objects;

-- Authenticated users can read their own folder and admins read all.
-- (Public reads still work because the bucket is public=true.)
create policy "cookbook_pdfs_user_read" on storage.objects
  for select using (
    bucket_id = 'cookbook-pdfs' and (
      public.is_admin()
      or (auth.role() = 'authenticated'
          and (storage.foldername(name))[1] = auth.uid()::text)
    )
  );

create policy "cookbook_pdfs_user_insert" on storage.objects
  for insert with check (
    bucket_id = 'cookbook-pdfs' and (
      public.is_admin()
      or (auth.role() = 'authenticated'
          and (storage.foldername(name))[1] = auth.uid()::text)
    )
  );

create policy "cookbook_pdfs_user_update" on storage.objects
  for update using (
    bucket_id = 'cookbook-pdfs' and (
      public.is_admin()
      or (auth.role() = 'authenticated'
          and (storage.foldername(name))[1] = auth.uid()::text)
    )
  ) with check (
    bucket_id = 'cookbook-pdfs' and (
      public.is_admin()
      or (auth.role() = 'authenticated'
          and (storage.foldername(name))[1] = auth.uid()::text)
    )
  );

create policy "cookbook_pdfs_user_delete" on storage.objects
  for delete using (
    bucket_id = 'cookbook-pdfs' and (
      public.is_admin()
      or (auth.role() = 'authenticated'
          and (storage.foldername(name))[1] = auth.uid()::text)
    )
  );

-- ─── 5. Webhook idempotency tables (HIGH 6, 15) ─────────────────────
-- Stripe and Lulu both deliver at-least-once. We dedupe by their event
-- ids. Service-role-only — no client should ever read these.
create table if not exists public.stripe_webhook_events (
  event_id    text primary key,
  type        text not null,
  payload     jsonb,
  received_at timestamptz not null default now()
);
alter table public.stripe_webhook_events enable row level security;
drop policy if exists "stripe_events_service_only" on public.stripe_webhook_events;
create policy "stripe_events_service_only" on public.stripe_webhook_events
  for all using (false) with check (false);

create table if not exists public.lulu_webhook_events (
  event_id          text primary key,
  lulu_print_job_id text,
  status            text,
  payload           jsonb,
  received_at       timestamptz not null default now()
);
alter table public.lulu_webhook_events enable row level security;
drop policy if exists "lulu_events_service_only" on public.lulu_webhook_events;
create policy "lulu_events_service_only" on public.lulu_webhook_events
  for all using (false) with check (false);

-- ─── 6. cookbook_projects + edition_orders pipeline columns ────────
-- external_id lets us identify orders independently of Lulu's id, and
-- minimum_recipes_check is enforced by the edge function but we record
-- a soft min in metadata for analytics later.
alter table public.cookbook_projects
  add column if not exists external_id   text,
  add column if not exists shipping_level text,
  add column if not exists tracking_id   text;

alter table public.edition_orders
  add column if not exists external_id   text,
  add column if not exists shipping_level text,
  add column if not exists tracking_id   text,
  add column if not exists tracking_url  text;

-- Backfill external_id = id::text so existing rows can match webhooks
update public.cookbook_projects set external_id = id::text where external_id is null;
update public.edition_orders     set external_id = id::text where external_id is null;

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'cookbook_projects_external_id_key'
  ) then
    alter table public.cookbook_projects add constraint cookbook_projects_external_id_key unique (external_id);
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'edition_orders_external_id_key'
  ) then
    alter table public.edition_orders add constraint edition_orders_external_id_key unique (external_id);
  end if;
end $$;

-- ────────────────────────────────────────────────────────────────────
-- Operational note for the deployer:
--
-- After running this migration, INSERT the production admin's auth uid:
--    insert into public.admin_users (user_id, email, notes)
--    values ('<the-admin-uuid>', 'admin@heritagekitchen.app', 'Founding admin')
--    on conflict do nothing;
--
-- Until that row exists, no one can write to recipes/lessons/editions/
-- edition_orders/sponsors/etc. via the admin policies. (Service-role
-- writes from edge functions still bypass RLS.)
-- ────────────────────────────────────────────────────────────────────
