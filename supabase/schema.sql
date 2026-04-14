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

-- ==========================================================================
-- Lessons ("How to Cook"): technique articles from historical cookbooks
-- ==========================================================================
--
-- A new content type that is neither a recipe nor a short essay. Each
-- lesson is a long-form article drawn from a 1890s-1920s cooking textbook
-- -- yeast biology, oven chemistry, knife work, invalid cookery, meal
-- planning, nutrition. Every lesson carries an explicit "still true" and
-- "outdated" split so readers can trust which parts of the historical
-- knowledge to keep and which to discard.

create table if not exists lessons (
  id text primary key,
  title text not null,
  source_book text,
  source_author text,
  source_year text,
  source_url text,
  topic text,
  original_text text,
  modern_explanation text,
  key_takeaways jsonb default '[]'::jsonb,
  still_true text,
  outdated text,
  related_recipe_tags jsonb default '[]'::jsonb,
  difficulty text check (difficulty is null or difficulty in ('beginner','intermediate','advanced')),
  fun_for_kids boolean default false,
  image_prompt text,
  image_url text,
  published boolean not null default true,
  featured boolean not null default false,
  sort_order integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_lessons_topic on lessons (topic);
create index if not exists idx_lessons_kids on lessons (published, fun_for_kids);
create index if not exists idx_lessons_difficulty on lessons (published, difficulty);

alter table lessons enable row level security;

drop policy if exists "lessons_public_read" on lessons;
create policy "lessons_public_read" on lessons
  for select using (published = true);

drop policy if exists "lessons_admin_write" on lessons;
create policy "lessons_admin_write" on lessons
  for all using (auth.uid() = '<ADMIN_USER_ID>'::uuid)
  with check (auth.uid() = '<ADMIN_USER_ID>'::uuid);

-- ==========================================================================
-- Editions: Heritage Kitchen editorial cookbooks for sale
-- ==========================================================================
--
-- Each edition is a curated book of recipes from the library that Heritage
-- Kitchen publishes and sells. Public-readable; admin-writable via the
-- existing admin user id pattern.

create table if not exists editions (
  slug text primary key,
  title text not null,
  subtitle text,
  description text,
  cover_image_url text,
  intro_text text,
  recipe_ids jsonb not null default '[]'::jsonb,
  price_usd numeric(10,2) not null,
  page_count integer,
  interior_pdf_url text,
  cover_pdf_url text,
  published boolean not null default false,
  featured boolean not null default false,
  sort_order integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table editions add column if not exists interior_pdf_url text;
alter table editions add column if not exists cover_pdf_url text;
-- Almanac year for editions in the annual "Heritage Kitchen Almanac" series.
-- NULL for non-almanac editions.
alter table editions add column if not exists almanac_year integer;

-- Format and digital-only support
alter table editions add column if not exists format text default 'print'
  check (format in ('print','pdf','both'));
alter table editions add column if not exists price_pdf_usd numeric(10,2);
-- The storage path inside the cookbook-pdfs bucket for downloadable PDFs.
alter table editions add column if not exists pdf_storage_path text;

create index if not exists idx_editions_published on editions (published, sort_order);

alter table editions enable row level security;

drop policy if exists "editions_public_read" on editions;
create policy "editions_public_read" on editions
  for select using (published = true);

drop policy if exists "editions_admin_write" on editions;
create policy "editions_admin_write" on editions
  for all using (auth.uid() = '<ADMIN_USER_ID>'::uuid)
  with check (auth.uid() = '<ADMIN_USER_ID>'::uuid);

-- Orders of editions (separate from cookbook_projects so we can track
-- bulk orders of the same edition across customers).
create table if not exists edition_orders (
  id uuid primary key default gen_random_uuid(),
  edition_slug text not null references editions (slug) on delete restrict,
  customer_email text not null,
  customer_name text,
  shipping_address jsonb,
  format text not null default 'print' check (format in ('print','pdf')),
  status text not null default 'pending' check (status in ('pending','ordered','in_production','shipped','delivered','cancelled','failed')),
  lulu_order_id text,
  lulu_status text,
  lulu_tracking_url text,
  pdf_download_url text,
  pdf_download_expires_at timestamptz,
  stripe_session_id text,
  amount_paid_cents integer,
  currency text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Backfill columns for existing databases
alter table edition_orders add column if not exists format text default 'print';
alter table edition_orders add column if not exists pdf_download_url text;
alter table edition_orders add column if not exists pdf_download_expires_at timestamptz;
alter table edition_orders alter column shipping_address drop not null;

create index if not exists idx_edition_orders_email on edition_orders (customer_email);
create index if not exists idx_edition_orders_lulu on edition_orders (lulu_order_id);

alter table edition_orders enable row level security;

-- Customers can read their own orders by email (after sign-in); admin can
-- read/write all.
drop policy if exists "edition_orders_self" on edition_orders;
create policy "edition_orders_self" on edition_orders
  for select using (
    auth.jwt() ->> 'email' = customer_email
    or auth.uid() = '<ADMIN_USER_ID>'::uuid
  );

drop policy if exists "edition_orders_admin_write" on edition_orders;
create policy "edition_orders_admin_write" on edition_orders
  for all using (auth.uid() = '<ADMIN_USER_ID>'::uuid)
  with check (auth.uid() = '<ADMIN_USER_ID>'::uuid);

-- ==========================================================================
-- Seed: one example edition so the /editions page isn't empty on first
-- deploy. Replace the recipe_ids with real slugs from the library once
-- you have ones you actually want to publish.
-- ==========================================================================

insert into editions (slug, title, subtitle, description, intro_text, recipe_ids, price_usd, price_pdf_usd, format, published, featured, sort_order)
values (
  'lenten-table',
  'The Lenten Table',
  'Forty Days of Simple Food',
  'A short, honest cookbook for the forty days of Lent — meatless weekday suppers, Friday fish, and the breads and grains that have carried Christian families through the hungry gap for sixteen hundred years. Every recipe is from an American cookbook published between 1869 and 1917, modernized to work in a present-day kitchen.',
  'Lent, in most modern accounts, is a season of giving something up. In the old farming calendar that the Church inherited and baptized, it was also something else: the weeks when the cellar was empty and the first greens had not yet come up. Fasting was a way to make virtue out of necessity, and to save the new lambs from slaughter at the moment the household most wanted to eat them.\n\nThis little book is a table of simple food to carry you through those forty days. You will not find it showy. You will find it quiet and good.',
  '[]'::jsonb,
  34.00,
  9.00,
  'both',
  false,
  true,
  1
)
on conflict (slug) do nothing;

-- ==========================================================================
-- Service enquiries: custom cookbook, parish cookbook, historical research
-- ==========================================================================
--
-- A simple inbox for the Tier 4 relationship-sale services. The frontend
-- posts into this table via a public insert policy (rate-limited by IP
-- at the edge-function level in a later commit). No reads by default;
-- admin reads by the site owner.

create table if not exists service_enquiries (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('custom_cookbook','parish_cookbook','research','licensing','other')),
  name text not null,
  email text not null,
  subject text,
  message text not null,
  budget_range text,
  status text not null default 'new' check (status in ('new','replied','scheduled','completed','declined')),
  created_at timestamptz default now()
);

create index if not exists idx_service_enquiries_status
  on service_enquiries (status, created_at desc);

-- Backfill the kind check for existing databases that were created with
-- the v1 enum before 'licensing' was added.
alter table service_enquiries drop constraint if exists service_enquiries_kind_check;
alter table service_enquiries add constraint service_enquiries_kind_check
  check (kind in ('custom_cookbook','parish_cookbook','research','licensing','other'));

alter table service_enquiries enable row level security;

-- Anyone can insert a new enquiry (so the contact form works without
-- sign-in), but nobody can read them except the admin.
drop policy if exists "service_enquiries_public_insert" on service_enquiries;
create policy "service_enquiries_public_insert" on service_enquiries
  for insert with check (true);

drop policy if exists "service_enquiries_admin_read" on service_enquiries;
create policy "service_enquiries_admin_read" on service_enquiries
  for select using (auth.uid() = '<ADMIN_USER_ID>'::uuid);

drop policy if exists "service_enquiries_admin_write" on service_enquiries;
create policy "service_enquiries_admin_write" on service_enquiries
  for update using (auth.uid() = '<ADMIN_USER_ID>'::uuid);

-- ==========================================================================
-- Sponsorships: "Friends of Heritage Kitchen" and adopt-a-recipe
-- ==========================================================================
--
-- Annual sponsorships from aligned brands (King Arthur, Anson Mills,
-- Lodge, Diaspora Co., etc.) and small-producer recipe adoptions.
-- Deliberately modeled like museum donor credits, not ad units.

create table if not exists sponsors (
  slug text primary key,
  name text not null,
  tier text not null default 'friend'
    check (tier in ('patron','supporter','friend')),
  url text,
  logo_url text,
  description text,
  since date,
  until date,
  published boolean not null default true,
  sort_order integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_sponsors_published
  on sponsors (published, tier, sort_order);

alter table sponsors enable row level security;

drop policy if exists "sponsors_public_read" on sponsors;
create policy "sponsors_public_read" on sponsors
  for select using (published = true);

drop policy if exists "sponsors_admin_write" on sponsors;
create policy "sponsors_admin_write" on sponsors
  for all using (auth.uid() = '<ADMIN_USER_ID>'::uuid)
  with check (auth.uid() = '<ADMIN_USER_ID>'::uuid);

create table if not exists recipe_adoptions (
  id uuid primary key default gen_random_uuid(),
  recipe_id text not null,
  sponsor_slug text references sponsors (slug) on delete set null,
  credit_text text,
  adopted_from date,
  adopted_until date,
  active boolean not null default true,
  created_at timestamptz default now()
);

create index if not exists idx_recipe_adoptions_recipe
  on recipe_adoptions (recipe_id, active);

alter table recipe_adoptions enable row level security;

drop policy if exists "recipe_adoptions_public_read" on recipe_adoptions;
create policy "recipe_adoptions_public_read" on recipe_adoptions
  for select using (active = true);

drop policy if exists "recipe_adoptions_admin_write" on recipe_adoptions;
create policy "recipe_adoptions_admin_write" on recipe_adoptions
  for all using (auth.uid() = '<ADMIN_USER_ID>'::uuid)
  with check (auth.uid() = '<ADMIN_USER_ID>'::uuid);

-- ==========================================================================
-- Monasteries: a directory of contemplative communities whose food sales
-- support their houses. This is a mission-aligned editorial product, not
-- a store category.
-- ==========================================================================

create table if not exists monasteries (
  slug text primary key,
  name text not null,
  tradition text,            -- e.g. Trappist, Benedictine, Camaldolese, Carmelite
  location text,             -- city, state/country
  founded text,              -- e.g. "1848"
  description text,          -- long-form prose
  products_summary text,     -- e.g. "Fruitcake, fudge, bourbon-aged cheese"
  image_url text,
  website_url text,
  shop_url text,
  ships_internationally boolean,
  -- Partner-status tracking so we can run the directory like a CRM-lite.
  -- 'active' = currently shipping; 'inactive' = community has paused or
  -- closed shop; 'prospect' = on our radar but not yet listed publicly.
  partner_status text not null default 'active'
    check (partner_status in ('prospect','active','inactive','contacted','declined')),
  notes_for_owner text,      -- private to admin; never rendered
  last_verified date,
  source_url text,           -- where the verification came from
  published boolean not null default true,
  featured boolean not null default false,
  sort_order integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Backfill the new tracking columns for existing databases.
alter table monasteries add column if not exists ships_internationally boolean;
alter table monasteries add column if not exists partner_status text not null default 'active';
alter table monasteries add column if not exists notes_for_owner text;
alter table monasteries add column if not exists last_verified date;
alter table monasteries add column if not exists source_url text;

alter table monasteries drop constraint if exists monasteries_partner_status_check;
alter table monasteries add constraint monasteries_partner_status_check
  check (partner_status in ('prospect','active','inactive','contacted','declined'));

create index if not exists idx_monasteries_published
  on monasteries (published, sort_order);

alter table monasteries enable row level security;

drop policy if exists "monasteries_public_read" on monasteries;
create policy "monasteries_public_read" on monasteries
  for select using (published = true);

drop policy if exists "monasteries_admin_write" on monasteries;
create policy "monasteries_admin_write" on monasteries
  for all using (auth.uid() = '<ADMIN_USER_ID>'::uuid)
  with check (auth.uid() = '<ADMIN_USER_ID>'::uuid);

-- Verified roster (research date 2026-04-14). Editorial entries written
-- in the Heritage Kitchen voice; never overwrite an admin's hand-tuned
-- copy on re-run.
insert into monasteries (slug, name, tradition, location, founded, description, products_summary, website_url, shop_url, ships_internationally, partner_status, last_verified, source_url, featured, sort_order)
values
  ('gethsemani',
   'Abbey of Our Lady of Gethsemani',
   'Trappist (OCSO)',
   'Trappist, Kentucky',
   '1848',
   'The oldest Trappist monastery in the United States, and the house where Thomas Merton lived and wrote from 1941 until his death. The monks at Gethsemani pray the liturgy of the hours seven times a day and support themselves in large part by selling bourbon-aged fruitcake, chocolate fudge, and cheese. If you have never had a real Trappist fruitcake, the Gethsemani one is the right place to begin \u2014 dense, bourbon-rich, aged for months, and a direct line back to a kind of monastic baking that has almost vanished outside these walls. They will ship to Canada and overseas for a small surcharge.',
   'Bourbon fruitcake, fudge, Trappist preserves, creamed honey, Nicaraguan coffee',
   'https://www.gethsemanifarms.org',
   'https://www.gethsemanifarms.org',
   true,
   'active',
   '2026-04-14',
   'https://www.gethsemanifarms.org',
   true,
   1),
  ('spencer-abbey',
   'St. Joseph''s Abbey',
   'Trappist (OCSO)',
   'Spencer, Massachusetts',
   '1950',
   'Spencer is the largest Trappist abbey in the United States and the producer of Trappist Preserves \u2014 the jam line you have probably already seen on the shelves of Whole Foods, even if you didn''t know who made it. The monks have been making jams, jellies, conserves, and marmalades since the 1950s, and the operation supports the entire community. Twenty-five varieties at last count. The orange marmalade is famous for a reason.',
   'Jams, jellies, conserves, marmalades (25+ varieties)',
   'https://spencerabbey.org',
   'https://monasterygreetings.com/pages/trappist-preserves',
   null,
   'active',
   '2026-04-14',
   'https://spencerabbey.org/abbey-gift-shop/',
   true,
   2),
  ('genesee-abbey',
   'Abbey of the Genesee',
   'Trappist (OCSO)',
   'Piffard, New York',
   '1951',
   'In 1953, two years after the abbey was founded in the rolling country south of Rochester, the monks needed a way to support themselves and started baking bread. Seventy years later, Monks'' Bread is a regional institution \u2014 sold in groceries throughout the Northeast, made by hand from a simple recipe in a single bakery. The community ships nationwide. They also produce biscotti, cheese crisps, and fruit-and-nut bars.',
   'Monks'' Bread (homestyle loaves), biscotti, cheese crisps, fruit & nut bars',
   'https://monksbread.com',
   'https://monksbread.com',
   null,
   'active',
   '2026-04-14',
   'https://monksbread.com',
   true,
   3),
  ('holy-cross-abbey-virginia',
   'Holy Cross Abbey',
   'Trappist (OCSO)',
   'Berryville, Virginia',
   '1950',
   'A Trappist community on a bend in the Shenandoah River, founded as a daughter of Gethsemani. The monks make a brandy-laced fruitcake and a remarkable creamed honey \u2014 wildflower, clover, orange blossom, eucalyptus, and others \u2014 along with chocolate truffles. The setting is one of the most beautiful in American monasticism and the food matches it.',
   'Brandy fruitcake, creamed honey (8 varieties), monastery truffles',
   'https://www.virginiatrappists.org',
   'https://www.monasteryfruitcake.org',
   null,
   'active',
   '2026-04-14',
   'https://www.virginiatrappists.org/fruitcake/',
   true,
   4),
  ('assumption-abbey',
   'Assumption Abbey',
   'Cistercian (transferred from Trappist in 2019)',
   'Ava, Missouri',
   '1950',
   'A small Cistercian house in the Ozarks, originally founded as a Trappist daughter of New Melleray and transferred to the Common Observance in 2019. Assumption Abbey has been making fruitcake to support itself for over fifty years, refined to its current form (the story goes) with help from Jean-Pierre Aug\u00e9, an old Parisian pastry chef who wandered into the monastery one Advent. The result is a dense, dark-rum-soaked cake that keeps essentially forever and is, in the considered opinion of several food magazines, the best fruitcake in America. About one in twenty orders ships internationally.',
   'Dark rum fruitcake (2 lb tin)',
   'https://www.assumptionabbey.org',
   'https://www.assumptionabbey.org/fruitcakes',
   true,
   'active',
   '2026-04-14',
   'https://www.assumptionabbey.org/fruitcakes',
   true,
   5),
  ('mepkin-abbey',
   'Mepkin Abbey',
   'Trappist (OCSO)',
   'Moncks Corner, South Carolina',
   '1949',
   'Mepkin is a Trappist community on the Cooper River in the South Carolina lowcountry, on land that was once a rice plantation owned by Henry Laurens and later given to the monks by Clare Boothe Luce. Until recently the abbey supported itself with eggs; now the monks grow and ship dried oyster mushrooms in two-ounce bags, along with their own fruitcake (one and two pound tins, the larger usually sold out). A visit to the guesthouse is one of the quietest things you can do in America.',
   'Dried oyster mushrooms, fruitcake',
   'https://mepkinabbey.org',
   'https://mepkinabbey.org/our-work/',
   null,
   'active',
   '2026-04-14',
   'https://mepkinabbey.org/our-work/',
   false,
   6),
  ('mississippi-abbey',
   'Our Lady of the Mississippi Abbey',
   'Trappistine (OCSO)',
   'Dubuque, Iowa',
   '1964',
   'The Trappistine sisters at Mississippi Abbey, founded as a daughter of Wrentham, support themselves by making about seventy thousand pounds of caramel a year. Trappistine Creamy Caramels come in vanilla, chocolate-covered, hazelnut, sea salt, Irish mints, and a few other varieties \u2014 made entirely on site, hand-wrapped, and shipped from a working women''s monastery in the bluffs above the Mississippi River. They are excellent, and the operation is large enough to be reliable.',
   'Trappistine Creamy Caramels (vanilla, chocolate, hazelnut, sea salt, Irish mints, sauce)',
   'https://mississippiabbey.org',
   'https://monasterycandy.com',
   null,
   'active',
   '2026-04-14',
   'https://monasterycandy.com',
   true,
   7),
  ('benedictine-sisters-clyde',
   'Benedictine Sisters of Perpetual Adoration',
   'Benedictine (OSB)',
   'Clyde, Missouri',
   '1874',
   'A community of Benedictine sisters in northwest Missouri who have been making altar bread on site since 2004 \u2014 standard hosts and Vatican-approved low-gluten breads, used by parishes and chaplaincies around the world. They ship to Canada, Europe, Australia, and to military communities worldwide. If you keep an active sacramental practice in your home or have a chaplain in the family, this is the kind of community whose work you should know about.',
   'Altar breads (standard and low-gluten Vatican-approved)',
   'https://benedictinesisters.org',
   'https://altarbreadsbspa.com',
   true,
   'active',
   '2026-04-14',
   'https://altarbreadsbspa.com',
   false,
   8),
  ('conception-abbey',
   'Conception Abbey (Altar + Home)',
   'Benedictine (OSB)',
   'Conception, Missouri',
   '1873',
   'A Benedictine abbey in the Missouri prairie, founded by Swiss monks. The community runs a long-established printing house, recently rebranded from The Printery House to Altar + Home, producing religious greeting cards, devotional items, icon reproductions, candles, and journals. Not food, exactly, but the kind of household goods that go on the same kitchen shelf as your cookbooks.',
   'Devotional cards, icons, candles, journals, liturgical goods',
   'https://www.conceptionabbey.org',
   'https://www.altarandhome.org',
   null,
   'active',
   '2026-04-14',
   'https://www.altarandhome.org',
   false,
   9),
  ('ferdinand-sisters',
   'Sisters of St. Benedict of Ferdinand',
   'Benedictine (OSB)',
   'Ferdinand, Indiana',
   '1867',
   'The Sisters of St. Benedict in southern Indiana \u2014 a large, long-established Benedictine women''s community \u2014 bake springerle and almerle cookies, Hildegard cookies, Prayerful Pretzels, and altar breads at their monastery, called The Dome of the Immaculate Conception. The springerle in particular are a German Christmas tradition that almost no commercial bakery still does properly, and the sisters have been doing it for generations.',
   'Springerle, almerle, Hildegard cookies, Prayerful Pretzels, altar breads',
   'https://thedome.org',
   'https://www.monasterygiftshop.org/shop/Bakery.htm',
   null,
   'active',
   '2026-04-14',
   'https://thedome.org/gift-shop-2025-catalog/',
   false,
   10),
  ('jampot',
   'Holy Protection Monastery (The Jampot)',
   'Byzantine Catholic (Society of St. John)',
   'Eagle Harbor, Michigan',
   '1983',
   'A small Byzantine Catholic monastery on the Keweenaw Peninsula of upper Michigan, where the brothers wild-harvest thimbleberries, golden raspberries, chokecherries, and other northern fruits and turn them into jams that are unlike anything you can buy in a grocery store. They also bake fruitcake, abbey cake, cookies, and chocolates. Shipping is seasonal \u2014 the kitchen pauses each winter \u2014 and the spring re-opening is something a small number of devoted customers wait for every year.',
   'Wild-harvested jams (thimbleberry, golden raspberry, chokecherry), fruitcake, cookies',
   'https://www.societystjohn.com',
   'https://poorrockabbey.com',
   null,
   'active',
   '2026-04-14',
   'https://poorrockabbey.com',
   true,
   11),
  ('holy-cross-monastery-wv',
   'Holy Cross Monastery',
   'Russian Orthodox (ROCOR)',
   'Wayne, West Virginia',
   '1986',
   'A Russian Orthodox monastery in the West Virginia hills that ships under the name Hermitage Finest Baked Goods \u2014 seventeen kinds of cake and bread, including a remarkable Paschal kulich for Easter, six kinds of coffee, West Virginia honey, hand-dipped beeswax candles, Orthodox incense, and handcrafted soap. If your kitchen keeps the Eastern liturgical year as well as the Western one, this is the community to know.',
   'Paschal kulich, monastery breads, coffee, WV honey, beeswax candles, incense',
   'https://www.holycross.org',
   'https://www.holycross.org/collections/food-gifts',
   null,
   'active',
   '2026-04-14',
   'https://www.holycross.org/collections/food-gifts',
   false,
   12),
  ('norbertine-canonesses',
   'Norbertine Canonesses of Bethlehem Priory',
   'Norbertine / Premonstratensian',
   'Tehachapi, California',
   '1997',
   'A small community of Norbertine canonesses in the high desert above Bakersfield who run an artisan cheese operation under the name Mountain Priory Cheese. The cheese is made on site by hand and shipped from fall through spring \u2014 summer is too hot for cold-shipping out of the desert. The Norbertines are an old order, founded in the twelfth century, and the canonesses are one of the only women''s houses still attached to it in North America.',
   'Mountain Priory Cheese (multiple varieties)',
   'https://www.norbertinecanonesses.org',
   'https://cheese.norbertinecanonesses.org',
   null,
   'active',
   '2026-04-14',
   'https://cheese.norbertinecanonesses.org',
   false,
   13),
  ('monastery-pantry',
   'Holy Annunciation Monastery (Monastery Pantry)',
   'Byzantine Discalced Carmelite',
   'Sugarloaf, Pennsylvania',
   '1977',
   'A Byzantine Rite Discalced Carmelite community in the Pennsylvania mountains whose Monastery Pantry ships an unusually broad larder: yogurt, olive-oil bread, banana nut bread, biscotti, fudge in six flavors, jellies, two kinds of honey, coffee, and \u2014 unusually \u2014 a barbecue sauce. The breadth makes it the kind of place you order from once a year and remember the variety more than any single jar.',
   'Yogurt, breads, biscotti, fudge, jellies, honey, coffee, BBQ sauce',
   'https://www.byzantinediscalcedcarmelites.com',
   'https://monasterypantry.com',
   null,
   'active',
   '2026-04-14',
   'https://monasterypantry.com',
   false,
   14),
  ('new-camaldoli-hermitage',
   'New Camaldoli Hermitage',
   'Camaldolese Benedictine',
   'Big Sur, California',
   '1958',
   'The Camaldolese Benedictines are an eleventh-century reform of the Benedictine rule that leans toward hermitic life. Their American house sits on a narrow shelf above the Big Sur coast where the Pacific comes in hard from the west. Until recently the hermits made and shipped Mediterranean-style fruitcake and date nut cake; the kitchen is currently dormant as the community has shrunk and production previously moved off-site. We list them here in the hope that the operation returns \u2014 and meanwhile, the Hermitage itself is one of the most beautiful contemplative places in the country to visit.',
   'Fruitcake (currently not shipping); the Hermitage remains open for retreats',
   'https://www.contemplation.com',
   'https://www.contemplation.com/shop',
   false,
   'inactive',
   '2026-04-14',
   'https://www.contemplation.com/shop',
   false,
   15)
on conflict (slug) do nothing;

-- ==========================================================================
-- Store: curated affiliate / print-on-demand items
-- ==========================================================================
--
-- The Heritage Kitchen store is not a typical e-commerce catalog. It's a
-- hand-curated list of things we think belong in a kitchen like this one,
-- with a paragraph of honest prose for each. Most items link out to the
-- maker (affiliate). A few can later be fulfilled via print-on-demand
-- (Printful or Lulu merch). No cart, no inventory, no ads.

create table if not exists store_items (
  slug text primary key,
  title text not null,
  subtitle text,
  curator_note text,
  maker_name text,
  maker_url text,
  category text not null,
  -- 'affiliate' (link with a commission), 'referral' (link with no
  -- commission, listed for editorial reasons), 'print_on_demand'
  -- (Printful etc., for branded merch), 'etsy' (small-shop vetted)
  kind text not null default 'affiliate'
    check (kind in ('affiliate','referral','print_on_demand','etsy')),
  affiliate_url text,
  affiliate_network text,    -- e.g. "Awin", "Impact", "ShareASale"
  commission_rate text,      -- free-form, e.g. "5%", "10% (new customers)"
  image_url text,
  price_display text,
  partner_status text not null default 'active'
    check (partner_status in ('prospect','active','inactive','contacted','declined')),
  notes_for_owner text,
  last_verified date,
  source_url text,
  published boolean not null default true,
  featured boolean not null default false,
  sort_order integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table store_items add column if not exists affiliate_network text;
alter table store_items add column if not exists commission_rate text;
alter table store_items add column if not exists partner_status text not null default 'active';
alter table store_items add column if not exists notes_for_owner text;
alter table store_items add column if not exists last_verified date;
alter table store_items add column if not exists source_url text;

alter table store_items drop constraint if exists store_items_kind_check;
alter table store_items add constraint store_items_kind_check
  check (kind in ('affiliate','referral','print_on_demand','etsy'));

alter table store_items drop constraint if exists store_items_partner_status_check;
alter table store_items add constraint store_items_partner_status_check
  check (partner_status in ('prospect','active','inactive','contacted','declined'));

create index if not exists idx_store_items_published
  on store_items (published, category, sort_order);

alter table store_items enable row level security;

drop policy if exists "store_items_public_read" on store_items;
create policy "store_items_public_read" on store_items
  for select using (published = true);

drop policy if exists "store_items_admin_write" on store_items;
create policy "store_items_admin_write" on store_items
  for all using (auth.uid() = '<ADMIN_USER_ID>'::uuid)
  with check (auth.uid() = '<ADMIN_USER_ID>'::uuid);

-- Seed a starter store from the verified partner research (2026-04-14).
-- Affiliate URLs are the vendor affiliate landing pages; replace with
-- your tagged links once you sign up for each network. Brands marked
-- 'referral' have no commission program -- we list them out of
-- editorial conviction. Entries marked 'prospect' still need you to
-- apply for the affiliate program; 'active' ones have no application.
insert into store_items (slug, title, subtitle, curator_note, maker_name, maker_url, category, kind, affiliate_url, affiliate_network, commission_rate, price_display, partner_status, last_verified, source_url, featured, sort_order)
values
  ('king-arthur-unbleached-bread-flour',
   'Unbleached Bread Flour',
   'King Arthur Baking Company, Vermont',
   'King Arthur is employee-owned, B-Corp certified, and sells the most consistent bread flour you can buy in an American grocery store. It is the flour our 1890s recipes quietly assume you have on hand — enough protein to build a real crumb, unbleached so it does not fight the yeast. Their affiliate program runs on Awin.',
   'King Arthur Baking',
   'https://www.kingarthurbaking.com',
   'flour-and-grain',
   'affiliate',
   'https://shop.kingarthurbaking.com/affiliate-program',
   'Awin',
   '5% new customers, 2% loyalty',
   '$7 / 5 lb',
   'prospect',
   '2026-04-14',
   'https://shop.kingarthurbaking.com/affiliate-program',
   true,
   1),
  ('lodge-10-inch-cast-iron-skillet',
   'Lodge 10-inch Cast Iron Skillet',
   'Made in South Pittsburg, Tennessee',
   'Lodge has been pouring iron in the same Tennessee foundry since 1896 — the same year Fannie Farmer published The Boston Cooking-School Cook Book. The 10-inch is the workhorse: big enough for cornbread or a whole chicken, small enough to lift with one hand. One of these will outlast you and go to your grandchildren. Lodge does not run a traditional affiliate program (their creator partnerships are project-based via Cohley), so we list them as a referral. We point at them out of editorial conviction, not for revenue.',
   'Lodge Cast Iron',
   'https://www.lodgecastiron.com',
   'cookware',
   'referral',
   'https://www.lodgecastiron.com',
   null,
   null,
   '$25',
   'active',
   '2026-04-14',
   'https://www.lodgecastiron.com/pages/affiliations',
   true,
   2),
  ('smithey-no-10-skillet',
   'No. 10 Cast Iron Skillet',
   'Smithey Ironware, Charleston, SC',
   'Smithey makes hand-finished cast iron in Charleston, machined to a glassy interior smoothness that mid-century pans had and modern Lodge skillets do not. They cost more than a Lodge and they earn it. Smithey runs an affiliate program through Impact and the brand fit could not be cleaner.',
   'Smithey Ironware',
   'https://smithey.com',
   'cookware',
   'affiliate',
   'https://smithey.com',
   'Impact',
   '10%',
   '$200',
   'prospect',
   '2026-04-14',
   'https://linkclicky.com/affiliate-program/smithey-ironware/',
   false,
   3),
  ('field-no-8-skillet',
   'No. 8 Cast Iron Skillet',
   'Field Company, Brooklyn',
   'Field makes a lighter, smoother cast iron pan modeled on the Wagner and Griswold skillets of the 1890s and 1900s. They run a creator collab program through ShareASale and Awin and have an active affiliate channel.',
   'Field Company',
   'https://fieldcompany.com',
   'cookware',
   'affiliate',
   'https://fieldcompany.com/pages/collab',
   'ShareASale / Awin',
   null,
   '$165',
   'prospect',
   '2026-04-14',
   'https://fieldcompany.com/pages/collab',
   false,
   4),
  ('le-creuset-dutch-oven',
   'Round Dutch Oven',
   'Le Creuset, France',
   'The enameled cast iron pot that almost every modern braising recipe in the library quietly assumes — a piece of cookware that genuinely deserves its reputation. Le Creuset runs an affiliate program through Pepperjam (Ascend) at up to ten percent commission with a thirty-day cookie.',
   'Le Creuset',
   'https://www.lecreuset.com',
   'cookware',
   'affiliate',
   'https://www.lecreuset.com/affiliates.html',
   'Pepperjam',
   'up to 10%',
   '$420',
   'prospect',
   '2026-04-14',
   'https://www.lecreuset.com/affiliates.html',
   false,
   5),
  ('mauviel-copper-saucepan',
   'M200 Ci Copper Saucepan',
   'Mauviel, Normandy',
   'A French copper pot from the same Normandy workshop that has been forging them since 1830. Heavier than you expect, conducts heat better than anything else you will ever cook with, and built to be passed down across three generations. Affiliate program runs through ShareASale and Awin.',
   'Mauviel USA',
   'https://mauviel-usa.com',
   'cookware',
   'affiliate',
   'https://mauviel-usa.com/pages/collabs',
   'ShareASale / Awin',
   '5%',
   '$300',
   'prospect',
   '2026-04-14',
   'https://mauviel-usa.com/pages/collabs',
   false,
   6),
  ('anson-mills-antebellum-fine-yellow-cornmeal',
   'Antebellum Fine Yellow Cornmeal',
   'Anson Mills, Columbia, SC',
   'Glenn Roberts at Anson Mills revived a handful of nearly extinct Southern corn varieties and built a mill around them. The Antebellum Fine Yellow is what the 1890s cookbooks in our library meant when they said "corn meal" — sweet, grassy, alive in a way supermarket meal is not. Use it in any spoon bread, johnnycake, or muffin recipe and the difference is embarrassing. Anson Mills does not run an affiliate program; we list them as a referral because we think you should buy from them anyway.',
   'Anson Mills',
   'https://ansonmills.com',
   'flour-and-grain',
   'referral',
   'https://ansonmills.com',
   null,
   null,
   '$7 / lb',
   'active',
   '2026-04-14',
   'https://ansonmills.com',
   true,
   7),
  ('diaspora-co-aranya-cinnamon',
   'Aranya Cinnamon',
   'Diaspora Co., Indian spices',
   'Diaspora Co. pays Indian spice farmers six times the commodity rate and ships spices within months of harvest instead of years. The Aranya is wild-harvested Sri Lankan true cinnamon — the kind where you can actually smell the difference. A jar lasts a long time and changes every baked thing it touches. Their affiliate program runs through Impact at ten percent.',
   'Diaspora Co.',
   'https://www.diasporaco.com',
   'spices',
   'affiliate',
   'https://www.diasporaco.com/products/aranya-cinnamon',
   'Impact',
   '10%',
   '$14',
   'prospect',
   '2026-04-14',
   'https://avidaffiliate.com/programs/diasporaco-com/',
   true,
   8),
  ('bookshop-heritage-kitchen-list',
   'The Heritage Kitchen Reading List',
   'On Bookshop.org, not Amazon',
   'A growing shelf of the books we return to: cookbook histories, food theology, farming almanacs, and a handful of modern cookbooks whose authors clearly did their homework. Bookshop.org splits revenue with independent bookstores instead of feeding Amazon, and runs its affiliate program in-house at ten percent. The cookie window is short — a 48-hour session — but the brand alignment is total.',
   'Bookshop.org',
   'https://bookshop.org',
   'books',
   'affiliate',
   'https://bookshop.org/affiliates/profile/introduction',
   'in-house',
   '10% (48h session)',
   'Various',
   'prospect',
   '2026-04-14',
   'https://bookshop.org/affiliates/profile/introduction',
   false,
   9),
  ('filson-tin-cloth-apron',
   'Tin Cloth Cooking Apron',
   'Filson, Seattle',
   'Filson has been making heritage workwear in Seattle since 1897 — within a year of Lodge starting to pour iron in Tennessee. The tin cloth apron is the kind of thing that softens with use and outlasts five lighter ones, and Filson runs an affiliate program through AvantLink at seven percent.',
   'Filson',
   'https://www.filson.com',
   'apparel',
   'affiliate',
   'https://www.avantlink.com/programs/18045/filson-affiliate-program/',
   'AvantLink',
   '7%',
   '$95',
   'prospect',
   '2026-04-14',
   'https://www.avantlink.com/programs/18045/filson-affiliate-program/',
   false,
   10),
  ('gethsemani-farms-kentucky-bourbon-fruitcake',
   'Kentucky Bourbon Fruitcake',
   'Abbey of Our Lady of Gethsemani',
   'The Trappist monks at Gethsemani in Kentucky have been making fruitcake and fudge since the 1950s to support the abbey — Thomas Merton''s house, the oldest Trappist monastery in the United States. The cake is aged in bourbon, dense and dark, and tastes like Christmas actually does. Buying one underwrites a real contemplative community. See our full directory at /monasteries.',
   'Gethsemani Farms',
   'https://www.gethsemanifarms.org',
   'monastery',
   'referral',
   'https://www.gethsemanifarms.org',
   null,
   null,
   '$28',
   'active',
   '2026-04-14',
   'https://www.gethsemanifarms.org',
   true,
   11),
  ('mississippi-abbey-trappistine-caramels',
   'Trappistine Creamy Caramels',
   'Our Lady of the Mississippi Abbey, Iowa',
   'The Trappistine sisters at Mississippi Abbey hand-wrap about seventy thousand pounds of caramel a year to support their community. Vanilla, chocolate-covered, hazelnut, sea salt, Irish mints, and a few others. The chocolate-covered hazelnut alone is worth the order. See our full directory at /monasteries.',
   'Trappistine Caramels',
   'https://monasterycandy.com',
   'monastery',
   'referral',
   'https://monasterycandy.com',
   null,
   null,
   '$10 / box',
   'active',
   '2026-04-14',
   'https://monasterycandy.com',
   false,
   12),
  ('lancaster-cast-iron-wooden-spoons',
   'Hand-Carved Wooden Cooking Spoons',
   'LancasterCastIron on Etsy — Brandon Moore, Pennsylvania',
   'Brandon Moore is an Amish-country woodworker in Lancaster County who carves spoons, spatulas, butter paddles, and spurtles from local cherry, maple, and walnut. Six years on Etsy, eleven thousand sales, a five-star average across nearly three thousand reviews. The same hardwoods our 1880s recipes quietly assumed you owned, made by hand a couple of counties over from where they were originally written down.',
   'Brandon Moore',
   'https://www.etsy.com/shop/LancasterCastIron',
   'kitchen-tools',
   'etsy',
   'https://www.etsy.com/shop/LancasterCastIron',
   null,
   null,
   '$15 – $40',
   'active',
   '2026-04-14',
   'https://www.etsy.com/shop/LancasterCastIron',
   true,
   13),
  ('katabatic-pottery-fermentation-crock',
   'Hand-Thrown Stoneware Fermentation Crock',
   'KatabaticPottery on Etsy — Andy Forbes, Idaho',
   'Andy Forbes throws stoneware fermentation crocks, sourdough starter jars, and bread crocks on the wheel in Idaho — wheel-thrown and high-fired in the same tradition as the salt-glazed crocks every preserves chapter in our library assumes you have on a kitchen shelf. Etsy Star Seller, four years open, almost seven hundred sales at a perfect five-star rating.',
   'Andy Forbes',
   'https://www.etsy.com/shop/KatabaticPottery',
   'preserving',
   'etsy',
   'https://www.etsy.com/shop/KatabaticPottery',
   null,
   null,
   '$60 – $200',
   'active',
   '2026-04-14',
   'https://www.etsy.com/shop/KatabaticPottery',
   true,
   14),
  ('moms-san-fran-sourdough',
   'Heritage San Francisco Sourdough Starter',
   'MomsSanFranSourdough on Etsy — Patricia and Nick',
   'A living sourdough starter with documented family provenance back to 1850 — Patricia, now ninety-three, bought it decades ago from a San Francisco baker who traced it to a gold-rush bakery, and her family has kept it alive ever since. The flagship listing has nearly eight thousand five-star reviews. If you want one heirloom in your kitchen with a real story, this is it.',
   'Patricia and Nick',
   'https://www.etsy.com/shop/MomsSanFranSourdough',
   'starters',
   'etsy',
   'https://www.etsy.com/listing/745699350/authentic-san-francisco-sourdough',
   null,
   null,
   '$15',
   'active',
   '2026-04-14',
   'https://www.etsy.com/shop/MomsSanFranSourdough',
   true,
   15),
  ('craigs-classics-antique-cookbooks',
   'Antique American Cookbooks (1860s–1930s)',
   'CraigsClassics on Etsy — Craig, New Hampshire',
   'Craig in New Hampshire keeps a curated antiquarian bookshop on Etsy with a dedicated Food and Drink section of about fifty original American cookbooks from the same era our library was modernized from. If you would like to own a first edition of one of the books we work from, this is the most reliable place to look.',
   'CraigNH',
   'https://www.etsy.com/shop/CraigsClassics',
   'books',
   'etsy',
   'https://www.etsy.com/shop/CraigsClassics',
   null,
   null,
   '$15 – $200',
   'active',
   '2026-04-14',
   'https://www.etsy.com/shop/CraigsClassics',
   false,
   16),
  ('myseedcellar-heirloom-seeds',
   'Heirloom Garden Seed Kit',
   'MySeedcellar on Etsy — Chris Harrison, Delaware',
   'Chris Harrison runs one of the longest-established heirloom-seed shops on Etsy — thirteen years, eighteen thousand sales, focused entirely on the open-pollinated, non-hybrid varieties that 1890s kitchen gardens were planted from. A good place to start a kitchen garden that the recipes in this library will recognize.',
   'Chris Harrison',
   'https://www.etsy.com/shop/MySeedcellar',
   'kitchen-garden',
   'etsy',
   'https://www.etsy.com/shop/MySeedcellar',
   null,
   null,
   '$8 – $30',
   'active',
   '2026-04-14',
   'https://www.etsy.com/shop/MySeedcellar',
   false,
   17),
  ('sun-wizard-leather-recipe-journal',
   'Hand-Tooled Leather Recipe Journal',
   'SunWizardCreations on Etsy — Errol G. Specter, California',
   'Errol Specter has been making leather goods by hand since 1966 and ships from California. Each of his journals is hand-tooled and signed — a natural place to write down what you cooked and when, in the same way the women who wrote our source books did before there were Notion templates.',
   'Errol G. Specter',
   'https://www.etsy.com/shop/SunWizardCreations',
   'kitchen-tools',
   'etsy',
   'https://www.etsy.com/shop/SunWizardCreations',
   null,
   null,
   '$45 – $150',
   'active',
   '2026-04-14',
   'https://www.etsy.com/shop/SunWizardCreations',
   false,
   18),
  ('wonder-linen-tea-towels',
   'Stonewashed Natural Linen Tea Towels',
   'WonderLinen on Etsy — Lithuania',
   'A small linen workshop in Lithuania (free shipping to the US, seven to fourteen days) that makes plain, undyed, OEKO-TEX-certified European flax kitchen linens — aprons and tea towels in the natural earth tones that the working kitchens of 1880s America actually used. The least romantic option on this page and the most useful one.',
   'WonderLinen',
   'https://www.etsy.com/shop/WonderLinen',
   'apparel',
   'etsy',
   'https://www.etsy.com/shop/WonderLinen',
   null,
   null,
   '$12 – $40',
   'active',
   '2026-04-14',
   'https://www.etsy.com/shop/WonderLinen',
   false,
   19),
  ('mexican-talavera-pottery',
   'Hand-Painted Talavera Mixing Bowls',
   'MexicanTalaveraArt on Etsy — sourced in Puebla',
   'Hand-painted, lead-free Talavera pottery from artisan partners in Puebla and Guanajuato — mugs, plates, bowls, and cazuelas in the centuries-old tradition. Five-star average over four hundred reviews and eight years on Etsy.',
   'MexicanTalaveraArt',
   'https://www.etsy.com/shop/MexicanTalaveraArt',
   'cookware',
   'etsy',
   'https://www.etsy.com/shop/MexicanTalaveraArt',
   null,
   null,
   '$25 – $120',
   'active',
   '2026-04-14',
   'https://www.etsy.com/shop/MexicanTalaveraArt',
   false,
   20)
on conflict (slug) do nothing;

-- ==========================================================================
-- Email courses: one-time-purchase, multi-day email delivered product
-- ==========================================================================

create table if not exists courses (
  slug text primary key,
  title text not null,
  subtitle text,
  description text,
  intro_text text,
  cover_image_url text,
  price_usd numeric(10,2) not null,
  total_days integer not null check (total_days > 0),
  start_trigger text not null default 'on_purchase'
    check (start_trigger in ('on_purchase','fixed_date','ash_wednesday','first_sunday_advent')),
  start_date date,
  published boolean not null default false,
  featured boolean not null default false,
  sort_order integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_courses_published on courses (published, sort_order);

alter table courses enable row level security;

drop policy if exists "courses_public_read" on courses;
create policy "courses_public_read" on courses
  for select using (published = true);

drop policy if exists "courses_admin_write" on courses;
create policy "courses_admin_write" on courses
  for all using (auth.uid() = '<ADMIN_USER_ID>'::uuid)
  with check (auth.uid() = '<ADMIN_USER_ID>'::uuid);

-- The individual day-by-day lessons. Authored in markdown, rendered to
-- HTML by the mailer edge function at send time.
create table if not exists course_lessons (
  course_slug text not null references courses (slug) on delete cascade,
  day_number integer not null check (day_number > 0),
  title text not null,
  body_markdown text not null,
  recipe_id text,
  primary key (course_slug, day_number)
);

alter table course_lessons enable row level security;

drop policy if exists "course_lessons_read_if_enrolled" on course_lessons;
create policy "course_lessons_read_if_enrolled" on course_lessons
  for select using (
    exists (
      select 1 from course_enrollments ce
      where ce.course_slug = course_lessons.course_slug
        and (ce.user_id = auth.uid() or ce.email = (auth.jwt() ->> 'email'))
    )
    or auth.uid() = '<ADMIN_USER_ID>'::uuid
  );

drop policy if exists "course_lessons_admin_write" on course_lessons;
create policy "course_lessons_admin_write" on course_lessons
  for all using (auth.uid() = '<ADMIN_USER_ID>'::uuid)
  with check (auth.uid() = '<ADMIN_USER_ID>'::uuid);

-- Enrollments: one row per (customer, course) pair. The mailer walks
-- active enrollments every day and sends the next lesson.
create table if not exists course_enrollments (
  id uuid primary key default gen_random_uuid(),
  course_slug text not null references courses (slug) on delete restrict,
  user_id uuid references auth.users (id) on delete set null,
  email text not null,
  customer_name text,
  started_on date,
  last_sent_day integer not null default 0,
  status text not null default 'active'
    check (status in ('active','scheduled','completed','cancelled','failed')),
  stripe_session_id text,
  amount_paid_cents integer,
  currency text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_course_enrollments_active
  on course_enrollments (status, started_on);
create index if not exists idx_course_enrollments_email
  on course_enrollments (email);

alter table course_enrollments enable row level security;

drop policy if exists "course_enrollments_self_read" on course_enrollments;
create policy "course_enrollments_self_read" on course_enrollments
  for select using (
    auth.uid() = user_id
    or (auth.jwt() ->> 'email') = email
    or auth.uid() = '<ADMIN_USER_ID>'::uuid
  );

drop policy if exists "course_enrollments_admin_write" on course_enrollments;
create policy "course_enrollments_admin_write" on course_enrollments
  for all using (auth.uid() = '<ADMIN_USER_ID>'::uuid)
  with check (auth.uid() = '<ADMIN_USER_ID>'::uuid);

-- Seed: the Lenten course. Lessons are placeholders waiting for
-- the author; published stays false until the body is written.
insert into courses (slug, title, subtitle, description, intro_text, price_usd, total_days, start_trigger, published, featured, sort_order)
values (
  'lenten-table-course',
  'The Lenten Table',
  'Forty days in the kitchen, one email a day',
  'A forty-day email course that walks you through Lent in the kitchen, one day at a time. Each morning you''ll get a recipe, a short reflection on the day, a historical note from one of our cookbooks, and a gentle prompt for tonight''s supper. Purchase once; the course begins on Ash Wednesday and ends at Easter. No subscription.',
  'Lent is a long season to cook through without help. This course exists so that you don''t have to plan it every year. Forty mornings, forty emails, forty small meals that were good enough to carry someone through the hungry gap a hundred and thirty years ago. That is an uncommonly good inheritance to eat from.',
  39.00,
  40,
  'ash_wednesday',
  false,
  false,
  1
)
on conflict (slug) do nothing;

insert into editions (slug, title, subtitle, description, intro_text, recipe_ids, price_usd, price_pdf_usd, format, almanac_year, published, featured, sort_order)
values (
  'almanac-2026',
  'The Heritage Kitchen Almanac, 2026',
  'A year in the kitchen, by the old calendar',
  'The first of what we hope will be an annual tradition. A printed almanac laid out month by month with the full liturgical year, recipes for every feast and season, historical notes on the foods we grew up on, and a running cooking journal from readers who sent us what they made. Printed in time for Advent.',
  'There used to be a paper almanac on every kitchen shelf in America. Ours is an attempt to bring that habit back, with a liturgical year instead of a farming one (or really, the same year seen from two sides). Each issue is its own complete thing: you can start with any year, you don''t have to buy the next one, and the whole series will eventually live on a shelf next to the salt.',
  '[]'::jsonb,
  48.00,
  14.00,
  'both',
  2026,
  false,
  true,
  0
)
on conflict (slug) do nothing;

insert into editions (slug, title, subtitle, description, intro_text, recipe_ids, price_usd, price_pdf_usd, format, published, featured, sort_order)
values (
  'advent-pantry',
  'The Advent Pantry',
  'Four weeks of waiting, quietly',
  'A digital-only guide to the four weeks of Advent in the kitchen: simple suppers for the waiting, make-ahead cookies and breads for the feast that is coming, and a small liturgical calendar of what to start when. Instant PDF download.',
  'Christmas cooking, done properly, starts four weeks early. The fruitcake soaks, the cookies wait in tins, the bread dough proves slowly in a cold pantry. The old word for this is Advent, which simply means arriving — the feast is on its way, and these weeks are how we make room for it.',
  '[]'::jsonb,
  0.00,
  9.00,
  'pdf',
  false,
  true,
  2
)
on conflict (slug) do nothing;
