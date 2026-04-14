import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CATEGORIES, type Recipe } from '../lib/types';
import { getRecipesByCategory } from '../lib/recipes';
import RecipeCard from '../components/RecipeCard';

type Sort = 'alpha' | 'book' | 'difficulty';

const difficultyOrder: Record<string, number> = { easy: 0, moderate: 1, involved: 2 };

export default function CategoryPage() {
  const { slug = '' } = useParams();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [sort, setSort] = useState<Sort>('alpha');
  const [page, setPage] = useState(1);
  const pageSize = 24;

  const category = CATEGORIES.find((c) => c.slug === slug);

  useEffect(() => {
    setPage(1);
    getRecipesByCategory(slug).then(setRecipes);
  }, [slug]);

  const sorted = useMemo(() => {
    const arr = [...recipes];
    if (sort === 'alpha') arr.sort((a, b) => a.title.localeCompare(b.title));
    else if (sort === 'book') arr.sort((a, b) => a.source_book.localeCompare(b.source_book));
    else arr.sort((a, b) => (difficultyOrder[a.difficulty] ?? 9) - (difficultyOrder[b.difficulty] ?? 9));
    return arr;
  }, [recipes, sort]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const paginated = sorted.slice((page - 1) * pageSize, page * pageSize);

  if (!category) {
    return (
      <div>
        <p className="text-muted">
          That category doesn't exist. <Link to="/">Go home</Link>.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <nav className="text-xs uppercase tracking-widest text-muted">
        <Link to="/">Home</Link> <span className="mx-1 text-rule">/</span>
        <span>{category.label}</span>
      </nav>

      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-serif text-4xl">{category.label}</h1>
          <p className="mt-2 max-w-xl text-muted">{category.blurb}</p>
          <p className="mt-1 text-xs text-muted">{sorted.length} recipes</p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted">Sort by</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="rounded-full border border-rule bg-surface px-3 py-1.5"
          >
            <option value="alpha">Alphabetical</option>
            <option value="book">Source book</option>
            <option value="difficulty">Difficulty</option>
          </select>
        </label>
      </header>

      {paginated.length === 0 ? (
        <p className="text-muted">
          No recipes in this category yet. The full 3,485-recipe dataset hasn't been loaded — see{' '}
          <Link to="/about">About</Link> for details.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {paginated.map((r) => (
            <RecipeCard key={r.id} recipe={r} />
          ))}
        </div>
      )}

      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <button className="btn" disabled={page === 1} onClick={() => setPage(page - 1)}>
            Previous
          </button>
          <span className="text-sm text-muted">
            Page {page} of {pageCount}
          </span>
          <button className="btn" disabled={page === pageCount} onClick={() => setPage(page + 1)}>
            Next
          </button>
        </div>
      )}
    </div>
  );
}
