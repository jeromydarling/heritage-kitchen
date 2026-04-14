import { Fragment, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { Recipe } from './types';

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

// "see" is deliberately excluded — the old books say "see page 47" and
// "see illustration" far more often than they name a recipe, so it
// produces mostly false triggers. Recipe-specific phrases only.
const TRIGGER_RE =
  /\b(same as|made as|proceed as for|prepared (?:as|like)|cooked as|baked as|served as|as for|as in)\s+/gi;

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

/**
 * Parses `text` and replaces historical cross-references with links
 * into the recipe library. Returns a React fragment ready to render
 * inside a `<p>` or other block.
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
    const triggerEnd = m.index + m[0].length;
    const tail = text.slice(triggerEnd);
    // Scan ahead up to the next sentence break (period, semi, paren,
    // newline) — recipe titles don't cross those boundaries.
    const breakIdx = tail.search(/[.;)\n]|,\s*(?:Serve|Cook|Add|Stir|Bake|Pour|Set|Drain|Season|Put|Place|Remove|Let|Allow|When|Until)/);
    const spanLen = breakIdx === -1 ? Math.min(tail.length, 80) : breakIdx;
    const candidate = tail.slice(0, spanLen);
    const hit = findBestMatch(candidate, index, currentId, sourceBook);
    if (!hit) continue;

    if (cursor < m.index) out.push(text.slice(cursor, m.index));
    out.push(m[0]);
    out.push(
      <Link
        key={`xref-${key++}-${m.index}`}
        to={`/recipe/${hit.recipe.id}`}
        className="text-terracotta underline decoration-terracotta/40 underline-offset-2 hover:decoration-terracotta"
      >
        {hit.matchedText}
      </Link>,
    );
    cursor = triggerEnd + hit.matchedLen;
    TRIGGER_RE.lastIndex = cursor;
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
