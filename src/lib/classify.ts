import type { Recipe } from './types';

/**
 * Classify a raw dataset entry as either a recipe or an essay.
 *
 * The Heritage Kitchen dataset mixes actual recipes with encyclopedic
 * essays and how-to articles from the source books (e.g. "Coffee",
 * "Baking of Bread", "How to Make a Pie"). These shouldn't appear in the
 * recipe grid â€” they should be surfaced as historical context linked from
 * related recipes.
 *
 * This is a heuristic classifier tuned against the full 3,485-entry dataset.
 * At the time of writing it flags 58 entries as essays; the rest are
 * treated as recipes. The logic mirrors `scripts/classify.py` which was
 * used to inspect and iterate the heuristic offline.
 */

const ESSAY_TITLE_PREFIXES = [
  'care of ', 'baking of ', 'cooking of ', 'how to ', 'about ',
  'preparation of ', 'selection of ', 'time table', 'general directions',
  'general rules', 'choice of ', 'composition of ', 'classification of ',
  'notes on ', 'methods of ', 'kinds of ', 'types of ', 'remarks on ',
  'table service', 'table setting', 'weights and measures', 'to measure',
  'to carve', 'carving ', 'the use of ', 'ways of cooking', 'ways to cook',
  'healing properties', 'food values', 'food value', 'nutritive value',
  'to cut layer', 'to test ',
];

const ESSAY_TITLES_EXACT = new Set([
  'coffee', 'tea', 'chocolate', 'cocoa', 'bread', 'milk', 'butter', 'cheese',
  'eggs', 'meat', 'fish', 'oysters', 'vegetables', 'fruit', 'salads', 'soups',
  'sauces', 'cereals', 'jellies', 'fuel', 'fires', 'marketing', 'measuring',
  'yeast', 'flour', 'sugar', 'salt', 'spices', 'herbs', 'vinegar',
  'baking powder', 'gelatine', 'gelatin', 'nuts', 'raisins', 'currants',
  'dates', 'figs', 'lemons', 'oranges', 'apples', 'pears', 'peaches',
  'berries', 'strawberries', 'cherries', 'grapes', 'bananas', 'pineapples',
  'tomatoes', 'potatoes', 'onions', 'carrots', 'beets', 'celery', 'cabbage',
  'peas', 'beans', 'rice', 'macaroni', 'mushrooms', 'vanilla', 'cinnamon',
  'nutmeg', 'pepper', 'mustard', 'garnishing', 'serving', 'lettuce', 'okra',
  'truffles', 'bonbons', 'candies', 'tarts', 'greens', 'radishes',
  'buttermilk', 'cream', 'spinach', 'asparagus', 'cauliflower', 'squash',
  'parsnips', 'turnips',
]);

const VERB_STEMS = [
  'take', 'put', 'mix', 'stir', 'add', 'beat', 'pour', 'bake', 'boil',
  'simmer', 'cut', 'chop', 'slic', 'heat', 'cook', 'serv', 'remov', 'cover',
  'drain', 'break', 'cream', 'fold', 'roll', 'knead', 'sprinkl', 'wash',
  'peel', 'rub', 'sift', 'spread', 'fill', 'rins', 'soak', 'dust', 'drop',
  'press', 'steam', 'fry', 'brown', 'dissolv', 'scald', 'melt', 'blend',
  'combin', 'shap', 'prepar', 'follow', 'choos', 'select', 'lay', 'plac',
  'tie', 'par', 'cor', 'ston', 'lin', 'butter', 'greas', 'whisk', 'whip',
  'stuff', 'grill', 'roast', 'wip', 'scrap', 'pick', 'gather', 'set',
  'arrang', 'turn', 'skim', 'season', 'sweeten', 'garnish', 'us', 'parboil',
  'stew', 'broil', 'grate', 'minc', 'pound', 'mash', 'strain', 'dredg',
  'scor', 'trim', 'truss', 'bon', 'skin', 'fillet', 'clean', 'form', 'make',
  'proceed', 'reduc', 'poach', 'brais', 'sear', 'glaz', 'ic', 'frost',
  'flavor', 'tast', 'measur', 'weigh', 'split',
];

const VERB_RE = new RegExp(
  '\\b(' + VERB_STEMS.join('|') + ')(?:e|ed|es|ing|en|s)?\\b',
  'i',
);

const MEASUREMENT_RE =
  /\b(cups?|tablespoons?|teaspoons?|tsps?|tbsps?|pounds?|lbs?|ounces?|ozs?|pints?|quarts?|gallons?|inches?|minutes?|hours?|tablespoonfuls?|teaspoonfuls?|cupfuls?|pinches?|dashes?|handfuls?|bunches?|cloves?|pans?|bowls?|dishes?|pots?|skillets?|saucepans?|kettles?|ovens?|stoves?|griddles?|molds?|gills?|drams?|grams?|degrees?)\b|\d+°/i;

const DESCRIPTIVE_PHRASES = [
  'is native to', 'is a genus', 'belongs to the genus', 'belongs to the family',
  'is a name given to', 'is the name given', 'is an article of',
  'may be classified', 'are classified', 'is obtained from', 'grows in tropical',
  'are of two', 'are divided into', 'are classed as', 'nutritive value of',
  'food value of', 'constitute the', 'are valuable for', 'rich in protein',
  'rich in fat', 'are a source of', 'are a rich source', 'contains a large',
  'is a member of', 'is cultivated', 'historically', 'medical properties',
  'healing properties', 'are mollusks', 'are invertebrates', 'has latterly',
  'so generally regarded',
];

/**
 * Strips a shouted ALL-CAPS heading from the start of the original text,
 * so the classifier looks at the actual body content underneath.
 */
function stripHeading(original: string): string {
  const idx = original.indexOf('\n');
  if (idx === -1) return original;
  const firstLine = original.slice(0, idx).trim();
  const alpha = firstLine.replace(/[^A-Za-z]/g, '');
  if (!alpha) return original;
  const upperCount = (firstLine.match(/[A-Z]/g) ?? []).length;
  const isHeading =
    upperCount >= 0.8 * alpha.length && firstLine.length < 60;
  return isHeading ? original.slice(idx + 1).trimStart() : original;
}

export type ContentType = 'recipe' | 'essay';

export function classifyEntry(entry: {
  title: string;
  original_recipe: string;
}): ContentType {
  const title = entry.title.trim().toLowerCase();

  for (const prefix of ESSAY_TITLE_PREFIXES) {
    if (title.startsWith(prefix)) return 'essay';
  }
  if (ESSAY_TITLES_EXACT.has(title)) return 'essay';

  const body = stripHeading(entry.original_recipe);
  const headLower = body.slice(0, 500).toLowerCase();

  for (const phrase of DESCRIPTIVE_PHRASES) {
    if (headLower.includes(phrase)) return 'essay';
  }

  const firstChunk = body.slice(0, 400);
  if (firstChunk.length > 100) {
    const hasVerb = VERB_RE.test(firstChunk);
    const hasMeas = MEASUREMENT_RE.test(firstChunk);
    if (!hasVerb && !hasMeas) return 'essay';
  }

  return 'recipe';
}

/**
 * Annotate an array of raw dataset entries with a content_type field, if
 * they don't already have one. Idempotent.
 */
export function classifyAll(entries: Recipe[]): Recipe[] {
  return entries.map((r) =>
    r.content_type ? r : { ...r, content_type: classifyEntry(r) },
  );
}

/**
 * Given a recipe, find up to `limit` essays from the same corpus that are
 * topically related. We prefer essays in the same category that share a
 * distinctive word with the recipe's title or tags, then fall back to same-
 * category essays, then any essay whose title appears in the recipe text.
 */
export function findRelatedEssays(
  recipe: Recipe,
  essays: Recipe[],
  limit = 3,
): Recipe[] {
  const title = recipe.title.toLowerCase();
  const originalLower = recipe.original_recipe.toLowerCase();
  const tags = (recipe.tags ?? []).map((t) => t.toLowerCase());
  const titleTokens = new Set(
    tokenize(title).concat(tags.flatMap((t) => tokenize(t))),
  );

  const scored = essays
    .filter((e) => e.id !== recipe.id)
    .map((e) => {
      const essayTitleTokens = tokenize(e.title.toLowerCase());
      let score = 0;
      // Shared distinctive word in title
      for (const t of essayTitleTokens) {
        if (t.length >= 4 && titleTokens.has(t)) score += 5;
      }
      // Essay title word appears in the recipe's original text
      for (const t of essayTitleTokens) {
        if (t.length >= 5 && originalLower.includes(t)) score += 2;
      }
      // Same category bonus
      if (e.category === recipe.category) score += 1;
      // Same source book bonus
      if (e.source_book === recipe.source_book) score += 1;
      return { essay: e, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map((x) => x.essay);
}

const STOPWORDS = new Set([
  'the', 'and', 'with', 'for', 'from', 'that', 'this', 'into', 'over',
  'under', 'some', 'other', 'very', 'more', 'less', 'than', 'their',
  'them', 'they', 'your', 'a', 'an', 'of', 'to', 'in', 'on', 'or',
  'by', 'at', 'it', 'is', 'as', 'be', 'all', 'any', 'one', 'two',
]);

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
}
