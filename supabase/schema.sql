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
  'A short, honest cookbook for the forty days of Lent â€” meatless weekday suppers, Friday fish, and the breads and grains that have carried Christian families through the hungry gap for sixteen hundred years. Every recipe is from an American cookbook published between 1869 and 1917, modernized to work in a present-day kitchen.',
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
  kind text not null check (kind in ('custom_cookbook','parish_cookbook','research','other')),
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
  published boolean not null default true,
  featured boolean not null default false,
  sort_order integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

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

insert into monasteries (slug, name, tradition, location, founded, description, products_summary, website_url, shop_url, featured, sort_order)
values
  ('gethsemani',
   'Abbey of Our Lady of Gethsemani',
   'Trappist (OCSO)',
   'Trappist, Kentucky',
   '1848',
   'The oldest Trappist monastery in the United States, and the house where Thomas Merton lived and wrote from 1941 until his death. The monks at Gethsemani pray the liturgy of the hours seven times a day and support themselves in large part by selling bourbon-aged fruitcake, fudge, and cheese. If you have never had a real Trappist fruitcake, the Gethsemani one is a good place to begin \u2014 dense, bourbon-rich, aged four months, and a direct line back to a kind of monastic baking that has almost vanished outside these walls.',
   'Fruitcake, fudge, Trappist cheese',
   'https://www.monks.org',
   'https://www.gethsemanifarms.org',
   true,
   1),
  ('new-camaldoli-hermitage',
   'New Camaldoli Hermitage',
   'Camaldolese Benedictine',
   'Big Sur, California',
   '1958',
   'The Camaldolese Benedictines are an 11th-century reform of the Benedictine rule that leans toward hermitic life \u2014 more silence, more solitude, more of the day alone with God. Their American house sits on a narrow shelf above the Big Sur coast where the Pacific comes in hard from the west. The hermits make and sell small batches of Mediterranean-style fruitcake and date nut cake, along with seasonal jams. The quantities are small and sell out every year; orders for the Christmas fruitcake open around All Saints.',
   'Fruitcake, date nut cake, jam',
   'https://www.contemplation.com',
   'https://www.contemplation.com/store',
   true,
   2),
  ('mepkin-abbey',
   'Mepkin Abbey',
   'Trappist (OCSO)',
   'Moncks Corner, South Carolina',
   '1949',
   'Mepkin is a Trappist community on the Cooper River in South Carolina, on land that was once a rice plantation owned by Henry Laurens and later gifted to the monks by Claire Booth Luce. Until recently Mepkin supported itself by egg production; now the monks grow and sell oyster mushrooms, along with a small selection of books and devotional goods. A visit to their guesthouse is a quiet thing. The mushrooms are excellent and arrive by mail in a matter of days.',
   'Oyster mushrooms, books',
   'https://mepkinabbey.org',
   'https://mepkinabbey.org/store',
   false,
   3),
  ('assumption-abbey',
   'Assumption Abbey',
   'Trappist (OCSO)',
   'Ava, Missouri',
   '1950',
   'A small Trappist house in the Ozarks, founded as a daughter of Gethsemani. Assumption Abbey has been making fruitcake to support itself for over fifty years \u2014 it is said to have been refined to its current form with help from Jean-Pierre Auge, an old Parisian pastry chef who wandered into the monastery one Advent. The result is a dense, brandy-soaked cake that keeps essentially forever and is, in the considered opinion of several food magazines, the best fruitcake in America.',
   'Fruitcake',
   'https://assumptionabbey.org',
   'https://assumptionabbey.org/fruitcake',
   false,
   4),
  ('christ-in-the-desert',
   'Monastery of Christ in the Desert',
   'Benedictine',
   'Abiquiu, New Mexico',
   '1964',
   'A Benedictine community in a remote canyon in northern New Mexico, accessible only by a thirteen-mile dirt road. The monks are famous for their liturgy, which is sung in a hybrid of Latin and English according to the old Gregorian tones, and for their small brewery, Monastery Abbey Ales, which produces Trappist-style beers under license \u2014 revenue that goes back into supporting the house. They also sell incense and icons. A profound place to visit if you can.',
   'Abbey Ales, incense, icons',
   'https://christdesert.org',
   'https://abbeybeverage.com',
   false,
   5)
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
  kind text not null default 'affiliate'
    check (kind in ('affiliate','print_on_demand')),
  affiliate_url text,
  image_url text,
  price_display text,
  published boolean not null default true,
  featured boolean not null default false,
  sort_order integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

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

-- Seed a starter list so the /store page has real content on day one.
-- Replace the URLs with your actual affiliate links once they're in hand.
insert into store_items (slug, title, subtitle, curator_note, maker_name, maker_url, category, affiliate_url, price_display, featured, sort_order)
values
  ('anson-mills-antebellum-fine-yellow-cornmeal',
   'Antebellum Fine Yellow Cornmeal',
   'Anson Mills, South Carolina',
   'Glenn Roberts at Anson Mills revived a handful of nearly-extinct Southern corn varieties and built a mill around them. The Antebellum Fine Yellow is what the 1890s cookbooks in our library meant when they said "corn meal" â€” sweet, grassy, alive in a way supermarket meal isn''t. Use it in any spoon bread, johnnycake, or muffin recipe and the difference is embarrassing.',
   'Anson Mills',
   'https://ansonmills.com',
   'flour-and-grain',
   'https://ansonmills.com',
   '$7 / lb',
   true,
   1),
  ('lodge-10-inch-cast-iron-skillet',
   'Lodge 10-inch Cast Iron Skillet',
   'Made in South Pittsburg, Tennessee',
   'Lodge has been pouring iron in the same Tennessee foundry since 1896 â€” which is, incidentally, the same year Fannie Farmer published The Boston Cooking-School Cook Book. The 10-inch is the workhorse: big enough for cornbread or a whole chicken, small enough to lift with one hand. One of these will outlast you and go to your grandchildren.',
   'Lodge Cast Iron',
   'https://www.lodgecastiron.com',
   'cookware',
   'https://www.lodgecastiron.com',
   '$25',
   true,
   2),
  ('king-arthur-unbleached-bread-flour',
   'Unbleached Bread Flour',
   'King Arthur Baking Company',
   'King Arthur is employee-owned, B-Corp certified, and sells the most consistent bread flour you can buy in an American grocery store. It''s the flour our 1890s recipes quietly assume you have â€” enough protein to build a real crumb, unbleached so it doesn''t fight the yeast.',
   'King Arthur Baking',
   'https://www.kingarthurbaking.com',
   'flour-and-grain',
   'https://www.kingarthurbaking.com/shop/items/king-arthur-unbleached-bread-flour-5-lb',
   '$7 / 5 lb',
   false,
   3),
  ('gethsemani-farms-kentucky-bourbon-fruitcake',
   'Kentucky Bourbon Fruitcake',
   'Abbey of Our Lady of Gethsemani',
   'The Trappist monks at Gethsemani in Kentucky (Thomas Merton''s monastery) have been making fruitcake and fudge since the 1950s to support the abbey. The fruitcake is aged with bourbon and candied fruit; it keeps forever; it tastes like Christmas actually does. Buying one underwrites a real contemplative community.',
   'Gethsemani Farms',
   'https://www.gethsemanifarms.org',
   'monastery',
   'https://www.gethsemanifarms.org',
   '$28',
   true,
   4),
  ('ball-quart-mason-jars-dozen',
   'Wide-Mouth Quart Mason Jars',
   'Twelve, for preserving',
   'Every preserves and pickles recipe in our library wants jars. These are the classic Ball wide-mouth quarts â€” the ones that fit a ladle without a funnel, that seal cleanly, that you can buy anywhere. Order a dozen in July, use them all by October. Keep the rings; replace the lids.',
   'Ball Corporation',
   'https://www.freshpreserving.com',
   'preserving',
   'https://www.freshpreserving.com',
   '$16 / dozen',
   false,
   5),
  ('diaspora-co-aranya-cinnamon',
   'Aranya Cinnamon',
   'Diaspora Co., India',
   'Diaspora Co. pays Indian spice farmers six times the commodity rate and ships spices within months of harvest instead of years. The Aranya is wild-harvested Sri Lankan true cinnamon â€” the kind where you can actually smell the difference. A jar lasts a long time and changes every baked thing it touches.',
   'Diaspora Co.',
   'https://www.diasporaco.com',
   'spices',
   'https://www.diasporaco.com/products/aranya-cinnamon',
   '$14',
   false,
   6),
  ('new-camaldoli-hermitage-fruitcake',
   'Holiday Fruitcake',
   'New Camaldoli Hermitage, Big Sur',
   'The Camaldolese hermits on the Big Sur coast make a small quantity of dense, date-and-brandy-heavy fruitcake each winter. Different character from Gethsemani''s â€” Mediterranean instead of Appalachian â€” and it sells out every year. Orders open around All Saints.',
   'New Camaldoli Hermitage',
   'https://www.contemplation.com',
   'monastery',
   'https://www.contemplation.com/store',
   '$35',
   false,
   7),
  ('bookshop-heritage-kitchen-list',
   'The Heritage Kitchen Reading List',
   'On Bookshop.org, not Amazon',
   'A growing shelf of the books we return to: cookbook histories, food theology, farming almanacs, and a handful of modern cookbooks whose authors clearly did their homework. Bookshop.org splits revenue with independent bookstores instead of feeding Amazon.',
   'Bookshop.org',
   'https://bookshop.org',
   'books',
   'https://bookshop.org',
   'Various',
   false,
   8)
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

insert into editions (slug, title, subtitle, description, intro_text, recipe_ids, price_usd, price_pdf_usd, format, published, featured, sort_order)
values (
  'advent-pantry',
  'The Advent Pantry',
  'Four weeks of waiting, quietly',
  'A digital-only guide to the four weeks of Advent in the kitchen: simple suppers for the waiting, make-ahead cookies and breads for the feast that is coming, and a small liturgical calendar of what to start when. Instant PDF download.',
  'Christmas cooking, done properly, starts four weeks early. The fruitcake soaks, the cookies wait in tins, the bread dough proves slowly in a cold pantry. The old word for this is Advent, which simply means arriving â€” the feast is on its way, and these weeks are how we make room for it.',
  '[]'::jsonb,
  0.00,
  9.00,
  'pdf',
  false,
  true,
  2
)
on conflict (slug) do nothing;
