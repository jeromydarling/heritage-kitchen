import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getEssay, getRelatedRecipes, getEntry } from '../lib/recipes';
import { CATEGORIES, type Recipe } from '../lib/types';

/**
 * Essay page â€” shows one of the historical/encyclopedic entries from the
 * cookbooks (e.g. "Coffee", "Baking of Bread", "How to Make a Pie") in
 * their original paper-styled presentation, with links to related recipes.
 *
 * If a visitor lands here with an id that turns out to be a recipe rather
 * than an essay, we redirect-ish by showing a link to the real recipe page.
 */
export default function EssayPage() {
  const { id = '' } = useParams();
  const [essay, setEssay] = useState<Recipe | undefined>();
  const [related, setRelated] = useState<Recipe[]>([]);
  const [fallback, setFallback] = useState<Recipe | undefined>();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const found = await getEssay(id);
      if (cancelled) return;
      if (found) {
        setEssay(found);
        setRelated(await getRelatedRecipes(found));
      } else {
        // Maybe it's actually a recipe â€” tell the user so they can jump.
        setFallback(await getEntry(id));
      }
    })();
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!essay) return;
    const prev = document.title;
    document.title = `${essay.title} â€” Heritage Kitchen`;
    return () => {
      document.title = prev;
    };
  }, [essay]);

  if (!essay && fallback) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="font-serif text-3xl">That's actually a recipe</h1>
        <p className="mt-3 text-muted">
          <Link to={`/recipe/${fallback.id}`}>Open {fallback.title}</Link>
        </p>
      </div>
    );
  }
  if (!essay) return <p className="text-muted">Loadingâ€¦</p>;

  const category = CATEGORIES.find((c) => c.slug === essay.category);

  return (
    <article className="space-y-8">
      <nav className="text-xs uppercase tracking-widest text-muted">
        <Link to="/">Home</Link> <span className="mx-1 text-rule">/</span>
        <Link to="/about">Essays</Link> <span className="mx-1 text-rule">/</span>
        <span>{essay.title}</span>
      </nav>

      <header className="max-w-3xl">
        <p className="text-xs uppercase tracking-widest text-terracotta">
          Historical essay Â· {essay.source_book} Â· {essay.source_year}
        </p>
        <h1 className="mt-1 font-serif text-4xl leading-tight sm:text-5xl">{essay.title}</h1>
        <p className="mt-2 text-sm text-muted">by {essay.source_author}</p>
      </header>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <section className="paper rounded-2xl border border-rule p-6 shadow-card sm:p-10">
            <p className="mb-4 font-serif text-xs uppercase tracking-[0.2em] text-terracotta">
              As written in {essay.source_year}
            </p>
            <pre className="whitespace-pre-wrap font-mono text-[0.95rem] leading-relaxed text-ink">
              {essay.original_recipe}
            </pre>
          </section>

          {essay.history_note && (
            <section className="card mt-6 p-6">
              <h2 className="font-serif text-xl">A bit of context</h2>
              <p className="mt-2 leading-relaxed text-muted">{essay.history_note}</p>
            </section>
          )}
        </div>

        <aside className="space-y-4">
          <div className="card p-5">
            <h3 className="font-serif text-lg">Source</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              {essay.source_book}
              <br />
              {essay.source_author}, {essay.source_year}
            </p>
            <a
              href={essay.source_url}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-block text-sm"
            >
              View on Project Gutenberg â†—
            </a>
          </div>

          {category && (
            <div className="card p-5">
              <h3 className="font-serif text-lg">Filed under</h3>
              <Link
                to={`/category/${category.slug}`}
                className="mt-2 inline-block text-sm"
              >
                {category.label}
              </Link>
            </div>
          )}

          {related.length > 0 && (
            <div className="card p-5">
              <h3 className="font-serif text-lg">Recipes to try</h3>
              <ul className="mt-3 space-y-2">
                {related.map((r) => (
                  <li key={r.id}>
                    <Link to={`/recipe/${r.id}`} className="text-sm">
                      {r.title}
                    </Link>
                    <span className="ml-2 text-xs text-muted">
                      {r.source_year}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </article>
  );
}
