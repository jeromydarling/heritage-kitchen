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
