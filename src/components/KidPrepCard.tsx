import { useEffect, useState } from 'react';

/**
 * "Before you call the kid over" pre-flight checklist that appears
 * at the top of a recipe page when kid mode is active. Inline and
 * collapsible — once the parent checks everything off, the card
 * minimizes to a one-line "Ready for the kid ✓" pill so it doesn't
 * dominate the rest of the page.
 *
 * Checked state is kept per-recipe in localStorage so a parent who
 * opens the same recipe again next week doesn't start from scratch.
 */

interface Props {
  recipeId: string;
  kidName: string;
  items: string[];
}

export default function KidPrepCard({ recipeId, kidName, items }: Props) {
  const storageKey = `hk:prep:${recipeId}`;
  const [checked, setChecked] = useState<boolean[]>(() =>
    items.map(() => false),
  );

  // Hydrate from localStorage on mount.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length === items.length) {
        setChecked(parsed);
      }
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey, items.length]);

  // Persist whenever the checked state changes.
  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(checked));
    } catch {
      /* ignore */
    }
  }, [checked, storageKey]);

  const allDone = checked.length > 0 && checked.every(Boolean);

  if (items.length === 0) return null;

  if (allDone) {
    return (
      <button
        type="button"
        onClick={() => setChecked(items.map(() => false))}
        className="flex w-full items-center gap-3 rounded-2xl border border-sage/40 bg-sage/10 px-4 py-3 text-left text-sm text-sage-dark transition hover:bg-sage/15"
      >
        <span className="text-base">✓</span>
        <span className="font-serif">
          Ready for {kidName}. Call them in.
        </span>
        <span className="ml-auto text-xs text-muted">Reset</span>
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-sage/40 bg-sage/5 p-5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-sage-dark">
        Before you call {kidName} over
      </p>
      <p className="mt-1 font-serif text-lg text-ink">
        A few things to get ready first.
      </p>
      <ul className="mt-4 space-y-2">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-3">
            <input
              id={`prep-${i}`}
              type="checkbox"
              checked={!!checked[i]}
              onChange={(e) => {
                const next = [...checked];
                next[i] = e.target.checked;
                setChecked(next);
              }}
              className="mt-1 h-4 w-4 rounded border-rule text-sage focus:ring-sage"
            />
            <label
              htmlFor={`prep-${i}`}
              className={
                checked[i]
                  ? 'text-sm text-muted line-through'
                  : 'text-sm leading-relaxed text-ink'
              }
            >
              {item}
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
