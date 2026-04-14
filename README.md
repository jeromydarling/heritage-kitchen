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

1. Run `supabase/schema.sql` in the SQL editor. It creates `profiles`,
   `cookbook_entries`, and `cook_log` with strict row-level security.
2. In the Supabase dashboard → Authentication → Providers → Google,
   enable Google OAuth. Create a Google Cloud OAuth client (Web
   application) and add `https://<project-ref>.supabase.co/auth/v1/callback`
   to its authorized redirect URIs.
3. In Authentication → URL Configuration, add your site URL
   (e.g. `https://heritagekitchen.app`) to the list of **Redirect URLs**
   so Supabase accepts it as a valid `redirectTo` when OAuth comes back.
4. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as repo secrets
   so the GitHub Pages build picks them up.

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
