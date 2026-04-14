import type { Recipe } from './types';

/**
 * Loader-time heuristics that tag each recipe with a few meal-type flags
 * so the liturgical calendar can surface appropriate suggestions without
 * manual curation of 3,485 entries.
 *
 * These are intentionally permissive; the classifier only needs to be
 * right often enough to produce good seasonal suggestions, not to be a
 * rigorous ingredient parser.
 */

export interface MealTags {
  meatless: boolean;
  hasFish: boolean;
  celebratory: boolean;
}

const MEAT_WORDS = [
  'beef', 'veal', 'pork', 'ham', 'bacon', 'sausage', 'chicken', 'hen',
  'capon', 'turkey', 'duck', 'goose', 'lamb', 'mutton', 'venison',
  'game', 'liver', 'kidney', 'tongue', 'tripe', 'rabbit', 'squirrel',
  'partridge', 'quail', 'pheasant', 'woodcock', 'pigeon', 'grouse',
  'forcemeat', 'meat', 'gelatine', 'lard', 'suet', 'broth',
];

const FISH_WORDS = [
  'fish', 'cod', 'haddock', 'halibut', 'trout', 'salmon', 'mackerel',
  'herring', 'sardine', 'anchovy', 'tuna', 'bass', 'perch', 'pike',
  'pickerel', 'flounder', 'sole', 'bluefish', 'smelt', 'shad',
  'whitefish', 'crab', 'lobster', 'shrimp', 'prawn', 'oyster', 'clam',
  'mussel', 'scallop', 'eel', 'caviare', 'caviar',
];

const CELEBRATORY_TITLE_WORDS = [
  'cake', 'pudding', 'pie', 'tart', 'cookie', 'roast', 'feast',
  'wedding', 'holiday', 'christmas', 'easter', 'thanksgiving',
  'plum pudding', 'fruit cake', 'mince', 'gingerbread', 'saffron',
  'king cake', 'babka', 'paska', 'kulich', 'simnel', 'hot cross',
  'eggnog', 'wassail', 'punch', 'torte', 'trifle', 'charlotte',
  'meringue', 'macaroon', 'truffle', 'confection', 'bonbon',
];

function bodyText(r: Recipe): string {
  const m = r.modern_recipe;
  const ing = Array.isArray(m.ingredients) ? m.ingredients.join(' ') : (m.ingredients ?? '');
  const ins = Array.isArray(m.instructions) ? m.instructions.join(' ') : (m.instructions ?? '');
  return `${r.title} ${ing} ${ins} ${r.original_recipe}`.toLowerCase();
}

function containsWord(text: string, words: string[]): boolean {
  for (const w of words) {
    // word-boundary-ish match without regex per word (fast path)
    const idx = text.indexOf(w);
    if (idx === -1) continue;
    const before = idx === 0 ? ' ' : text[idx - 1];
    const after = idx + w.length >= text.length ? ' ' : text[idx + w.length];
    const isBoundary = (c: string) => !/[a-z]/.test(c);
    if (isBoundary(before) && isBoundary(after)) return true;
  }
  return false;
}

export function computeMealTags(r: Recipe): MealTags {
  const text = bodyText(r);
  const hasFish = containsWord(text, FISH_WORDS);
  const hasMeat = containsWord(text, MEAT_WORDS);
  // A fish recipe counts as meatless for Friday purposes.
  const meatless = !hasMeat || (hasFish && !containsWord(text, MEAT_WORDS.filter((w) => w !== 'broth')));

  const title = r.title.toLowerCase();
  const celebratory =
    CELEBRATORY_TITLE_WORDS.some((w) => title.includes(w)) ||
    (r.tags ?? []).some((t) => /feast|holiday|celebrat|festive/i.test(t)) ||
    r.difficulty === 'involved';

  return { meatless, hasFish, celebratory };
}

export function tagRecipes(recipes: Recipe[]): Recipe[] {
  return recipes.map((r) => {
    if (r.meal_tags) return r;
    return { ...r, meal_tags: computeMealTags(r) };
  });
}
