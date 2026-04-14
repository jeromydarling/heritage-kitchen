/**
 * Fraction utilities for 1900s-cookbook ingredients.
 *
 * The historical dataset mixes three conventions: unicode glyph
 * fractions (½, ¾, ⅓), word-form fractions ("one-half cup",
 * "one-fourth teaspoon"), and the occasional decimal. This module
 * normalizes the display form and exposes a numeric parser that
 * future ingredient scalers can build on.
 */

/** Unicode fraction glyph → decimal value. */
export const GLYPH_TO_VALUE: Record<string, number> = {
  '¼': 0.25,
  '½': 0.5,
  '¾': 0.75,
  '⅓': 1 / 3,
  '⅔': 2 / 3,
  '⅕': 0.2,
  '⅖': 0.4,
  '⅗': 0.6,
  '⅘': 0.8,
  '⅙': 1 / 6,
  '⅚': 5 / 6,
  '⅛': 0.125,
  '⅜': 0.375,
  '⅝': 0.625,
  '⅞': 0.875,
};

/**
 * Word-form fraction → unicode glyph. Keys are the written-out form
 * the old books use; values are the closest glyph. The keys are
 * matched greedily (longest first) inside a regex so "one-third"
 * wins over "one".
 */
const WORD_TO_GLYPH: Record<string, string> = {
  'one-half': '½',
  'one half': '½',
  'a half': '½',
  'half a': '½',
  'one-third': '⅓',
  'one third': '⅓',
  'two-thirds': '⅔',
  'two thirds': '⅔',
  'one-fourth': '¼',
  'one fourth': '¼',
  'a quarter': '¼',
  'one-quarter': '¼',
  'one quarter': '¼',
  'three-fourths': '¾',
  'three fourths': '¾',
  'three-quarters': '¾',
  'three quarters': '¾',
  'one-fifth': '⅕',
  'one fifth': '⅕',
  'two-fifths': '⅖',
  'two fifths': '⅖',
  'three-fifths': '⅗',
  'three fifths': '⅗',
  'four-fifths': '⅘',
  'four fifths': '⅘',
  'one-sixth': '⅙',
  'one sixth': '⅙',
  'five-sixths': '⅚',
  'five sixths': '⅚',
  'one-eighth': '⅛',
  'one eighth': '⅛',
  'three-eighths': '⅜',
  'three eighths': '⅜',
  'five-eighths': '⅝',
  'five eighths': '⅝',
  'seven-eighths': '⅞',
  'seven eighths': '⅞',
};

const WORD_RE = new RegExp(
  '\\b(' +
    Object.keys(WORD_TO_GLYPH)
      .sort((a, b) => b.length - a.length)
      .map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('|') +
    ')\\b',
  'gi',
);

/**
 * Replaces word-form fractions with their unicode glyph equivalent
 * so "one-fourth cup sugar" renders the same as "¼ cup sugar".
 * Leaves everything else untouched.
 */
export function normalizeFractions(text: string): string {
  if (!text) return text;
  return text.replace(WORD_RE, (match) => WORD_TO_GLYPH[match.toLowerCase()] ?? match);
}

/**
 * Parses the leading quantity off a string like "¾ cup boiled coffee"
 * or "1 ½ tablespoons butter" into a numeric value. Returns null if
 * no leading quantity is found.
 */
export function parseLeadingQuantity(text: string): number | null {
  const trimmed = text.trimStart();
  // Whole + glyph, e.g. "1 ½"
  const mixed = trimmed.match(/^(\d+)\s*([¼½¾⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])/);
  if (mixed) return Number(mixed[1]) + GLYPH_TO_VALUE[mixed[2]];
  // Glyph alone, e.g. "¾"
  const glyph = trimmed.match(/^([¼½¾⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])/);
  if (glyph) return GLYPH_TO_VALUE[glyph[1]];
  // ASCII fraction, e.g. "3/4"
  const ascii = trimmed.match(/^(\d+)\s*\/\s*(\d+)/);
  if (ascii) return Number(ascii[1]) / Number(ascii[2]);
  // Whole with ASCII fraction, e.g. "1 3/4"
  const mixedAscii = trimmed.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)/);
  if (mixedAscii) return Number(mixedAscii[1]) + Number(mixedAscii[2]) / Number(mixedAscii[3]);
  // Plain number
  const plain = trimmed.match(/^(\d+(?:\.\d+)?)/);
  if (plain) return Number(plain[1]);
  return null;
}
