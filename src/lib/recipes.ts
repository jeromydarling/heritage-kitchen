import type { Recipe } from './types';
import { sampleRecipes } from './sampleRecipes';
import { supabase, isSupabaseConfigured } from './supabase';

// Path to the JSON dataset in /public. The full 3,485-recipe file lives at
// public/heritage_kitchen_recipes.json and is fetched on first load — no
// Supabase required for read-only browsing.
const PUBLIC_DATASET_URL = `${import.meta.env.BASE_URL}heritage_kitchen_recipes.json`;

let cache: Recipe[] | null = null;
let inflight: Promise<Recipe[]> | null = null;

/**
 * Load all recipes. Strategy:
 *   1. If Supabase is configured, read from the `recipes` table.
 *   2. Otherwise, try to fetch /public/recipes.json (the full dataset).
 *   3. Otherwise, fall back to the bundled sample recipes so the UI still works.
 */
export async function loadRecipes(): Promise<Recipe[]> {
  if (cache) return cache;
  if (inflight) return inflight;

  inflight = (async () => {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from('recipes').select('*').order('title');
      if (!error && data && data.length > 0) {
        cache = data as Recipe[];
        return cache;
      }
    }

    try {
      const res = await fetch(PUBLIC_DATASET_URL, { cache: 'force-cache' });
      if (res.ok) {
        const text = await res.text();
        // Only treat this as the dataset if it's valid JSON (not an HTML 404 page).
        const data = JSON.parse(text);
        if (Array.isArray(data) && data.length > 0) {
          cache = data as Recipe[];
          return cache;
        }
      }
    } catch {
      // ignore — fall through to sample
    }

    cache = sampleRecipes;
    return cache;
  })();

  return inflight;
}

export async function getRecipe(id: string): Promise<Recipe | undefined> {
  const all = await loadRecipes();
  return all.find((r) => r.id === id);
}

export async function getRecipesByCategory(slug: string): Promise<Recipe[]> {
  const all = await loadRecipes();
  return all.filter((r) => r.category === slug);
}

export async function getCategoryCounts(): Promise<Record<string, number>> {
  const all = await loadRecipes();
  const counts: Record<string, number> = {};
  for (const r of all) counts[r.category] = (counts[r.category] ?? 0) + 1;
  return counts;
}

export async function searchRecipes(query: string): Promise<Recipe[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const all = await loadRecipes();
  return all.filter((r) => {
    if (r.title.toLowerCase().includes(q)) return true;
    if (r.tags?.some((t) => t.toLowerCase().includes(q))) return true;
    const ing = Array.isArray(r.modern_recipe.ingredients)
      ? r.modern_recipe.ingredients.join(' ')
      : r.modern_recipe.ingredients ?? '';
    if (ing.toLowerCase().includes(q)) return true;
    if (r.original_recipe.toLowerCase().includes(q)) return true;
    return false;
  });
}

export async function getRandomRecipe(category?: string): Promise<Recipe | undefined> {
  const all = await loadRecipes();
  const pool = category ? all.filter((r) => r.category === category) : all;
  if (pool.length === 0) return undefined;
  return pool[Math.floor(Math.random() * pool.length)];
}
