import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { authAvailable, useUser } from '../lib/auth';
import {
  useShoppingList,
  ingredientsOf,
  dedupeIngredients,
} from '../lib/shoppingList';
import { useMealPlan } from '../lib/mealPlan';
import { loadAllForIds } from '../lib/recipes';
import { useHousehold } from '../lib/household';

export default function ShoppingListPage() {
  const user = useUser();
  const { household } = useHousehold();
  const { items, addItem, toggleItem, removeItem, clearChecked } = useShoppingList();
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  // Pull the meal plan for this week so we can offer a one-click
  // "generate shopping list from this week's plan" button.
  const weekStart = startOfWeek(new Date());
  const weekEnd = addDays(weekStart, 6);
  const { entries: plan } = useMealPlan(weekStart, weekEnd);

  useEffect(() => {
    if (!status) return;
    const t = setTimeout(() => setStatus(null), 2500);
    return () => clearTimeout(t);
  }, [status]);

  async function generateFromPlan() {
    if (plan.length === 0) {
      setStatus('No meals planned for this week yet.');
      return;
    }
    setBusy(true);
    const recipes = await loadAllForIds([...new Set(plan.map((e) => e.recipe_id))]);
    const all = dedupeIngredients(
      recipes.flatMap((r) => ingredientsOf(r)),
    );
    const existing = new Set(items.map((i) => i.text.toLowerCase()));
    let added = 0;
    for (const ing of all) {
      if (!existing.has(ing.toLowerCase())) {
        await addItem(ing);
        added++;
      }
    }
    setBusy(false);
    setStatus(`Added ${added} ingredient${added === 1 ? '' : 's'} from ${recipes.length} recipe${recipes.length === 1 ? '' : 's'}.`);
  }

  if (!authAvailable || !user) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="font-serif text-3xl">Shopping list</h1>
        <p className="mt-3 text-muted">
          Sign in to share a running list with the rest of the household.
        </p>
      </div>
    );
  }

  const pending = items.filter((i) => !i.checked);
  const done = items.filter((i) => i.checked);

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-terracotta">
          Bring home
        </p>
        <h1 className="mt-1 font-serif text-4xl">Shopping list</h1>
        {household && (
          <p className="mt-2 text-sm text-muted">
            Shared with <em>{household.name}</em>.
          </p>
        )}
      </header>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void generateFromPlan()}
          disabled={busy}
          className="btn-primary"
        >
          {busy ? 'Addingâ€¦' : 'Generate from this weekâ€™s plan'}
        </button>
        <Link to="/plan" className="btn">
          Meal plan â†’
        </Link>
        {done.length > 0 && (
          <button type="button" onClick={() => void clearChecked()} className="btn">
            Clear {done.length} checked
          </button>
        )}
      </div>

      {status && (
        <p className="rounded-xl bg-paper px-4 py-2 text-sm text-muted">{status}</p>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const v = input.trim();
          if (!v) return;
          void addItem(v);
          setInput('');
        }}
        className="flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Add an item (e.g. 1 quart buttermilk)"
          className="flex-1 rounded-full border border-rule bg-surface px-4 py-2 text-sm"
        />
        <button type="submit" className="btn">
          Add
        </button>
      </form>

      <section>
        <h2 className="font-serif text-lg">To buy</h2>
        <ul className="mt-3 space-y-1">
          {pending.length === 0 && (
            <li className="text-sm italic text-muted">Nothing left.</li>
          )}
          {pending.map((i) => (
            <li
              key={i.id}
              className="flex items-start gap-3 rounded-xl px-3 py-2 hover:bg-paper"
            >
              <input
                type="checkbox"
                checked={false}
                onChange={() => void toggleItem(i.id, true)}
                className="mt-1 h-4 w-4 rounded border-rule text-terracotta"
              />
              <span className="flex-1 text-sm">{i.text}</span>
              <button
                type="button"
                onClick={() => void removeItem(i.id)}
                className="text-xs text-muted hover:text-terracotta"
                aria-label="Remove"
              >
                &times;
              </button>
            </li>
          ))}
        </ul>
      </section>

      {done.length > 0 && (
        <section>
          <h2 className="font-serif text-lg text-muted">Got it</h2>
          <ul className="mt-3 space-y-1">
            {done.map((i) => (
              <li
                key={i.id}
                className="flex items-start gap-3 rounded-xl px-3 py-2"
              >
                <input
                  type="checkbox"
                  checked={true}
                  onChange={() => void toggleItem(i.id, false)}
                  className="mt-1 h-4 w-4 rounded border-rule text-terracotta"
                />
                <span className="flex-1 text-sm text-muted line-through">
                  {i.text}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function startOfWeek(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - x.getDay());
  return x;
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
