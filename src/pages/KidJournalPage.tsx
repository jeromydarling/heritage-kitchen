import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useKids, type AvatarColor } from '../lib/kids';
import { useKidJournal } from '../lib/userData';
import { getRecipe } from '../lib/recipes';
import type { Recipe } from '../lib/types';

/**
 * Per-kid cooking journal. Shows every recipe that's been cooked
 * with this kid, newest first, with the liturgical context if
 * available. The big feature quietly sitting in the data is that
 * twenty years from now a grandparent can still pull this up and
 * see the week they made apple pie with their five-year-old.
 */

const COLOR_CLASS: Record<AvatarColor, string> = {
  terracotta: 'bg-terracotta',
  sage: 'bg-sage',
  cream: 'bg-cream border border-rule',
  ink: 'bg-ink',
  butter: 'bg-butter',
  plum: 'bg-plum',
  sky: 'bg-sky',
};

export default function KidJournalPage() {
  const { id = '' } = useParams();
  const { kids } = useKids();
  const kid = kids.find((k) => k.id === id) ?? null;
  const { entries, loading } = useKidJournal(id);
  const [recipeCache, setRecipeCache] = useState<Record<string, Recipe>>({});

  // Hydrate recipe titles for each log entry. Cheap — loadAll is
  // already cached by the time the user lands on this page.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const needed = entries.map((e) => e.recipe_id).filter((rid) => !recipeCache[rid]);
      if (needed.length === 0) return;
      const pairs = await Promise.all(needed.map(async (rid) => [rid, await getRecipe(rid)] as const));
      if (cancelled) return;
      const next = { ...recipeCache };
      for (const [rid, r] of pairs) if (r) next[rid] = r;
      setRecipeCache(next);
    }
    void load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries]);

  if (!kid) {
    return (
      <div className="space-y-4">
        <p className="text-muted">Kid not found.</p>
        <Link to="/household" className="btn-primary text-sm">
          Back to household
        </Link>
      </div>
    );
  }

  return (
    <article className="space-y-10">
      <header className="flex items-center gap-6">
        <span
          className={`flex h-20 w-20 items-center justify-center rounded-full font-serif text-3xl text-cream ${COLOR_CLASS[kid.avatar_color]}`}
        >
          {kid.name.charAt(0).toUpperCase()}
        </span>
        <div>
          <p className="text-xs uppercase tracking-widest text-terracotta">
            Cooking with
          </p>
          <h1 className="mt-1 font-serif text-4xl">{kid.name}</h1>
          <p className="mt-1 text-sm text-muted">age {kid.age}</p>
        </div>
      </header>

      <section>
        <h2 className="font-serif text-2xl">Journal</h2>
        <p className="mt-1 text-sm text-muted">
          Every dish you&rsquo;ve cooked together, newest first.
        </p>

        {loading ? (
          <p className="mt-6 text-sm text-muted">Loading…</p>
        ) : entries.length === 0 ? (
          <div className="mt-6 card p-6">
            <p className="text-sm leading-relaxed text-ink/90">
              Nothing logged yet. When kid mode is on and you mark a recipe as
              cooked, it will show up here. Twenty years from now this is the
              page you&rsquo;ll want to hand them when they move out.
            </p>
          </div>
        ) : (
          <ul className="mt-6 space-y-3">
            {entries.map((e) => {
              const r = recipeCache[e.recipe_id];
              const date = new Date(e.cooked_on).toLocaleDateString(undefined, {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              });
              return (
                <li key={e.id} className="card p-5">
                  <div className="flex items-baseline justify-between gap-4">
                    <div className="flex-1">
                      {r ? (
                        <Link to={`/recipe/${r.id}`} className="font-serif text-lg !no-underline hover:text-terracotta">
                          {r.title}
                        </Link>
                      ) : (
                        <span className="font-serif text-lg text-muted">
                          {e.recipe_id}
                        </span>
                      )}
                      <p className="mt-1 text-xs text-muted">{date}</p>
                      {e.liturgical_day && (
                        <p className="mt-1 text-xs italic text-terracotta">
                          {e.liturgical_day}
                        </p>
                      )}
                    </div>
                    {e.rating != null && (
                      <span className="font-serif text-sm text-muted">
                        {'★'.repeat(e.rating)}
                        {'☆'.repeat(5 - e.rating)}
                      </span>
                    )}
                  </div>
                  {e.notes && (
                    <p className="mt-3 text-sm leading-relaxed text-ink/90">
                      {e.notes}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </article>
  );
}
