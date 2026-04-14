import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { searchRecipes } from '../lib/recipes';
import type { Recipe } from '../lib/types';
import RecipeCard from '../components/RecipeCard';

export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const initial = params.get('q') ?? '';
  const [query, setQuery] = useState(initial);
  const [results, setResults] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = params.get('q') ?? '';
    setQuery(q);
    if (!q) {
      setResults([]);
      return;
    }
    setLoading(true);
    searchRecipes(q)
      .then(setResults)
      .finally(() => setLoading(false));
  }, [params]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setParams(query.trim() ? { q: query.trim() } : {});
  }

  // Split results into recipes and essays so essays are visually distinct
  // (they have their own badge already on the card, but grouping makes
  // the distinction even clearer).
  const [recipeResults, essayResults] = useMemo(() => {
    const r: Recipe[] = [];
    const e: Recipe[] = [];
    for (const x of results) {
      if (x.content_type === 'essay') e.push(x);
      else r.push(x);
    }
    return [r, e];
  }, [results]);

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <h1 className="font-serif text-3xl sm:text-4xl">Search</h1>
        <p className="text-muted">
          Full-text search across titles, ingredients, tags, and the
          original recipe text. Historical essays (like &ldquo;Coffee&rdquo;
          and &ldquo;Baking of Bread&rdquo;) are shown in their own section.
        </p>
        <form onSubmit={onSubmit} className="flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="What are you looking for?"
            className="w-full rounded-full border border-rule bg-surface px-4 py-2.5 text-sm"
          />
          <button type="submit" className="btn-primary shrink-0">
            Search
          </button>
        </form>
      </header>

      {loading ? (
        <p className="text-muted">Searchingâ€¦</p>
      ) : query.trim() === '' ? (
        <p className="text-muted">Type something above to search the library.</p>
      ) : results.length === 0 ? (
        <p className="text-muted">
          No recipes matched &ldquo;{query}&rdquo;. Try a different
          word&nbsp;&mdash; the library has a lot of old vocabulary
          (&ldquo;cooky&rdquo;, &ldquo;receipt&rdquo;,
          &ldquo;forcemeat&rdquo;&hellip;).
        </p>
      ) : (
        <div className="space-y-12">
          <p className="text-sm text-muted">
            {results.length} result{results.length === 1 ? '' : 's'} for{' '}
            &ldquo;{query}&rdquo;
          </p>

          {recipeResults.length > 0 && (
            <section>
              <div className="mb-4 flex items-baseline justify-between">
                <h2 className="font-serif text-2xl">Recipes</h2>
                <p className="text-xs uppercase tracking-widest text-muted">
                  {recipeResults.length}
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {recipeResults.slice(0, 60).map((r) => (
                  <RecipeCard key={r.id} recipe={r} />
                ))}
              </div>
            </section>
          )}

          {essayResults.length > 0 && (
            <section>
              <div className="mb-4 flex items-baseline justify-between">
                <h2 className="font-serif text-2xl">Historical essays</h2>
                <p className="text-xs uppercase tracking-widest text-muted">
                  {essayResults.length}
                </p>
              </div>
              <p className="mb-4 max-w-2xl text-sm text-muted">
                These aren&rsquo;t recipes &mdash; they&rsquo;re the
                encyclopedic entries the cookbooks mixed in with their
                actual dishes. Read them for context, not for dinner.
              </p>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {essayResults.slice(0, 30).map((r) => (
                  <RecipeCard key={r.id} recipe={r} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
