import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CATEGORIES, SOURCE_BOOKS, type Recipe } from '../lib/types';
import {
  getCategoryCounts,
  getRandomRecipe,
  loadRecipes,
  getSeasonalSuggestions,
} from '../lib/recipes';
import {
  getLiturgicalDay,
  SUGGESTION_MODE_LABELS,
  type LiturgicalDay,
} from '../lib/liturgical';
import { useLiturgicalKitchen } from '../lib/preferences';
import RecipeCard from '../components/RecipeCard';

export default function HomePage() {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [total, setTotal] = useState<number | null>(null);
  const [featured, setFeatured] = useState<Recipe | undefined>();
  const [bookFilter, setBookFilter] = useState<string>('');
  const [difficultyFilter, setDifficultyFilter] = useState<string>('');
  const [all, setAll] = useState<Recipe[]>([]);
  const [seasonal, setSeasonal] = useState<Recipe[]>([]);
  const [calendarOn, setCalendarOn] = useLiturgicalKitchen();
  const navigate = useNavigate();

  const liturgicalDay: LiturgicalDay = useMemo(() => getLiturgicalDay(new Date()), []);

  useEffect(() => {
    loadRecipes().then((recipes) => {
      setAll(recipes);
      setTotal(recipes.length);
    });
    getCategoryCounts().then(setCounts);
    getRandomRecipe().then(setFeatured);
    if (calendarOn) {
      getSeasonalSuggestions(liturgicalDay, 3).then(setSeasonal);
    } else {
      setSeasonal([]);
    }
  }, [liturgicalDay, calendarOn]);

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
          <p className="mb-3 font-serif text-sm italic text-terracotta">
            &ldquo;Beauty ever ancient, ever new.&rdquo;
            <span className="ml-2 not-italic text-muted">â€” St. Augustine</span>
          </p>
          <h1 className="font-serif text-4xl leading-tight sm:text-5xl">
            Cook the old food,
            <br />
            together.
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-ink/90">
            The modern conceit is that everything new is good and everything
            old is bad. The kitchen knows better. Heritage Kitchen is a
            growing library of {total ? total.toLocaleString() : '3,427'}{' '}
            American recipes from 1869â€“1917, each paired with a modern
            adaptation and tuned to the rhythms of the Christian year â€”
            because some of the best things to eat have been waiting for you
            since before your grandmother was born.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            {calendarOn ? (
              <Link to="/calendar" className="btn-primary">
                Cook with the season
              </Link>
            ) : (
              <Link to="/category/breakfast-and-bakes" className="btn-primary">
                Start browsing
              </Link>
            )}
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

      {calendarOn && (
        <TodayCard
          day={liturgicalDay}
          suggestions={seasonal}
          onHide={() => setCalendarOn(false)}
        />
      )}

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

function TodayCard({
  day,
  suggestions,
  onHide,
}: {
  day: LiturgicalDay;
  suggestions: Recipe[];
  onHide: () => void;
}) {
  const dateLabel = new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(day.date);

  return (
    <section className="rounded-3xl border border-rule bg-paper p-6 shadow-card sm:p-10">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-terracotta">
            Today in the kitchen
          </p>
          <h2 className="mt-2 font-serif text-2xl sm:text-3xl">
            {day.feast?.name ?? day.seasonLabel}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {dateLabel} Â· {SUGGESTION_MODE_LABELS[day.suggestionMode]}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/calendar" className="btn">
            Full calendar â†’
          </Link>
          <button
            type="button"
            onClick={onHide}
            className="text-xs text-muted hover:text-terracotta"
            title="Hide the liturgical kitchen from the home page"
          >
            Hide
          </button>
        </div>
      </div>

      {suggestions.length > 0 && (
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {suggestions.map((r) => (
            <RecipeCard key={r.id} recipe={r} />
          ))}
        </div>
      )}
    </section>
  );
}
