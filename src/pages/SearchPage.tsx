import { useEffect, useState } from 'react';
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

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <h1 className="font-serif text-4xl">Search</h1>
        <p className="text-muted">
          Full-text search across titles, ingredients, tags, and the original recipe text.
        </p>
        <form onSubmit={onSubmit} className="flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="What are you looking for?"
            className="w-full rounded-full border border-rule bg-surface px-4 py-2.5 text-sm"
          />
          <button type="submit" className="btn-primary">
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
          No recipes matched â€œ{query}â€. Try a different word â€” the library has a lot of old
          vocabulary (â€œcookyâ€, â€œreceiptâ€, â€œforcemeatâ€â€¦).
        </p>
      ) : (
        <div>
          <p className="mb-4 text-sm text-muted">
            {results.length} result{results.length === 1 ? '' : 's'} for â€œ{query}â€
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {results.slice(0, 60).map((r) => (
              <RecipeCard key={r.id} recipe={r} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
