import { useEffect, useState } from 'react';
import { supabase } from './supabase';

export type Difficulty = 'beginner' | 'intermediate' | 'advanced';

export interface Lesson {
  id: string;
  title: string;
  source_book: string;
  source_author: string;
  source_year: string;
  source_url: string;
  topic: string;
  original_text: string;
  modern_explanation: string;
  key_takeaways: string[];
  still_true: string;
  outdated: string;
  related_recipe_tags: string[];
  difficulty: Difficulty;
  fun_for_kids: boolean;
  image_prompt: string;
  image_url?: string | null;
  published?: boolean;
  featured?: boolean;
  sort_order?: number;
}

/**
 * Editorial metadata for each lesson topic. Used on the /how-to-cook
 * index to label filter chips, and on the detail page to render a
 * small subtitle.
 */
export const TOPIC_META: Record<string, { label: string; blurb: string }> = {
  'food-science': {
    label: 'Food science',
    blurb: 'Why heat, acid, salt, and time do what they do to a pot of food.',
  },
  'bread-and-dough': {
    label: 'Bread & dough',
    blurb: 'Flour, yeast, gluten, and the small habits that make a real loaf.',
  },
  nutrition: {
    label: 'Nutrition',
    blurb: 'What the body needs, in the understanding of the early 20th century and of now.',
  },
  'fire-and-heat': {
    label: 'Fire & heat',
    blurb: 'Wood stoves, kindling, coal, and the art of cooking without a thermostat.',
  },
  'kitchen-setup': {
    label: 'Kitchen setup',
    blurb: 'How to organize a working kitchen so the work is possible at all.',
  },
  sauces: {
    label: 'Sauces',
    blurb: 'The mother sauces and the thickening and flavoring that build on them.',
  },
  'stocks-and-broths': {
    label: 'Stocks & broths',
    blurb: 'The foundation of everything you will simmer for the rest of your life.',
  },
  vegetables: {
    label: 'Vegetables',
    blurb: 'Choosing, storing, and cooking what the garden gives you.',
  },
  boiling: {
    label: 'Boiling & simmering',
    blurb: 'The difference between the two, and why it matters for everything from soup to rice.',
  },
  'economy-and-budgeting': {
    label: 'Economy & budgeting',
    blurb: 'Running a kitchen that costs less and wastes less.',
  },
  'meat-and-poultry': {
    label: 'Meat & poultry',
    blurb: 'Cuts, roasts, braises, and the principles that make tough meat tender.',
  },
  'meal-planning': {
    label: 'Meal planning',
    blurb: 'Building a week of meals that balance nutritionally and financially.',
  },
  'food-safety': {
    label: 'Food safety',
    blurb: 'Keeping a kitchen safe with the tools of a century ago and of now.',
  },
  baking: {
    label: 'Baking',
    blurb: 'The chemistry of leavening, mixing, and the heat of the oven.',
  },
  'cleaning-and-maintenance': {
    label: 'Cleaning & maintenance',
    blurb: 'The unglamorous half of running a kitchen: keeping it working.',
  },
  frying: {
    label: 'Frying',
    blurb: 'Shallow, deep, and saute \u2014 why hot fat cooks the way it does.',
  },
  'invalid-cookery': {
    label: 'Invalid cookery',
    blurb: 'Cooking for the sick and convalescent \u2014 a chapter every household kept once and almost none keeps now.',
  },
  'measuring-and-weights': {
    label: 'Measuring & weights',
    blurb: 'Cups versus grams, level versus heaping, and why it makes a difference.',
  },
  roasting: {
    label: 'Roasting',
    blurb: 'Dry heat, rested meat, and the old and new techniques for doing it right.',
  },
  'table-setting': {
    label: 'Table setting',
    blurb: 'The small ritual that turns dinner into a meal.',
  },
  'candy-and-sugar-work': {
    label: 'Candy & sugar work',
    blurb: 'Temperature stages, crystallization, and why a candy thermometer is worth buying.',
  },
  dairy: {
    label: 'Dairy',
    blurb: 'Butter, cream, and the short chemistry of curdling.',
  },
  eggs: {
    label: 'Eggs',
    blurb: 'The most versatile ingredient in any kitchen, cooked a dozen different ways.',
  },
  'fish-and-seafood': {
    label: 'Fish & seafood',
    blurb: 'Freshness, cuts, and the Friday fish tradition that shaped American cooking.',
  },
  'grilling-broiling': {
    label: 'Grilling & broiling',
    blurb: 'Cooking over and under direct heat.',
  },
  pastry: {
    label: 'Pastry',
    blurb: 'Short, flaky, and puff \u2014 three doughs that open every dessert.',
  },
  'preserving-and-canning': {
    label: 'Preserving & canning',
    blurb: 'Putting food up for winter the way the root cellar assumed.',
  },
  fruits: {
    label: 'Fruits',
    blurb: 'Selecting, storing, and working with what the orchard gives you.',
  },
};

const PUBLIC_DATASET_URL = `${import.meta.env.BASE_URL}heritage_kitchen_lessons.json`;

let cache: Lesson[] | null = null;
let inflight: Promise<Lesson[]> | null = null;

/**
 * Load all lessons. Strategy:
 *   1. If Supabase is configured, read from the `lessons` table.
 *   2. Otherwise, fetch /public/heritage_kitchen_lessons.json.
 *   3. Otherwise return empty.
 */
export async function loadLessons(): Promise<Lesson[]> {
  if (cache) return cache;
  if (inflight) return inflight;

  inflight = (async () => {
    if (supabase) {
      const { data } = await supabase
        .from('lessons')
        .select('*')
        .eq('published', true)
        .order('sort_order');
      if (data && data.length > 0) {
        cache = data as Lesson[];
        return cache;
      }
    }

    try {
      const res = await fetch(PUBLIC_DATASET_URL, { cache: 'force-cache' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          cache = data as Lesson[];
          return cache;
        }
      }
    } catch {
      // fall through
    }
    cache = [];
    return cache;
  })();

  return inflight;
}

export function useLessons() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    void loadLessons().then((l) => {
      setLessons(l);
      setLoading(false);
    });
  }, []);
  return { lessons, loading };
}

export function useLesson(id: string) {
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    void loadLessons().then((l) => {
      if (cancelled) return;
      setLesson(l.find((x) => x.id === id) ?? null);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);
  return { lesson, loading };
}

/**
 * Liturgical-day to lesson-topic affinity map. Used by
 * getSeasonalLessons() to surface appropriate lessons on the Calendar
 * page based on the mood of the day. Key is the SuggestionMode from
 * lib/liturgical.ts; value is an ordered list of lesson topics that
 * feel right for that mode.
 */
const SEASONAL_TOPIC_AFFINITY: Record<string, string[]> = {
  fasting: ['fish-and-seafood', 'vegetables', 'invalid-cookery', 'economy-and-budgeting', 'boiling'],
  'friday-abstinence': ['fish-and-seafood', 'vegetables', 'eggs', 'sauces'],
  'advent-simple': ['bread-and-dough', 'preserving-and-canning', 'meal-planning', 'stocks-and-broths', 'economy-and-budgeting'],
  'christmas-feast': ['candy-and-sugar-work', 'pastry', 'meat-and-poultry', 'baking', 'roasting'],
  'easter-feast': ['eggs', 'meat-and-poultry', 'dairy', 'pastry', 'baking'],
  'feast-day': ['roasting', 'pastry', 'candy-and-sugar-work', 'sauces'],
  ordinary: ['food-science', 'bread-and-dough', 'vegetables', 'meat-and-poultry', 'nutrition'],
};

/**
 * Returns lessons appropriate for the current liturgical day. Uses the
 * suggestionMode to pick the affinity list, then prefers lessons whose
 * topic appears earlier in the list. Falls back to a mixed sample when
 * nothing matches.
 */
export async function getSeasonalLessons(
  suggestionMode: string,
  limit = 3,
): Promise<Lesson[]> {
  const all = await loadLessons();
  if (all.length === 0) return [];
  const topics = SEASONAL_TOPIC_AFFINITY[suggestionMode] ?? SEASONAL_TOPIC_AFFINITY.ordinary;
  const scored = all
    .map((l) => {
      const idx = topics.indexOf(l.topic);
      return { lesson: l, score: idx === -1 ? 0 : topics.length - idx };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  if (scored.length === 0) {
    // No topic match â€” return a random sample so the section isn't empty.
    const shuffled = [...all].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, limit);
  }
  // Light shuffle within the top tier so returning visitors see variety.
  const topTier = scored.slice(0, Math.max(limit * 3, 10));
  for (let i = topTier.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [topTier[i], topTier[j]] = [topTier[j], topTier[i]];
  }
  return topTier.slice(0, limit).map((x) => x.lesson);
}

/**
 * Returns the lessons most relevant to a recipe, by matching any of the
 * recipe's category/tags against a lesson's related_recipe_tags array.
 * Used in the RecipePage sidebar to offer "Learn the technique" links.
 */
export async function getRelatedLessons(
  tags: string[],
  limit = 3,
): Promise<Lesson[]> {
  if (tags.length === 0) return [];
  const all = await loadLessons();
  const normalized = tags.map((t) => t.toLowerCase());
  const scored = all
    .map((l) => {
      let score = 0;
      for (const t of l.related_recipe_tags ?? []) {
        if (normalized.includes(t.toLowerCase())) score += 3;
      }
      return { lesson: l, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((x) => x.lesson);
}
