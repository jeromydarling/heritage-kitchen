-- Heritage Kitchen database schema
-- Run this in the Supabase SQL editor before seeding recipes.

create table if not exists recipes (
  id text primary key,
  title text not null,
  source_book text not null,
  source_author text not null,
  source_year text not null,
  source_url text not null,
  category text not null,
  original_recipe text not null,
  modern_recipe jsonb not null,
  history_note text,
  tags text[] default '{}',
  difficulty text not null check (difficulty in ('easy', 'moderate', 'involved')),
  image_prompt text not null,
  image_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_recipes_category on recipes (category);
create index if not exists idx_recipes_source_book on recipes (source_book);
create index if not exists idx_recipes_difficulty on recipes (difficulty);
create index if not exists idx_recipes_tags on recipes using gin (tags);

-- Full-text search column + index
alter table recipes
  add column if not exists fts tsvector
  generated always as (
    setweight(to_tsvector('english', title), 'A') ||
    setweight(to_tsvector('english', coalesce(history_note, '')), 'B') ||
    setweight(to_tsvector('english', original_recipe), 'C')
  ) stored;

create index if not exists idx_recipes_fts on recipes using gin (fts);

-- Row-level security: world-readable, admin-writable.
-- Replace <ADMIN_USER_ID> with the uuid of the admin auth.users row.
alter table recipes enable row level security;

drop policy if exists "Public read" on recipes;
create policy "Public read" on recipes
  for select using (true);

drop policy if exists "Admin write" on recipes;
create policy "Admin write" on recipes
  for all using (auth.uid() = '<ADMIN_USER_ID>'::uuid)
  with check (auth.uid() = '<ADMIN_USER_ID>'::uuid);

-- Storage bucket for AI-generated illustrations.
insert into storage.buckets (id, name, public)
values ('recipe-images', 'recipe-images', true)
on conflict (id) do nothing;

-- Storage bucket for user-generated cookbook PDFs. Public-read so Lulu can
-- fetch them by URL; path pattern: {user_id}/{project_id}-interior.pdf.
-- Write access is restricted by storage policies (below).
insert into storage.buckets (id, name, public)
values ('cookbook-pdfs', 'cookbook-pdfs', true)
on conflict (id) do nothing;

-- ==========================================================================
-- User data: cookbook, notes, cook log
-- ==========================================================================

-- Lightweight profile row per auth user. Populated lazily on first write.
create table if not exists profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz default now()
);

-- A saved-recipe entry in a user's cookbook. Notes live here for v1 because
-- they are always 1:1 with a saved recipe; we can break them out later if
-- we want per-recipe notes without saving.
create table if not exists cookbook_entries (
  user_id uuid not null references auth.users (id) on delete cascade,
  recipe_id text not null,
  saved_at timestamptz default now(),
  notes text,
  primary key (user_id, recipe_id)
);

create index if not exists idx_cookbook_user_saved
  on cookbook_entries (user_id, saved_at desc);

-- A journal of every time a user has cooked a recipe. The liturgical_day
-- string is snapshotted at cook time so a future "last Good Friday" callout
-- still knows what the day was, even if the current year falls on a different
-- date.
create table if not exists cook_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  recipe_id text not null,
  cooked_on date not null default current_date,
  rating smallint check (rating is null or (rating >= 1 and rating <= 5)),
  notes text,
  liturgical_day text,
  liturgical_season text,
  created_at timestamptz default now()
);

create index if not exists idx_cook_log_user_date
  on cook_log (user_id, cooked_on desc);
create index if not exists idx_cook_log_user_recipe
  on cook_log (user_id, recipe_id);

-- Row-level security: strict self-only.
alter table profiles enable row level security;
alter table cookbook_entries enable row level security;
alter table cook_log enable row level security;

drop policy if exists "profile_self" on profiles;
create policy "profile_self" on profiles
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "cookbook_self" on cookbook_entries;
create policy "cookbook_self" on cookbook_entries
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "cooklog_self" on cook_log;
create policy "cooklog_self" on cook_log
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ==========================================================================
-- Households: shared meal plans and shopping lists
-- ==========================================================================

create table if not exists households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique,
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz default now()
);

create table if not exists household_members (
  household_id uuid not null references households (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('owner','member')),
  joined_at timestamptz default now(),
  primary key (household_id, user_id)
);

create index if not exists idx_household_members_user
  on household_members (user_id);

alter table households enable row level security;
alter table household_members enable row level security;

-- Members of a household can read the household row; anyone can read a
-- household by exact invite_code match (so the join-by-code flow works
-- without first having membership).
drop policy if exists "household_read" on households;
create policy "household_read" on households
  for select using (
    exists (
      select 1 from household_members hm
      where hm.household_id = households.id and hm.user_id = auth.uid()
    )
  );

drop policy if exists "household_write_owner" on households;
create policy "household_write_owner" on households
  for all using (
    exists (
      select 1 from household_members hm
      where hm.household_id = households.id
        and hm.user_id = auth.uid()
        and hm.role = 'owner'
    )
  ) with check (
    auth.uid() = created_by
  );

-- Membership is readable to any member of the same household, writable only
-- by the member themselves (to insert their own row on join or leave).
drop policy if exists "household_members_read" on household_members;
create policy "household_members_read" on household_members
  for select using (
    exists (
      select 1 from household_members m2
      where m2.household_id = household_members.household_id
        and m2.user_id = auth.uid()
    )
  );

drop policy if exists "household_members_write_self" on household_members;
create policy "household_members_write_self" on household_members
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ==========================================================================
-- Meal plan
-- ==========================================================================

create table if not exists meal_plan_entries (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  planned_on date not null,
  meal_type text not null default 'dinner' check (meal_type in ('breakfast','lunch','dinner','snack','feast')),
  recipe_id text not null,
  notes text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz default now()
);

create index if not exists idx_meal_plan_household_date
  on meal_plan_entries (household_id, planned_on);

alter table meal_plan_entries enable row level security;

drop policy if exists "meal_plan_household" on meal_plan_entries;
create policy "meal_plan_household" on meal_plan_entries
  for all using (
    exists (
      select 1 from household_members hm
      where hm.household_id = meal_plan_entries.household_id
        and hm.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from household_members hm
      where hm.household_id = meal_plan_entries.household_id
        and hm.user_id = auth.uid()
    )
  );

-- ==========================================================================
-- Shopping list
-- ==========================================================================

create table if not exists shopping_list_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  text text not null,
  quantity text,
  checked boolean not null default false,
  source_recipe_id text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz default now()
);

create index if not exists idx_shopping_household
  on shopping_list_items (household_id, checked, created_at desc);

alter table shopping_list_items enable row level security;

drop policy if exists "shopping_household" on shopping_list_items;
create policy "shopping_household" on shopping_list_items
  for all using (
    exists (
      select 1 from household_members hm
      where hm.household_id = shopping_list_items.household_id
        and hm.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from household_members hm
      where hm.household_id = shopping_list_items.household_id
        and hm.user_id = auth.uid()
    )
  );

-- ==========================================================================
-- User preferences (e.g. weekly digest email opt-in)
-- ==========================================================================

alter table profiles
  add column if not exists weekly_digest_enabled boolean default false;
alter table profiles
  add column if not exists last_digest_sent_at timestamptz;
alter table profiles
  add column if not exists email text;

-- ==========================================================================
-- Cookbook builder (printable / Lulu-ready)
-- ==========================================================================

create table if not exists cookbook_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  subtitle text,
  dedication text,
  recipe_ids jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft','ready','ordered','in_production','shipped','delivered','cancelled','failed')),
  -- Lulu Print API linkage for direct ordering
  lulu_order_id text,
  lulu_status text,
  lulu_total_cost numeric(10,2),
  lulu_currency text,
  lulu_tracking_url text,
  pdf_interior_path text,
  pdf_cover_path text,
  shipping_address jsonb,
  page_count integer,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Add columns idempotently for existing databases.
alter table cookbook_projects add column if not exists lulu_order_id text;
alter table cookbook_projects add column if not exists lulu_status text;
alter table cookbook_projects add column if not exists lulu_total_cost numeric(10,2);
alter table cookbook_projects add column if not exists lulu_currency text;
alter table cookbook_projects add column if not exists lulu_tracking_url text;
alter table cookbook_projects add column if not exists pdf_interior_path text;
alter table cookbook_projects add column if not exists pdf_cover_path text;
alter table cookbook_projects add column if not exists shipping_address jsonb;
alter table cookbook_projects add column if not exists page_count integer;

create index if not exists idx_cookbook_projects_user
  on cookbook_projects (user_id, created_at desc);

alter table cookbook_projects enable row level security;

drop policy if exists "cookbook_projects_self" on cookbook_projects;
create policy "cookbook_projects_self" on cookbook_projects
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
