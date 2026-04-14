import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { authAvailable, useUser } from '../lib/auth';
import { useMealPlan, type MealPlanEntry } from '../lib/mealPlan';
import { loadAllForIds, loadRecipes, searchRecipes } from '../lib/recipes';
import { getLiturgicalDay } from '../lib/liturgical';
import { useHousehold } from '../lib/household';
import type { Recipe } from '../lib/types';

/**
 * Week-view meal planner. Click a day to add a recipe; click a planned
 * recipe to open it. Each day shows its date and the liturgical day so
 * you can plan Lent around fish Fridays without consulting a calendar.
 */
export default function MealPlanPage() {
  const user = useUser();
  const { household } = useHousehold();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const weekEnd = useMemo(() => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 6);
    return d;
  }, [weekStart]);

  const { entries, addEntry, removeEntry } = useMealPlan(weekStart, weekEnd);
  const [recipeById, setRecipeById] = useState<Record<string, Recipe>>({});
  const [addingOnDate, setAddingOnDate] = useState<Date | null>(null);

  useEffect(() => {
    const ids = [...new Set(entries.map((e) => e.recipe_id))];
    if (ids.length === 0) return;
    void loadAllForIds(ids).then((list) => {
      setRecipeById((prev) => ({
        ...prev,
        ...Object.fromEntries(list.map((r) => [r.id, r])),
      }));
    });
  }, [entries]);

  if (!authAvailable || !user) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="font-serif text-3xl">Meal plan</h1>
        <p className="mt-3 text-muted">
          Sign in to plan the week, share the plan with your household, and
          build a shopping list straight from it.
        </p>
      </div>
    );
  }

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-terracotta">
            The week ahead
          </p>
          <h1 className="mt-1 font-serif text-4xl">Meal plan</h1>
          {household && (
            <p className="mt-2 text-sm text-muted">
              For <em>{household.name}</em>. Share this plan with another
              household member using the invite code{' '}
              <code className="rounded bg-paper px-1.5 py-0.5 font-mono text-terracotta">
                {household.invite_code}
              </code>{' '}
              (they can enter it from their own{' '}
              <Link to="/cookbook">cookbook page</Link>).
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekStart(addDays(weekStart, -7))}
            className="btn"
          >
            â† Previous
          </button>
          <button
            onClick={() => setWeekStart(startOfWeek(new Date()))}
            className="btn"
          >
            This week
          </button>
          <button
            onClick={() => setWeekStart(addDays(weekStart, 7))}
            className="btn"
          >
            Next â†’
          </button>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
        {days.map((d) => (
          <DayCell
            key={d.toISOString()}
            date={d}
            entries={entries.filter((e) => e.planned_on === isoDate(d))}
            recipeById={recipeById}
            onAddClick={() => setAddingOnDate(d)}
            onRemove={(id) => void removeEntry(id)}
          />
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <Link to="/shopping" className="btn-primary">
          Build a shopping list â†’
        </Link>
      </div>

      {addingOnDate && (
        <AddRecipeModal
          date={addingOnDate}
          onClose={() => setAddingOnDate(null)}
          onPick={async (r) => {
            await addEntry(addingOnDate, r.id);
            setAddingOnDate(null);
          }}
        />
      )}
    </div>
  );
}

function DayCell({
  date,
  entries,
  recipeById,
  onAddClick,
  onRemove,
}: {
  date: Date;
  entries: MealPlanEntry[];
  recipeById: Record<string, Recipe>;
  onAddClick: () => void;
  onRemove: (id: string) => void;
}) {
  const lit = useMemo(() => getLiturgicalDay(date), [date]);
  const today = new Date();
  const isToday =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();

  return (
    <div
      className={`card flex min-h-[220px] flex-col p-4 ${
        isToday ? 'border-terracotta/60' : ''
      }`}
    >
      <div>
        <p className="text-xs uppercase tracking-widest text-muted">
          {new Intl.DateTimeFormat(undefined, {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
          }).format(date)}
        </p>
        <p
          className={`mt-0.5 text-xs italic ${
            lit.feast ? 'text-terracotta' : 'text-muted'
          }`}
        >
          {lit.feast?.name ?? lit.seasonLabel}
          {lit.isAbstinence && !lit.feast && ' Â· fish Friday'}
        </p>
      </div>

      <ul className="mt-3 flex-1 space-y-2">
        {entries.length === 0 && (
          <li className="text-xs italic text-muted">Nothing planned</li>
        )}
        {entries.map((e) => {
          const r = recipeById[e.recipe_id];
          return (
            <li key={e.id} className="group flex items-start justify-between gap-2">
              <Link
                to={`/recipe/${e.recipe_id}`}
                className="text-sm leading-tight"
              >
                {r ? r.title : e.recipe_id}
              </Link>
              <button
                type="button"
                onClick={() => onRemove(e.id)}
                className="text-xs text-muted opacity-0 group-hover:opacity-100 hover:text-terracotta"
                aria-label="Remove"
              >
                &times;
              </button>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        onClick={onAddClick}
        className="mt-3 w-full rounded-full border border-dashed border-rule py-1.5 text-xs text-muted hover:border-terracotta hover:text-terracotta"
      >
        + Add a recipe
      </button>
    </div>
  );
}

function AddRecipeModal({
  date,
  onClose,
  onPick,
}: {
  date: Date;
  onClose: () => void;
  onPick: (r: Recipe) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Recipe[]>([]);
  const [fallback, setFallback] = useState<Recipe[]>([]);

  useEffect(() => {
    void loadRecipes().then((r) => setFallback(r.slice(0, 12)));
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      const list = await searchRecipes(query);
      setResults(list.filter((r) => r.content_type !== 'essay').slice(0, 20));
    }, 150);
    return () => clearTimeout(t);
  }, [query]);

  const show = query.trim() ? results : fallback;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-ink/30 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        className="mt-10 w-full max-w-xl rounded-3xl border border-rule bg-surface p-6 shadow-card sm:mt-0"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-serif text-xl">
          Add a recipe for{' '}
          {new Intl.DateTimeFormat(undefined, {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          }).format(date)}
        </h2>
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search the library"
          className="mt-4 w-full rounded-full border border-rule bg-cream px-4 py-2 text-sm"
        />
        <ul className="mt-4 max-h-80 space-y-1 overflow-y-auto">
          {show.length === 0 && (
            <li className="py-4 text-center text-sm text-muted">
              Type to search the library.
            </li>
          )}
          {show.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => onPick(r)}
                className="flex w-full items-baseline justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm hover:bg-paper"
              >
                <span className="font-serif">{r.title}</span>
                <span className="text-xs text-muted">
                  {r.source_book} Â· {r.source_year}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex justify-end">
          <button type="button" onClick={onClose} className="btn">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- Date helpers ----

function startOfWeek(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const dow = x.getDay(); // Sunday = 0
  x.setDate(x.getDate() - dow);
  return x;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
