import type { Recipe } from './types';
import { supabase, isSupabaseConfigured } from './supabase';

// Ensures we only dispatch one generation request per recipe per browser session.
const inflight = new Map<string, Promise<string | null>>();

/**
 * Lazily request an AI-generated illustration for a recipe.
 *
 * The actual image API is pluggable. In this MVP we call a Supabase Edge
 * Function named `generate-recipe-image` which receives `{ recipe_id,
 * image_prompt }` and is expected to:
 *   1. Call an image generation API (configured server-side),
 *   2. Upload the result to the `recipe-images` bucket at `{id}.png`,
 *   3. Update `recipes.image_url` in the database,
 *   4. Return `{ image_url }`.
 *
 * If Supabase is not configured (local dev, fallback mode), we simply return
 * null so the placeholder keeps showing.
 */
export async function requestRecipeImage(recipe: Recipe): Promise<string | null> {
  if (recipe.image_url) return recipe.image_url;
  if (!isSupabaseConfigured || !supabase) return null;

  const existing = inflight.get(recipe.id);
  if (existing) return existing;

  const p = (async () => {
    try {
      const { data, error } = await supabase.functions.invoke('generate-recipe-image', {
        body: { recipe_id: recipe.id, image_prompt: recipe.image_prompt },
      });
      if (error) return null;
      return (data as { image_url?: string } | null)?.image_url ?? null;
    } catch {
      return null;
    }
  })();

  inflight.set(recipe.id, p);
  return p;
}

/**
 * Clears a recipe's cached image and requests regeneration. Used by the admin
 * page. Requires an authenticated Supabase admin session.
 */
export async function regenerateRecipeImage(recipe: Recipe): Promise<string | null> {
  if (!isSupabaseConfigured || !supabase) return null;
  inflight.delete(recipe.id);
  await supabase.from('recipes').update({ image_url: null }).eq('id', recipe.id);
  return requestRecipeImage({ ...recipe, image_url: null });
}
