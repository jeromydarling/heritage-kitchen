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
