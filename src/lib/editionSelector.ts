import type { Recipe } from './types';
import type { Lesson } from './lessons';

/**
 * Edition auto-assembly selector.
 *
 * An EditionSelector is a declarative config that picks recipes and
 * lessons from the full library for a specific editorial edition. Admin
 * writes the selector once in the /admin/editions JSON field, clicks
 * "Rebuild from selector," and the edition's recipe_ids + lesson_ids
 * arrays get regenerated. Deterministic, re-runnable, hand-tunable.
 */

export interface EditionSelector {
  /** Only include recipes whose category is in this list. */
  includeCategories?: string[];
  /** Exclude recipes whose category is in this list. */
  excludeCategories?: string[];
  /** Include recipes that have at least one of these tags. */
  includeTags?: string[];
  /** Exclude recipes that have any of these tags. */
  excludeTags?: string[];
  /** Only include recipes from one of these source books. */
  sourceBooks?: string[];
  /** Only include recipes at one of these difficulty levels. */
  difficulties?: Array<'easy' | 'moderate' | 'involved'>;
  /** Only include recipes flagged meatless by the meal-tag classifier. */
  meatless?: boolean;
  /** Only include recipes that contain fish or seafood. */
  hasFish?: boolean;
  /** Only include recipes flagged celebratory. */
  celebratory?: boolean;
  /** Include recipes whose title contains any of these tokens (case-insensitive). */
  titleIncludes?: string[];
  /** Exclude recipes whose title contains any of these tokens. */
  titleExcludes?: string[];
  /** Hard cap on selected recipes after all filters. Default 100. */
  maxRecipes?: number;

  /** Lesson topics to include. */
  lessonTopics?: string[];
  /** Only include lessons flagged fun_for_kids. */
  lessonKidFriendly?: boolean;
  /** Only include lessons at these difficulty levels. */
  lessonDifficulty?: Array<'beginner' | 'intermediate' | 'advanced'>;
  /** Hard cap on selected lessons. Default 20. */
  maxLessons?: number;

  /** Sort strategy for the output arrays. Defaults to 'category'. */
  sortBy?: 'category' | 'alphabetical' | 'difficulty' | 'source_year' | 'none';
}

export interface SelectorResult {
  recipe_ids: string[];
  lesson_ids: string[];
  recipeCount: number;
  lessonCount: number;
}

/**
 * Runs a selector over the given recipe and lesson libraries and returns
 * the filtered, sorted, and capped id arrays.
 */
export function autoSelectEdition(
  selector: EditionSelector,
  recipes: Recipe[],
  lessons: Lesson[],
): SelectorResult {
  const maxRecipes = selector.maxRecipes ?? 100;
  const maxLessons = selector.maxLessons ?? 20;

  // ---- Recipes ----
  let pickedRecipes: Recipe[] = [];
  if (maxRecipes > 0) {
    pickedRecipes = recipes.filter((r) => recipeMatches(r, selector));
    pickedRecipes = sortPool(pickedRecipes, selector.sortBy ?? 'category');
    pickedRecipes = pickedRecipes.slice(0, maxRecipes);
  }

  // ---- Lessons ----
  let pickedLessons: Lesson[] = [];
  if (maxLessons > 0) {
    pickedLessons = lessons.filter((l) => lessonMatches(l, selector));
    pickedLessons = sortLessons(pickedLessons, selector.sortBy ?? 'category');
    pickedLessons = pickedLessons.slice(0, maxLessons);
  }

  return {
    recipe_ids: pickedRecipes.map((r) => r.id),
    lesson_ids: pickedLessons.map((l) => l.id),
    recipeCount: pickedRecipes.length,
    lessonCount: pickedLessons.length,
  };
}

function recipeMatches(r: Recipe, s: EditionSelector): boolean {
  // Exclude essays from edition auto-assembly; they have their own place.
  if (r.content_type === 'essay') return false;

  if (s.includeCategories && !s.includeCategories.includes(r.category)) return false;
  if (s.excludeCategories && s.excludeCategories.includes(r.category)) return false;

  const tags = (r.tags ?? []).map((t) => t.toLowerCase());
  if (s.includeTags && !s.includeTags.some((t) => tags.includes(t.toLowerCase()))) return false;
  if (s.excludeTags && s.excludeTags.some((t) => tags.includes(t.toLowerCase()))) return false;

  if (s.sourceBooks && !s.sourceBooks.includes(r.source_book)) return false;
  if (s.difficulties && !s.difficulties.includes(r.difficulty)) return false;

  if (s.meatless && !r.meal_tags?.meatless) return false;
  if (s.hasFish && !r.meal_tags?.hasFish) return false;
  if (s.celebratory && !r.meal_tags?.celebratory) return false;

  const title = r.title.toLowerCase();
  if (s.titleIncludes && s.titleIncludes.length > 0) {
    if (!s.titleIncludes.some((t) => title.includes(t.toLowerCase()))) return false;
  }
  if (s.titleExcludes && s.titleExcludes.some((t) => title.includes(t.toLowerCase()))) return false;

  return true;
}

function lessonMatches(l: Lesson, s: EditionSelector): boolean {
  if (s.lessonTopics && !s.lessonTopics.includes(l.topic)) return false;
  if (s.lessonKidFriendly && !l.fun_for_kids) return false;
  if (s.lessonDifficulty && !s.lessonDifficulty.includes(l.difficulty)) return false;
  return true;
}

function sortPool(pool: Recipe[], sortBy: EditionSelector['sortBy']): Recipe[] {
  const copy = [...pool];
  switch (sortBy) {
    case 'alphabetical':
      copy.sort((a, b) => a.title.localeCompare(b.title));
      break;
    case 'difficulty': {
      const order: Record<string, number> = { easy: 0, moderate: 1, involved: 2 };
      copy.sort((a, b) => (order[a.difficulty] ?? 9) - (order[b.difficulty] ?? 9));
      break;
    }
    case 'source_year':
      copy.sort((a, b) => Number(a.source_year) - Number(b.source_year));
      break;
    case 'category':
      copy.sort((a, b) => {
        const c = a.category.localeCompare(b.category);
        return c !== 0 ? c : a.title.localeCompare(b.title);
      });
      break;
    case 'none':
    default:
      break;
  }
  return copy;
}

function sortLessons(pool: Lesson[], sortBy: EditionSelector['sortBy']): Lesson[] {
  const copy = [...pool];
  switch (sortBy) {
    case 'alphabetical':
      copy.sort((a, b) => a.title.localeCompare(b.title));
      break;
    case 'difficulty': {
      const order: Record<string, number> = { beginner: 0, intermediate: 1, advanced: 2 };
      copy.sort((a, b) => (order[a.difficulty] ?? 9) - (order[b.difficulty] ?? 9));
      break;
    }
    case 'category':
      copy.sort((a, b) => {
        const c = a.topic.localeCompare(b.topic);
        return c !== 0 ? c : a.title.localeCompare(b.title);
      });
      break;
    default:
      break;
  }
  return copy;
}
