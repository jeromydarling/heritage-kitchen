import { Fragment, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { Recipe } from './types';
import { CATEGORIES } from './types';
import { normalizeFractions } from './fractions';

/**
 * Auto-linker for historical cross-references.
 *
 * Old cookbooks constantly say things like "Make and bake same as
 * Chocolate Soufflé" — a reference the reader was expected to chase by
 * flipping pages. On the web we can do better: detect these phrases and
 * turn the referenced recipe title into a real link.
 *
 * The linker matches a set of trigger phrases ("same as", "proceed as
 * for", "see", etc.) and then looks ahead for the longest recipe title
 * that resolves against the library index. Scoped to the current
 * recipe's source_book first, then any book.
 */

export type RecipeIndex = Map<string, Recipe[]>;

// The main trigger regex. "see" is handled specially because it has
// three flavors in the old cookbooks: real cross-references ("see
// SAUCES"), dead print-era page refs ("see page 47"), and English
// grammar clauses ("see that it is kept clean"). The linker
// discriminates between them after matching.
const TRIGGER_RE =
  /\b(same as|made as|proceed as for|prepared (?:as|like)|cooked as|baked as|served as|as for|as in|see)\s+/gi;

// Words that follow "see" in grammar constructions rather than
// references. "see that X", "see if X", "see when X", etc.
const SEE_GRAMMAR_WORDS = new Set([
  'that',
  'if',
  'when',
  'how',
  'whether',
  'to',
  'no',
  'some',
  'the',
]);

// Print-era page reference tokens that follow "see". Page references
// cannot be auto-linked (we have no page→recipe map for the source
// books) so we mute them visually instead of leaving them dangling.
const PAGE_REF_RE = /^(?:page|pages|p\.|pp\.|p\b)/i;

// Match the full page-reference tail ("page 271", "pages 242-244",
// "p. 581") so we know how much of the raw text to include in the
// muted span.
const PAGE_TAIL_RE = /^(?:pages?|pp?\.)\s*\d+(?:\s*[-–—]\s*\d+)?(?:\s+and\s*\d+)?/i;

// Category label → slug index for "see SAUCES" / "see Salads" links
// into the category browse pages.
const CATEGORY_ALIASES: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const c of CATEGORIES) {
    // Full label: "Sauces & Condiments" → "sauces and condiments"
    const full = c.label.toLowerCase().replace(/&/g, 'and').replace(/\s+/g, ' ').trim();
    map[full] = c.slug;
    // First word of the slug: "sauces-and-condiments" → "sauces"
    const first = c.slug.split('-')[0];
    if (first && !(first in map)) map[first] = c.slug;
  }
  // A few common synonyms the old books use.
  map.soup = 'soups-and-stews';
  map.soups = 'soups-and-stews';
  map.stews = 'soups-and-stews';
  map.sauce = 'sauces-and-condiments';
  map.pickle = 'preserves-and-pickles';
  map.pickles = 'preserves-and-pickles';
  map.preserve = 'preserves-and-pickles';
  map.preserves = 'preserves-and-pickles';
  return map;
})();

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N} ]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Build a title→recipes index used by `linkRecipeReferences`. */
export function buildRecipeIndex(library: Recipe[]): RecipeIndex {
  const index: RecipeIndex = new Map();
  const add = (key: string, r: Recipe) => {
    if (!key) return;
    const arr = index.get(key);
    if (arr) arr.push(r);
    else index.set(key, [r]);
  };
  for (const r of library) {
    if (r.content_type === 'essay') continue;
    add(normalize(r.title), r);
    // Strip trailing roman numeral / number so "Chocolate I" also
    // resolves "Chocolate" references when the library only has one.
    const stripped = r.title.replace(/\s+(?:I{1,3}|IV|V|VI{1,3}|\d+)$/i, '').trim();
    if (stripped && stripped !== r.title) add(normalize(stripped), r);
    // Old books name variants as "Sauce, Hot" / "Sauce, Cold" but
    // cross-reference them as just "Sauce". Index the pre-comma base.
    const commaIdx = r.title.indexOf(',');
    if (commaIdx > 0) {
      const base = r.title.slice(0, commaIdx).trim();
      if (base) add(normalize(base), r);
    }
  }
  return index;
}

interface MatchHit {
  recipe: Recipe;
  matchedLen: number;
  matchedText: string;
}

function findBestMatch(
  candidate: string,
  index: RecipeIndex,
  currentId: string,
  sourceBook?: string,
): MatchHit | null {
  // Tokenize into alphanumeric runs, recording how far into the raw
  // candidate each token extends. This lets "Pop-overs" count as two
  // normalized tokens (pop + overs) while still consuming the whole
  // hyphenated string from the raw text when we link it.
  const tokens: { word: string; rawEnd: number }[] = [];
  const tokenRe = /[\p{L}\p{N}]+/gu;
  let tm: RegExpExecArray | null;
  while ((tm = tokenRe.exec(candidate)) !== null) {
    tokens.push({ word: tm[0].toLowerCase(), rawEnd: tm.index + tm[0].length });
  }
  // Require 2+ normalized tokens to avoid linking single common words
  // like "above" or "salt".
  for (let n = tokens.length; n >= 2; n--) {
    const key = tokens
      .slice(0, n)
      .map((t) => t.word)
      .join(' ');
    const hits = index.get(key);
    if (!hits || hits.length === 0) continue;
    const filtered = hits.filter((r) => r.id !== currentId);
    if (filtered.length === 0) continue;
    const preferred =
      (sourceBook && filtered.find((r) => r.source_book === sourceBook)) || filtered[0];
    const rawEnd = tokens[n - 1].rawEnd;
    return {
      recipe: preferred,
      matchedLen: rawEnd,
      matchedText: candidate.slice(0, rawEnd),
    };
  }
  return null;
}

function findCategoryMatch(
  candidate: string,
): { slug: string; matchedLen: number; matchedText: string } | null {
  // Look for a category alias at the start of the candidate. Try the
  // longest phrase first (e.g. "sauces and condiments") down to the
  // single word ("sauces").
  const lower = candidate.toLowerCase();
  for (const alias of Object.keys(CATEGORY_ALIASES).sort((a, b) => b.length - a.length)) {
    if (lower.startsWith(alias)) {
      // Make sure it ends on a word boundary — avoid matching "salad" inside "salads".
      const after = candidate.charAt(alias.length);
      if (after === '' || /[^\p{L}\p{N}]/u.test(after)) {
        return {
          slug: CATEGORY_ALIASES[alias],
          matchedLen: alias.length,
          matchedText: candidate.slice(0, alias.length),
        };
      }
    }
  }
  return null;
}

/**
 * Parses `text` and replaces historical cross-references with links
 * into the recipe library. Returns a React fragment ready to render
 * inside a `<p>` or other block. Three kinds of references are
 * recognized: recipe titles (the common case), category labels
 * ("see SAUCES" → /category/sauces-and-condiments), and dead print-era
 * page references ("see page 271") which are muted visually instead
 * of linked.
 */
export function linkRecipeReferences(
  text: string,
  currentId: string,
  index: RecipeIndex,
  sourceBook?: string,
): ReactNode {
  if (!text || index.size === 0) return text;

  const out: ReactNode[] = [];
  let cursor = 0;
  TRIGGER_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = TRIGGER_RE.exec(text)) !== null) {
    const trigger = m[1].toLowerCase();
    const triggerStart = m.index;
    const triggerEnd = m.index + m[0].length;
    const tail = text.slice(triggerEnd);

    // ---- Handle "see" specially ----
    if (trigger === 'see') {
      // "see that / if / when / how / ..." — English grammar, skip.
      const firstWordMatch = tail.match(/^(\S+)/);
      const firstWord = firstWordMatch?.[1].toLowerCase().replace(/[^\p{L}]/gu, '');
      if (firstWord && SEE_GRAMMAR_WORDS.has(firstWord)) {
        TRIGGER_RE.lastIndex = triggerEnd;
        continue;
      }
      // "see page 271", "see pages 242-244", "see p. 581" — mute.
      if (PAGE_REF_RE.test(tail)) {
        const pageTail = tail.match(PAGE_TAIL_RE);
        const muteLen = pageTail ? pageTail[0].length : (tail.match(/^\S+/)?.[0].length ?? 0);
        if (cursor < triggerStart) out.push(text.slice(cursor, triggerStart));
        out.push(
          <span
            key={`xref-${key++}-${triggerStart}`}
            className="text-muted/70 italic"
            title="Page reference from the original print edition"
          >
            {text.slice(triggerStart, triggerEnd + muteLen)}
          </span>,
        );
        cursor = triggerEnd + muteLen;
        TRIGGER_RE.lastIndex = cursor;
        continue;
      }
    }

    // ---- Look for a link target in the span after the trigger ----
    const breakIdx = tail.search(
      /[.;)\n]|,\s*(?:Serve|Cook|Add|Stir|Bake|Pour|Set|Drain|Season|Put|Place|Remove|Let|Allow|When|Until)/,
    );
    const spanLen = breakIdx === -1 ? Math.min(tail.length, 80) : breakIdx;
    const candidate = tail.slice(0, spanLen);

    // Try the recipe index first. Recipe titles are more specific than
    // category aliases, so a phrase like "see Canned Red Peppers" will
    // resolve to the recipe instead of the (wrong) "canned" fallback.
    const recipeHit = findBestMatch(candidate, index, currentId, sourceBook);
    if (recipeHit) {
      if (cursor < triggerStart) out.push(text.slice(cursor, triggerStart));
      out.push(m[0]);
      out.push(
        <Link
          key={`xref-${key++}-${triggerStart}`}
          to={`/recipe/${recipeHit.recipe.id}`}
          className="text-terracotta underline decoration-terracotta/40 underline-offset-2 hover:decoration-terracotta"
        >
          {recipeHit.matchedText}
        </Link>,
      );
      cursor = triggerEnd + recipeHit.matchedLen;
      TRIGGER_RE.lastIndex = cursor;
      continue;
    }

    // Fall back to category aliases. Only active after "see" — the
    // other triggers ("same as", "proceed as for") don't point at
    // whole categories, they point at specific recipes.
    if (trigger === 'see') {
      const catHit = findCategoryMatch(candidate);
      if (catHit) {
        if (cursor < triggerStart) out.push(text.slice(cursor, triggerStart));
        out.push(m[0]);
        out.push(
          <Link
            key={`xref-${key++}-${triggerStart}`}
            to={`/category/${catHit.slug}`}
            className="text-terracotta underline decoration-terracotta/40 underline-offset-2 hover:decoration-terracotta"
          >
            {catHit.matchedText}
          </Link>,
        );
        cursor = triggerEnd + catHit.matchedLen;
        TRIGGER_RE.lastIndex = cursor;
        continue;
      }
    }
  }
  if (cursor < text.length) out.push(text.slice(cursor));
  if (out.length === 0) return text;
  return (
    <>
      {out.map((node, i) => (
        <Fragment key={i}>{node}</Fragment>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Bold markup + sub-recipe callouts
// ---------------------------------------------------------------------------
//
// Project Gutenberg etexts use =Word= for emphasis/bold. The old
// cookbooks use it for two things in particular: inline bold ("Serve
// with =Lemon Sauce=") and sub-recipe titles inside a parent recipe
// ("=Mocha Sauce.= Mix yolks..."). The renderer picks up both:
//   - Short all-caps or title-case bold runs ending in a period are
//     treated as sub-recipe headings (block-level).
//   - Everything else is rendered inline with <strong>.

const BOLD_RE = /=([^=\n]{1,120}?)=/g;

function isSubRecipeHeading(inner: string): boolean {
  const trimmed = inner.trim().replace(/\.$/, '').trim();
  if (!trimmed) return false;
  const words = trimmed.split(/\s+/);
  if (words.length < 1 || words.length > 6) return false;
  // All-caps section header (e.g. "SAUCES") — definitely a heading.
  if (/^[A-Z][A-Z\s]+$/.test(trimmed) && trimmed.length >= 4) return true;
  // Title-case phrase ending with a period in the source. Accept words
  // that start with an uppercase letter or are short articles ("la",
  // "de", "aux", "à") that appear inside French dish names.
  const articles = new Set(['à', 'a', 'la', 'le', 'de', 'du', 'des', 'aux', 'en', 'à la', 'of']);
  const titleCased = words.every(
    (w) => /^[A-Z]/.test(w) || articles.has(w.toLowerCase()),
  );
  return titleCased && inner.trim().endsWith('.');
}

/**
 * Full text formatter for recipe instructions and original text.
 * Applies bold/sub-recipe parsing first, then runs the link matcher
 * over the remaining plain segments. This is the function recipe
 * pages should use; `linkRecipeReferences` is exported only for its
 * type and testing.
 */
export function formatHistoricalText(
  rawText: string,
  currentId: string,
  index: RecipeIndex,
  sourceBook?: string,
): ReactNode {
  if (!rawText) return rawText;
  // Normalize word-form fractions so "one-fourth cup" renders the
  // same as "¼ cup". Safe to run on the raw source because it only
  // rewrites matched word-form phrases.
  const text = normalizeFractions(rawText);

  const nodes: ReactNode[] = [];
  let cursor = 0;
  let key = 0;
  BOLD_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = BOLD_RE.exec(text)) !== null) {
    if (m.index > cursor) {
      nodes.push(
        <Fragment key={`t-${key++}`}>
          {linkRecipeReferences(text.slice(cursor, m.index), currentId, index, sourceBook)}
        </Fragment>,
      );
    }
    const inner = m[1];
    if (isSubRecipeHeading(inner)) {
      // Block-level sub-recipe heading. Wrapping in a span with a
      // leading break keeps it flowing inside a <p> parent while
      // giving it visual prominence.
      nodes.push(
        <span
          key={`sub-${key++}`}
          className="mt-3 block font-serif text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-terracotta"
        >
          {inner.trim().replace(/\.$/, '')}
        </span>,
      );
    } else {
      nodes.push(
        <strong key={`b-${key++}`} className="font-semibold">
          {inner}
        </strong>,
      );
    }
    cursor = m.index + m[0].length;
  }
  if (cursor < text.length) {
    nodes.push(
      <Fragment key={`t-${key++}`}>
        {linkRecipeReferences(text.slice(cursor), currentId, index, sourceBook)}
      </Fragment>,
    );
  }
  return <>{nodes}</>;
}
