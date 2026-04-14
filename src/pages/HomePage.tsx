import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CATEGORIES, SOURCE_BOOKS, type Recipe } from '../lib/types';
import { getCategoryCounts, getRandomRecipe, loadRecipes } from '../lib/recipes';
import RecipeCard from '../components/RecipeCard';

export default function HomePage() {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [total, setTotal] = useState<number | null>(null);
  const [featured, setFeatured] = useState<Recipe | undefined>();
  const [bookFilter, setBookFilter] = useState<string>('');
  const [difficultyFilter, setDifficultyFilter] = useState<string>('');
  const [all, setAll] = useState<Recipe[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    loadRecipes().then((recipes) => {
      setAll(recipes);
      setTotal(recipes.length);
    });
    getCategoryCounts().then(setCounts);
    getRandomRecipe().then(setFeatured);
  }, []);

  const filtered = all.filter((r) => {
    if (bookFilter && r.source_book !== bookFilter) return false;
    if (difficultyFilter && r.difficulty !== difficultyFilter) return false;
    return true;
  });

  const filteredPreview = filtered.slice(0, 6);

  return (
    <div className="space-y-12">
      <section className="relative overflow-hidden rounded-3xl border border-rule bg-surface px-6 py-12 shadow-card sm:px-12 sm:py-16">
        <div className="max-w-2xl">
          <p className="mb-3 text-xs uppercase tracking-[0.2em] text-terracotta">Heritage Kitchen</p>
          <h1 className="font-serif text-4xl leading-tight sm:text-5xl">
            Cook the old food,
            <br />
            together.
          </h1>
          <p className="mt-5 text-lg text-muted">
            {total ? total.toLocaleString() : '3,485'} public-domain recipes from five classic American
            cookbooks (1869â€“1917), each shown in the cookâ€™s original words and adapted for a modern
            kitchen.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link to="/category/breakfast-and-bakes" className="btn-primary">
              Start browsing
            </Link>
            <button
              type="button"
              onClick={() => featured && navigate(`/recipe/${featured.id}`)}
              className="btn"
              disabled={!featured}
            >
              Surprise me
            </button>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-6 flex items-end justify-between">
          <h2 className="font-serif text-2xl">Browse by category</h2>
          <p className="text-xs text-muted">{Object.keys(counts).length} categories</p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {CATEGORIES.map((cat) => (
            <Link
              key={cat.slug}
              to={`/category/${cat.slug}`}
              className="card flex flex-col gap-1 p-4 !no-underline !text-ink transition hover:-translate-y-0.5 hover:border-terracotta"
            >
              <span className="font-serif text-base">{cat.label}</span>
              <span className="text-xs text-muted">{cat.blurb}</span>
              <span className="mt-2 text-xs font-semibold text-terracotta">
                {counts[cat.slug] ?? 0} recipes
              </span>
            </Link>
          ))}
        </div>
      </section>

      {featured && (
        <section>
          <div className="mb-6 flex items-end justify-between">
            <h2 className="font-serif text-2xl">Todayâ€™s random recipe</h2>
            <Link to={`/recipe/${featured.id}`} className="text-sm">
              Open â†’
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="sm:col-span-1">
              <RecipeCard recipe={featured} />
            </div>
            <div className="card p-6 sm:col-span-2">
              <p className="text-xs uppercase tracking-widest text-muted">
                From {featured.source_book}, {featured.source_year}
              </p>
              <h3 className="mt-1 font-serif text-2xl">{featured.title}</h3>
              {featured.history_note && (
                <p className="mt-3 text-sm leading-relaxed text-muted">{featured.history_note}</p>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                {featured.tags?.map((t) => (
                  <span className="chip" key={t}>
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      <section>
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="font-serif text-2xl">Filter the library</h2>
          <div className="flex flex-wrap gap-2">
            <select
              value={bookFilter}
              onChange={(e) => setBookFilter(e.target.value)}
              className="rounded-full border border-rule bg-surface px-3 py-1.5 text-sm"
            >
              <option value="">All books</option>
              {SOURCE_BOOKS.map((b) => (
                <option key={b.title} value={b.title}>
                  {b.title}
                </option>
              ))}
            </select>
            <select
              value={difficultyFilter}
              onChange={(e) => setDifficultyFilter(e.target.value)}
              className="rounded-full border border-rule bg-surface px-3 py-1.5 text-sm"
            >
              <option value="">All difficulties</option>
              <option value="easy">Easy</option>
              <option value="moderate">Moderate</option>
              <option value="involved">Involved</option>
            </select>
          </div>
        </div>
        {filteredPreview.length === 0 ? (
          <p className="text-sm text-muted">No recipes match that combination yet.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredPreview.map((r) => (
              <RecipeCard key={r.id} recipe={r} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
