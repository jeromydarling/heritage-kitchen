# Heritage Kitchen

Cook the old food, together.

Heritage Kitchen is a recipe blog that presents 3,485 public-domain recipes from
five classic American cookbooks (1869â€“1917), each shown side-by-side in the
cook's original words and as a modern adaptation you can follow today.

## Stack

- **Vite + React 18 + TypeScript**
- **Tailwind CSS** with a warm, vintage-cookbook palette
- **React Router** (hash router, ideal for static GitHub Pages hosting)
- **Supabase** (Postgres + Auth + Storage + Edge Functions) â€” optional at
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
| `/` | Hero, category grid, random featured recipe, library filters |
| `/category/:slug` | Paginated, sortable recipe grid for one of the 12 categories |
| `/recipe/:id` | **The core UX.** Original / Modern tab switcher, AI illustration, history note |
| `/search?q=â€¦` | Full-text search across titles, ingredients, tags, and original text |
| `/about` | Project description and source-book bibliography |
| `/admin` | Supabase-auth-gated image management (regenerate AI illustrations) |

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
