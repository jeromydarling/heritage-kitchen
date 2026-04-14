/**
 * Glossary of 1900s cookbook terms that need modern translation.
 *
 * The historical recipes use temperature terms ("quick oven"), dead
 * units ("gill", "saltspoonful"), and ingredients that vanished from
 * supermarket shelves ("oleomargarine", "isinglass"). Each entry in
 * GLOSSARY is a term the renderer will decorate with a tooltip
 * explaining the modern equivalent, so a reader from 2026 knows what
 * "moderate oven" actually means without having to google it.
 */

export interface GlossaryEntry {
  /** The phrase as it appears in the source text, lowercase. */
  term: string;
  /** Short explanation shown on hover. Kept under 80 chars. */
  modern: string;
  /** Category, used for colorization. */
  kind: 'temperature' | 'unit' | 'ingredient';
}

export const GLOSSARY: GlossaryEntry[] = [
  // ---- Oven temperatures ----
  { term: 'slow oven', modern: 'about 300°F (150°C)', kind: 'temperature' },
  { term: 'slack oven', modern: 'about 275°F (135°C) — barely hot', kind: 'temperature' },
  { term: 'moderate oven', modern: 'about 350°F (175°C)', kind: 'temperature' },
  { term: 'quick oven', modern: 'about 400°F (200°C)', kind: 'temperature' },
  { term: 'brisk oven', modern: 'about 400°F (200°C)', kind: 'temperature' },
  { term: 'hot oven', modern: 'about 425°F (220°C)', kind: 'temperature' },
  { term: 'sharp oven', modern: 'about 450°F (230°C) — very hot', kind: 'temperature' },
  { term: 'very hot oven', modern: 'about 475°F (245°C)', kind: 'temperature' },

  // ---- Dead volume units ----
  { term: 'gill', modern: '½ cup (4 fl oz)', kind: 'unit' },
  { term: 'gills', modern: '½ cup each (4 fl oz)', kind: 'unit' },
  { term: 'jill', modern: '½ cup (4 fl oz) — old spelling of "gill"', kind: 'unit' },
  { term: 'saltspoonful', modern: '¼ teaspoon', kind: 'unit' },
  { term: 'saltspoon', modern: '¼ teaspoon', kind: 'unit' },
  { term: 'saltspoonfuls', modern: '¼ teaspoon each', kind: 'unit' },
  { term: 'dessertspoonful', modern: '2 teaspoons', kind: 'unit' },
  { term: 'dessertspoon', modern: '2 teaspoons', kind: 'unit' },
  { term: 'dessertspoonfuls', modern: '2 teaspoons each', kind: 'unit' },
  { term: 'teacupful', modern: '¾ cup (6 fl oz)', kind: 'unit' },
  { term: 'teacup', modern: '¾ cup (6 fl oz)', kind: 'unit' },
  { term: 'teacupfuls', modern: '¾ cup each (6 fl oz)', kind: 'unit' },
  { term: 'coffeecupful', modern: '1 cup (8 fl oz)', kind: 'unit' },
  { term: 'coffeecup', modern: '1 cup (8 fl oz)', kind: 'unit' },
  { term: 'coffeecupfuls', modern: '1 cup each (8 fl oz)', kind: 'unit' },
  { term: 'wineglassful', modern: '¼ cup (2 fl oz)', kind: 'unit' },
  { term: 'wineglass', modern: '¼ cup (2 fl oz)', kind: 'unit' },
  { term: 'wineglassfuls', modern: '¼ cup each (2 fl oz)', kind: 'unit' },
  { term: 'tumblerful', modern: '1 cup (8 fl oz)', kind: 'unit' },
  { term: 'tumbler', modern: '1 cup (8 fl oz)', kind: 'unit' },
  { term: 'pottle', modern: '2 quarts', kind: 'unit' },
  { term: 'peck', modern: '2 dry gallons (about 8 dry quarts)', kind: 'unit' },
  { term: 'firkin', modern: 'a small wooden cask — about 9 gallons', kind: 'unit' },
  { term: 'scruple', modern: 'about 1/24 oz — an apothecary weight', kind: 'unit' },

  // ---- Dead or renamed ingredients ----
  { term: 'oleomargarine', modern: 'margarine — use butter or a neutral margarine', kind: 'ingredient' },
  { term: 'isinglass', modern: 'a fish-derived gelling agent — substitute unflavored gelatin', kind: 'ingredient' },
  { term: 'saleratus', modern: 'baking soda (the 1800s name)', kind: 'ingredient' },
  { term: 'pearlash', modern: 'potassium carbonate — use baking soda in modern recipes', kind: 'ingredient' },
  { term: 'sal volatile', modern: 'smelling salts / baker\u2019s ammonia — substitute baking powder', kind: 'ingredient' },
  { term: 'hartshorn', modern: 'baker\u2019s ammonia (ammonium carbonate) — substitute baking powder', kind: 'ingredient' },
  { term: 'cochineal', modern: 'a red dye from dried insects — use a few drops of red food coloring', kind: 'ingredient' },
  { term: 'citron', modern: 'candied citron peel — use candied lemon peel or mixed peel', kind: 'ingredient' },
  { term: 'suet', modern: 'beef fat from around the kidneys — substitute shortening or cold butter', kind: 'ingredient' },
  { term: 'graham flour', modern: 'whole wheat flour (coarser grind)', kind: 'ingredient' },
  { term: 'entire wheat flour', modern: 'whole wheat flour', kind: 'ingredient' },
  { term: 'sweet milk', modern: 'regular whole milk (as opposed to buttermilk)', kind: 'ingredient' },
  { term: 'sweet cream', modern: 'regular heavy cream (as opposed to sour cream)', kind: 'ingredient' },
  { term: 'sour milk', modern: 'buttermilk (or milk + 1 tsp vinegar per cup)', kind: 'ingredient' },
  { term: 'rose water', modern: 'rose water — available in Middle Eastern groceries', kind: 'ingredient' },
  { term: 'orange flower water', modern: 'orange blossom water — available in Middle Eastern groceries', kind: 'ingredient' },
];

/**
 * Compiled regex + lookup for the renderer. Terms are sorted
 * longest-first so "saltspoonful" wins over "saltspoon".
 */
const sorted = [...GLOSSARY].sort((a, b) => b.term.length - a.term.length);

export const GLOSSARY_RE = new RegExp(
  '\\b(' +
    sorted
      .map((e) => e.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('|') +
    ')\\b',
  'gi',
);

const BY_TERM = new Map<string, GlossaryEntry>();
for (const e of sorted) BY_TERM.set(e.term.toLowerCase(), e);

/** Look up a matched phrase in the glossary (case-insensitive). */
export function glossaryLookup(term: string): GlossaryEntry | undefined {
  return BY_TERM.get(term.toLowerCase());
}
