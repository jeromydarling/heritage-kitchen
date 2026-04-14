import type { Recipe } from './types';
import { sampleRecipes } from './sampleRecipes';
import { supabase, isSupabaseConfigured } from './supabase';
import { classifyAll, findRelatedEssays } from './classify';
import { tagRecipes } from './mealtype';
import { getLiturgicalDay, type LiturgicalDay, type SuggestionMode } from './liturgical';

// Path to the JSON dataset in /public. The full 3,485-recipe file lives at
// public/heritage_kitchen_recipes.json and is fetched on first load â€” no
// Supabase required for read-only browsing.
const PUBLIC_DATASET_URL = `${import.meta.env.BASE_URL}heritage_kitchen_recipes.json`;

// The loader caches the full classified dataset. Each entry has its
// `content_type` field populated ("recipe" or "essay"). The public helpers
// expose recipes and essays separately so UI code doesn't have to remember
// to filter.
let cache: Recipe[] | null = null;
let inflight: Promise<Recipe[]> | null = null;

function annotate(recipes: Recipe[]): Recipe[] {
  return tagRecipes(classifyAll(recipes));
}

async function loadAll(): Promise<Recipe[]> {
  if (cache) return cache;
  if (inflight) return inflight;

  inflight = (async () => {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from('recipes').select('*').order('title');
      if (!error && data && data.length > 0) {
        cache = annotate(data as Recipe[]);
        return cache;
      }
    }

    try {
      const res = await fetch(PUBLIC_DATASET_URL, { cache: 'force-cache' });
      if (res.ok) {
        const text = await res.text();
        const data = JSON.parse(text);
        if (Array.isArray(data) && data.length > 0) {
          cache = annotate(data as Recipe[]);
          return cache;
        }
      }
    } catch {
      // ignore â€” fall through to sample
    }

    cache = annotate(sampleRecipes);
    return cache;
  })();

  return inflight;
}

/** Returns only real recipes (essays filtered out). */
export async function loadRecipes(): Promise<Recipe[]> {
  const all = await loadAll();
  return all.filter((r) => r.content_type !== 'essay');
}

/** Returns only essays. */
export async function loadEssays(): Promise<Recipe[]> {
  const all = await loadAll();
  return all.filter((r) => r.content_type === 'essay');
}

/**
 * Look up any entry by id â€” works for both recipes and essays. Used when
 * the caller doesn't know which kind it is (e.g. a direct URL hit).
 */
export async function getEntry(id: string): Promise<Recipe | undefined> {
  const all = await loadAll();
  return all.find((r) => r.id === id);
}

export async function getRecipe(id: string): Promise<Recipe | undefined> {
  const recipes = await loadRecipes();
  return recipes.find((r) => r.id === id);
}

export async function getEssay(id: string): Promise<Recipe | undefined> {
  const essays = await loadEssays();
  return essays.find((r) => r.id === id);
}

export async function getRecipesByCategory(slug: string): Promise<Recipe[]> {
  const recipes = await loadRecipes();
  return recipes.filter((r) => r.category === slug);
}

export async function getEssaysByCategory(slug: string): Promise<Recipe[]> {
  const essays = await loadEssays();
  return essays.filter((r) => r.category === slug);
}

export async function getCategoryCounts(): Promise<Record<string, number>> {
  const recipes = await loadRecipes();
  const counts: Record<string, number> = {};
  for (const r of recipes) counts[r.category] = (counts[r.category] ?? 0) + 1;
  return counts;
}

export async function searchRecipes(query: string): Promise<Recipe[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  // Search across both recipes and essays so users can find everything.
  const all = await loadAll();
  return all.filter((r) => {
    if (r.title.toLowerCase().includes(q)) return true;
    if (r.tags?.some((t) => t.toLowerCase().includes(q))) return true;
    const ing = Array.isArray(r.modern_recipe.ingredients)
      ? r.modern_recipe.ingredients.join(' ')
      : (r.modern_recipe.ingredients ?? '');
    if (ing.toLowerCase().includes(q)) return true;
    if (r.original_recipe.toLowerCase().includes(q)) return true;
    return false;
  });
}

export async function getRandomRecipe(category?: string): Promise<Recipe | undefined> {
  const recipes = await loadRecipes();
  const pool = category ? recipes.filter((r) => r.category === category) : recipes;
  if (pool.length === 0) return undefined;
  return pool[Math.floor(Math.random() * pool.length)];
}

export async function getRelatedEssays(recipe: Recipe, limit = 3): Promise<Recipe[]> {
  const essays = await loadEssays();
  return findRelatedEssays(recipe, essays, limit);
}

/**
 * Pick `limit` recipes appropriate for the given liturgical day. The
 * scoring combines (1) feast-specific title token matches, (2) the
 * suggestion mode (fasting / feasting / ordinary), and (3) meal tags.
 */
export async function getSeasonalSuggestions(
  liturgicalDay: LiturgicalDay,
  limit = 6,
): Promise<Recipe[]> {
  const recipes = await loadRecipes();
  const mode: SuggestionMode = liturgicalDay.suggestionMode;
  const feastTokens = (liturgicalDay.feast?.titleTokens ?? []).map((t) => t.toLowerCase());

  const wantsMeatless =
    mode === 'fasting' || mode === 'friday-abstinence';
  const wantsCelebratory =
    mode === 'christmas-feast' ||
    mode === 'easter-feast' ||
    mode === 'feast-day';
  const wantsSimple = mode === 'advent-simple';

  const scored = recipes.map((r) => {
    const title = r.title.toLowerCase();
    const tags = r.meal_tags;
    let score = 0;

    // Feast-day specific title tokens are a strong signal.
    for (const token of feastTokens) {
      if (title.includes(token)) score += 20;
    }

    if (wantsMeatless) {
      if (tags?.meatless) score += 5;
      if (tags?.hasFish) score += 3;
      if (r.difficulty === 'easy') score += 1;
    }

    if (wantsCelebratory) {
      if (tags?.celebratory) score += 5;
      if (r.difficulty === 'involved') score += 2;
    }

    if (wantsSimple) {
      if (r.difficulty === 'easy') score += 2;
      if (tags?.meatless) score += 1;
    }

    if (mode === 'ordinary') {
      // A gentle bias toward easier everyday cooking.
      if (r.difficulty === 'easy') score += 1;
    }

    return { recipe: r, score };
  });

  // Filter out score-zero entries, then shuffle the top tier so visitors
  // see a slightly different selection on each load.
  const topTier = scored
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  if (topTier.length === 0) return [];

  const topScore = topTier[0].score;
  const cutoff = Math.max(topScore - 2, 1);
  const pool = topTier.filter((x) => x.score >= cutoff);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, limit).map((x) => x.recipe);
}

export { getLiturgicalDay };

export async function getRelatedRecipes(essay: Recipe, limit = 6): Promise<Recipe[]> {
  const recipes = await loadRecipes();
  const essayTitleTokens = essay.title.toLowerCase().split(/\s+/).filter((t) => t.length >= 4);
  const scored = recipes
    .map((r) => {
      let score = 0;
      const rTitle = r.title.toLowerCase();
      for (const t of essayTitleTokens) {
        if (rTitle.includes(t)) score += 5;
      }
      if (r.category === essay.category) score += 1;
      if (r.source_book === essay.source_book) score += 1;
      return { recipe: r, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((x) => x.recipe);
}
