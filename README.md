# Heritage Kitchen

Cook the old food, together.

Heritage Kitchen is a recipe blog that presents 3,485 public-domain recipes from
five classic American cookbooks (1869–1917), each shown side-by-side in the
cook's original words and as a modern adaptation you can follow today.

## Stack

- **Vite + React 18 + TypeScript**
- **Tailwind CSS** with a warm, vintage-cookbook palette
- **React Router** (hash router, ideal for static GitHub Pages hosting)
- **Supabase** (Postgres + Auth + Storage + Edge Functions) — optional at
  build time. The site gracefully falls back to bundled sample recipes when
  Supabase isn't configured, so it deploys and browses fine on day one.

## Running locally

```bash
npm install
npm run dev
```

Open http://localhost:5173. With no env vars configured, the app shows a
handful of curated sample recipes.

### Using the full 3,485-recipe dataset

Two options:

1. **Static:** Drop the full dataset at `public/heritage_kitchen_recipes.json`.
   The recipe loader fetches it on first page load. This is the simplest path
   for GitHub Pages hosting.

2. **Supabase:** Run `supabase/schema.sql` in the Supabase SQL editor, then
   seed the data:

   ```bash
   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
   DATA_FILE=./heritage_kitchen_recipes.json \
   npm run seed
   ```

   Then set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` so the frontend
   reads from Postgres at runtime.

## Pages

| Route | What it is |
| --- | --- |
| `/` | Hero, "Today in the kitchen" callout, category grid, featured recipe, library filters |
| `/category/:slug` | Paginated, sortable recipe grid for one of the 12 categories |
| `/recipe/:id` | **The core UX.** Original / Modern tab switcher, AI illustration, history note, personal actions (save / notes / cook log / year-over-year memory) when signed in |
| `/essay/:id` | Historical essays from the cookbooks, surfaced as their own content type |
| `/calendar` | The liturgical kitchen: today's season, feast, and suggested recipes, plus the case for cooking by the oldest calendar in the world |
| `/cookbook` | The signed-in user's saved recipes and recent cook log |
| `/search?q=…` | Full-text search across titles, ingredients, tags, and original text |
| `/about` | Project description and source-book bibliography |
| `/admin` | Supabase-auth-gated image management (regenerate AI illustrations) |

## User accounts (Google sign-in)

Sign-in is optional — the site is fully browsable without an account.
When Supabase is configured, signed-in users can save recipes to a
private cookbook, keep private notes, and log every time they cook
something. The cook log records the liturgical day so that next year
the site can surface "you made this last Good Friday" prompts.

### One-time Supabase setup

1. Run `supabase/schema.sql` in the SQL editor. It creates all tables
   with strict row-level security: `profiles`, `cookbook_entries`,
   `cook_log`, `households`, `household_members`, `meal_plan_entries`,
   `shopping_list_items`, and `cookbook_projects`. Safe to re-run; uses
   `create table if not exists` and idempotent policy definitions.
2. In the Supabase dashboard → Authentication → Providers → Google,
   enable Google OAuth. Create a Google Cloud OAuth client (Web
   application) and add `https://<project-ref>.supabase.co/auth/v1/callback`
   to its authorized redirect URIs.
3. In Authentication → URL Configuration, add your site URL
   (e.g. `https://heritagekitchen.app`) to the list of **Redirect URLs**
   so Supabase accepts it as a valid `redirectTo` when OAuth comes back.
4. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as repo secrets
   so the GitHub Pages build picks them up.

## Meal plan, shopping list, households

Signed-in users are automatically put into a "household" the first time
they use a shared feature. The household has a 6-character invite code
displayed on the `/cookbook` page; any other user can enter that code
to join the same household. Members of a household share the **meal
plan** and **shopping list**; personal saves, notes, and cook logs stay
per-user.

- `/plan` — week view meal planner. Each day shows its date, the
  liturgical day, and the recipes planned for it. Click "Add a recipe"
  to search the library and drop one onto a day.
- `/shopping` — shared list with checkboxes. The "Generate from this
  week's plan" button pulls every ingredient from the household's
  planned recipes, de-dupes by exact string, and adds them all.
- `/recipe/:id` has "Add to meal plan", "Add ingredients to shopping
  list", and "Print recipe" buttons on the personal sidebar.

## Printable cookbooks (direct ordering via Lulu + Stripe)

On `/cookbook/build`, signed-in users pick recipes from their saved
cookbook, give the book a title/subtitle/dedication, and click **Order
a printed copy**. The flow is fully direct-ordered &mdash; no manual
PDF upload to Lulu required:

1. **Shipping address** is collected in the browser.
2. **PDF generation** happens client-side via `src/lib/pdfGen.ts`
   (jsPDF, lazy-imported so the ~130 kB gzipped chunk only loads when
   someone opens the builder). Output is 6&times;9 inch, serif
   typography, title page with the Augustine epigraph, table of
   contents, one recipe per section, colophon. Padded to an even page
   count and a 24-page minimum for hardcover binding.
3. **Upload** to the `cookbook-pdfs` Supabase Storage bucket.
4. **Quote** via the `lulu-quote` edge function, which OAuths into the
   Lulu API and requests a real price calculation. Customer sees Lulu's
   cost + your markup.
5. **Stripe Checkout** session via the `stripe-checkout` edge function.
   Redirects the browser to Stripe; payment never touches our site.
6. **Stripe webhook** (`stripe-webhook`) fires on
   `checkout.session.completed` and creates the real Lulu print-job
   against your Lulu account, referencing the pre-uploaded PDF. Updates
   `cookbook_projects.status` to `ordered` and records the Lulu order id.
7. **Lulu webhook** (`lulu-webhook`) receives status updates as the
   book moves through production / shipping / delivery and updates the
   project status and tracking URL.
8. **/order/:id** is the status page. It auto-refreshes every 10
   seconds so returning customers always see the current state without
   any manual action.

### One-time setup for direct ordering

**Stripe:**

1. Create a Stripe account and grab a secret key
   (`sk_test_...` for the sandbox, `sk_live_...` for production).
2. In Stripe Dashboard &rarr; Developers &rarr; Webhooks, add an
   endpoint: `https://<project-ref>.functions.supabase.co/stripe-webhook`
   listening for `checkout.session.completed`. Copy the signing secret.
3. Set these as Supabase Edge Function secrets:
   ```
   STRIPE_SECRET_KEY=sk_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   STRIPE_SUCCESS_URL=https://heritagekitchen.app/#/order/{id}?paid=1
   STRIPE_CANCEL_URL=https://heritagekitchen.app/#/cookbook/build
   ```

**Lulu:**

1. Create a Lulu developer account at https://developers.lulu.com and
   grab a client key + secret for sandbox first, production later.
2. In the Lulu developer dashboard &rarr; Webhooks, add an endpoint:
   `https://<project-ref>.functions.supabase.co/lulu-webhook` listening
   for `PRINT_JOB_STATUS_CHANGED`.
3. Set these as Supabase Edge Function secrets:
   ```
   LULU_CLIENT_KEY=...
   LULU_CLIENT_SECRET=...
   LULU_ENV=sandbox           # or "production"
   LULU_POD_PACKAGE_ID=0600X0900BWSTDPB060UW444MXX  # 6x9 B&W perfect-bound
   LULU_COVER_URL=https://...                          # optional shared cover PDF
   BOOK_MARKUP_USD=15         # your flat margin on top of Lulu's cost
   ```
4. Deploy the functions:
   ```
   supabase functions deploy lulu-quote
   supabase functions deploy stripe-checkout
   supabase functions deploy stripe-webhook --no-verify-jwt
   supabase functions deploy lulu-webhook --no-verify-jwt
   ```
   The two webhook functions need `--no-verify-jwt` because Stripe and
   Lulu don't send Supabase auth headers.

### Choosing a POD package

Lulu's catalog has roughly 3,000 format combinations. The default we
use is `0600X0900BWSTDPB060UW444MXX` &mdash; 6&times;9 inches, black &
white, standard quality, perfect-bound paperback, 60 lb uncoated white
paper, 444 ppm matte. Swap the env var to switch to a different format
(e.g. color premium hardcover for a high-end heirloom edition). The full
list is at https://developers.lulu.com/home/pod-products.

## Weekly digest email

A Supabase edge function at `supabase/functions/weekly-digest/`
runs once a week and sends opted-in users an email with:

- The week ahead, with liturgical feast days
- Recipes the user made this time last year (from `cook_log`)
- Suggested recipes from the library based on the season

The skeleton is complete; to actually send emails you need to pick a
provider (Resend, Postmark, or SendGrid all work) and fill in the
`sendEmail()` function inside the edge function. Then schedule it with
Supabase cron:

```sql
select cron.schedule(
  'heritage-kitchen-weekly-digest',
  '0 22 * * 0',  -- Sundays at 22:00 UTC
  $$ select net.http_post(
       url := 'https://<project-ref>.functions.supabase.co/weekly-digest',
       headers := '{"Authorization":"Bearer <service-role-key>"}'::jsonb
     ) $$
);
```

Users opt in from the `/cookbook` page.

## Monetization

The site is free to use. The paid layer is physical goods and optional
supporter features:

1. **Lulu-printed family cookbooks (primary).** Users build a book
   from their saved recipes, we generate the PDF, Lulu prints and
   ships. Lulu pays a 10% [affiliate commission](https://www.lulu.com/sell/affiliate-program)
   on books ordered via an affiliate link; we can embed ours in the
   "Order on Lulu" button once the upload flow is running. Later,
   once API integration is done, we set a small markup on each book
   and collect the margin directly.
2. **Custom heirloom cookbooks.** A white-glove service where you
   send us your grandmother's recipes on scraps of paper and we
   transcribe, modernize, and typeset them in the Heritage Kitchen
   style. One-time fee per book; low volume, high value.
3. **Liturgical cooking courses.** A paid Lent or Advent
   meal-planning guide, delivered via email over 40 days with daily
   recipes, prompts, and historical notes. Sold as a single purchase,
   not a subscription. Fits the site's ethos.
4. **Affiliate bookstore.** Curated book recommendations (cookbook
   history, food theology, farmers' almanacs) via Bookshop.org's
   ethical affiliate program, which gives a cut to independent
   bookstores instead of Amazon.
5. **Household patronage.** A "buy us a season" button that lets
   supporters drop $20–$50 to underwrite a liturgical season's
   hosting + email costs. Names optionally listed on the About page.
6. **Adopt-a-recipe.** Aligned businesses (stone mills, traditional
   farms, religious goods shops) can sponsor a historical recipe and
   have a small logo/blurb shown on its page. Not ads in the
   pop-up-banner sense; closer to a museum donor plaque.

Deliberately **not** doing: banner ads, tracking, paywalled
recipes, subscriptions for core features.

## Image generation

Images are generated **lazily**: when a recipe page is visited and its
`image_url` is null, the frontend invokes the `generate-recipe-image` Supabase
edge function (skeleton at `supabase/functions/generate-recipe-image/`),
which is expected to call an image provider, store the result in the
`recipe-images` bucket, and update `recipes.image_url`. Until a provider is
wired up, a vintage-styled placeholder is shown and the function returns a
no-op stub so nothing crashes. Admins can regenerate images individually or in
bulk from `/admin`.

## Deployment to GitHub Pages

`.github/workflows/deploy.yml` builds and publishes every push to `main`. For
a user/org site or a custom domain, the defaults work as-is. For a project
page like `https://<user>.github.io/heritage-kitchen/`, set a repo variable
`VITE_BASE=/heritage-kitchen/`. To use a custom domain, set the `CUSTOM_DOMAIN`
repo variable and the workflow will emit a `CNAME` file.

Optional Supabase env vars are read from repo **secrets**:
`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.

## Project layout

```
src/
  components/    Layout, RecipeCard, TabSwitcher, RecipeImage, DifficultyBadge
  lib/           types, recipes loader, supabase client, image client, sample data
  pages/         Home, Category, Recipe, Search, About, Admin, NotFound
scripts/seed.ts  Bulk upsert of heritage_kitchen_recipes.json into Supabase
supabase/        schema.sql + edge function skeleton
.github/workflows/deploy.yml  GitHub Pages deploy
```
