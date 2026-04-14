import { useMemo, useState } from 'react';
import { authAvailable, useUser } from '../lib/auth';
import { useCookLog, useIsSaved, useRecipeNote } from '../lib/userData';
import { addToNextOpenDay } from '../lib/mealPlan';
import { useShoppingList, ingredientsOf } from '../lib/shoppingList';
import type { Recipe } from '../lib/types';

/**
 * The personal sidebar for a recipe when you're signed in:
 *   - Save / unsave to your cookbook
 *   - A year-over-year "last cooked" memory surface
 *   - A tiny cook log form (date + rating + notes + button)
 *   - A private notes editor
 *
 * When auth is not available or the user is signed out, only a prompt to
 * sign in is shown.
 */
export default function RecipeActions({ recipe }: { recipe: Recipe }) {
  const recipeId = recipe.id;
  const user = useUser();
  const { saved, toggle: toggleSave } = useIsSaved(recipeId);
  const { entries: log, logCook, deleteEntry } = useCookLog(recipeId);
  const noteState = useRecipeNote(recipeId);
  const { addItem: addShoppingItem } = useShoppingList();
  const [rating, setRating] = useState<number | null>(null);
  const [cookNote, setCookNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [planStatus, setPlanStatus] = useState<string | null>(null);
  const [listStatus, setListStatus] = useState<string | null>(null);

  const memory = useMemo(() => findYearOverYear(log), [log]);

  if (!authAvailable) {
    return null;
  }

  if (!user) {
    return (
      <div className="card p-5">
        <h3 className="font-serif text-lg">Make it yours</h3>
        <p className="mt-2 text-sm text-muted">
          Sign in to save this recipe, keep private notes, and build a year
          of your cooking.
        </p>
      </div>
    );
  }

  async function handleLog() {
    setBusy(true);
    await logCook({ rating, notes: cookNote || undefined });
    setCookNote('');
    setRating(null);
    setBusy(false);
  }

  async function handleAddToPlan() {
    if (!user) return;
    const d = await addToNextOpenDay(
      user.id,
      user.user_metadata?.full_name ?? user.email,
      recipeId,
    );
    if (d) {
      const label = new Intl.DateTimeFormat(undefined, {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
      }).format(d);
      setPlanStatus(`Added to ${label}`);
      setTimeout(() => setPlanStatus(null), 3000);
    }
  }

  async function handleAddToShopping() {
    const ings = ingredientsOf(recipe);
    if (ings.length === 0) {
      setListStatus('No ingredient list on this recipe.');
      setTimeout(() => setListStatus(null), 3000);
      return;
    }
    for (const ing of ings) {
      await addShoppingItem(ing, recipeId);
    }
    setListStatus(`Added ${ings.length} item${ings.length === 1 ? '' : 's'} to the shopping list.`);
    setTimeout(() => setListStatus(null), 3000);
  }

  return (
    <div className="space-y-4">
      {/* Save / unsave + quick actions */}
      <div className="card space-y-2 p-5 print:hidden">
        <button
          type="button"
          onClick={() => void toggleSave()}
          className={`btn w-full justify-center ${
            saved ? '!border-terracotta !text-terracotta' : ''
          }`}
        >
          {saved ? 'âœ“ Saved to your cookbook' : 'Save to cookbook'}
        </button>
        <button
          type="button"
          onClick={() => void handleAddToPlan()}
          className="btn w-full justify-center"
        >
          Add to meal plan
        </button>
        {planStatus && <p className="text-center text-xs text-terracotta">{planStatus}</p>}
        <button
          type="button"
          onClick={() => void handleAddToShopping()}
          className="btn w-full justify-center"
        >
          Add ingredients to shopping list
        </button>
        {listStatus && <p className="text-center text-xs text-terracotta">{listStatus}</p>}
        <button
          type="button"
          onClick={() => window.print()}
          className="btn w-full justify-center"
        >
          Print recipe
        </button>
      </div>

      {/* Year-over-year memory */}
      {memory && (
        <div className="card border-terracotta/40 bg-terracotta/5 p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-terracotta">
            You've made this before
          </p>
          <p className="mt-2 text-sm leading-relaxed text-ink">
            {memory.anniversary
              ? `Last year around this time â€” on ${formatDate(memory.entry.cooked_on)}${
                  memory.entry.liturgical_day ? `, ${memory.entry.liturgical_day}` : ''
                } â€” you made this. Want to make it again?`
              : `You last cooked this on ${formatDate(memory.entry.cooked_on)}${
                  memory.entry.liturgical_day ? ` (${memory.entry.liturgical_day})` : ''
                }.`}
          </p>
        </div>
      )}

      {/* Cook log */}
      <div className="card p-5">
        <h3 className="font-serif text-lg">I cooked this</h3>
        <p className="mt-1 text-xs text-muted">
          Keep a little record. A year from now, this will mean something.
        </p>
        <div className="mt-3">
          <StarRow value={rating} onChange={setRating} />
        </div>
        <textarea
          value={cookNote}
          onChange={(e) => setCookNote(e.target.value)}
          placeholder="A line about how it went (optional)"
          rows={2}
          className="mt-3 w-full rounded-xl border border-rule bg-cream p-2 text-sm"
        />
        <button
          type="button"
          onClick={handleLog}
          disabled={busy}
          className="btn-primary mt-3 w-full justify-center"
        >
          {busy ? 'Savingâ€¦' : 'Log that I made this today'}
        </button>

        {log.length > 0 && (
          <ul className="mt-5 space-y-3 border-t border-rule pt-4">
            {log.slice(0, 8).map((e) => (
              <li key={e.id} className="text-xs">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-semibold text-ink">
                    {formatDate(e.cooked_on)}
                    {e.liturgical_day && (
                      <span className="ml-2 font-normal italic text-muted">
                        {e.liturgical_day}
                      </span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => void deleteEntry(e.id)}
                    className="text-muted hover:text-terracotta"
                    aria-label="Delete entry"
                  >
                    &times;
                  </button>
                </div>
                {e.rating && <Stars value={e.rating} />}
                {e.notes && <p className="mt-1 text-muted">{e.notes}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Private notes */}
      {saved && (
        <div className="card p-5">
          <h3 className="font-serif text-lg">Your notes</h3>
          <p className="mt-1 text-xs text-muted">
            Only you can see these. &ldquo;Mum used more nutmeg.&rdquo;
          </p>
          <textarea
            value={noteState.note}
            onChange={(e) => noteState.setNote(e.target.value)}
            rows={5}
            className="mt-3 w-full rounded-xl border border-rule bg-cream p-3 text-sm leading-relaxed"
          />
          <button
            type="button"
            disabled={!noteState.dirty || noteState.loading}
            onClick={() => void noteState.save()}
            className="btn mt-2 w-full justify-center disabled:opacity-50"
          >
            {noteState.loading
              ? 'Savingâ€¦'
              : noteState.dirty
                ? 'Save notes'
                : 'Saved'}
          </button>
        </div>
      )}
    </div>
  );
}

// ---------- helpers ----------

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return new Intl.DateTimeFormat(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(d);
}

/**
 * Returns the most relevant past cook, preferring an "anniversary hit"
 * within Â±21 days of the same day last year, else the most recent cook.
 */
function findYearOverYear(log: { cooked_on: string; liturgical_day: string | null }[]) {
  if (log.length === 0) return null;
  const now = new Date();
  const oneYear = 365 * 24 * 60 * 60 * 1000;
  const targetLast = now.getTime() - oneYear;
  const windowMs = 21 * 24 * 60 * 60 * 1000;

  const annotated = log.map((e) => ({
    entry: e,
    ts: new Date(e.cooked_on + 'T00:00:00').getTime(),
  }));

  const anniversary = annotated.find(
    (x) => Math.abs(x.ts - targetLast) < windowMs,
  );
  if (anniversary) return { entry: anniversary.entry, anniversary: true };

  // Fall back to the most recent entry
  return { entry: annotated[0].entry, anniversary: false };
}

function StarRow({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(value === n ? null : n)}
          className={`text-lg ${value && n <= value ? 'text-terracotta' : 'text-rule'}`}
          aria-label={`${n} stars`}
        >
          â˜…
        </button>
      ))}
      <span className="ml-2 text-xs text-muted">{value ? `${value}/5` : 'Rating (optional)'}</span>
    </div>
  );
}

function Stars({ value }: { value: number }) {
  return (
    <div className="text-terracotta">
      {'â˜…'.repeat(value)}
      <span className="text-rule">{'â˜…'.repeat(5 - value)}</span>
    </div>
  );
}
