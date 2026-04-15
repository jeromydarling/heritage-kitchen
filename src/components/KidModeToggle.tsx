import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useUser } from '../lib/auth';
import { useKids, type AvatarColor } from '../lib/kids';

/**
 * Header toggle for "Cook with kids" mode.
 *
 * When off, renders a small icon button labelled "Kid mode". When on,
 * renders the active kid's name with a colored dot — a visible
 * reminder that the site is currently rendering for a shared cook.
 * Clicking opens a popover with the household's kids so the parent
 * can switch between profiles or turn the mode off.
 */

const COLOR_TO_CLASS: Record<AvatarColor, string> = {
  terracotta: 'bg-terracotta',
  sage: 'bg-sage',
  cream: 'bg-cream border border-rule',
  ink: 'bg-ink',
  butter: 'bg-butter',
  plum: 'bg-plum',
  sky: 'bg-sky',
};

export default function KidModeToggle() {
  const user = useUser();
  const { kids, activeKid, activeKidId, setActiveKidId, kidModeOn, setKidModeOn } =
    useKids();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close the popover on outside click.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  if (!user) return null;

  const dotColor = activeKid ? COLOR_TO_CLASS[activeKid.avatar_color] : 'bg-sage';

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition ${
          kidModeOn
            ? 'border-sage/50 bg-sage/15 text-ink'
            : 'border-rule bg-surface text-ink hover:border-sage/40'
        }`}
        aria-label={kidModeOn ? `Cooking with ${activeKid?.name}` : 'Turn on kid mode'}
        aria-expanded={open}
      >
        <span className={`h-2.5 w-2.5 rounded-full ${dotColor}`} />
        <span className="font-serif">
          {kidModeOn && activeKid ? `with ${activeKid.name}` : 'Kid mode'}
        </span>
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-2 w-64 rounded-2xl border border-rule bg-cream p-2 shadow-card">
          <p className="px-3 pb-1 pt-2 text-[10px] uppercase tracking-[0.2em] text-muted">
            Cook with kids
          </p>
          {kids.length === 0 ? (
            <div className="space-y-2 p-3">
              <p className="text-sm text-ink/80">
                No kids yet. Add a profile to start cooking together.
              </p>
              <Link
                to="/household"
                onClick={() => setOpen(false)}
                className="btn-primary block text-center text-sm"
              >
                Add a kid
              </Link>
            </div>
          ) : (
            <ul className="space-y-1">
              {kids.map((k) => {
                const active = kidModeOn && activeKidId === k.id;
                return (
                  <li key={k.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveKidId(k.id);
                        setKidModeOn(true);
                        setOpen(false);
                      }}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition ${
                        active ? 'bg-sage/15' : 'hover:bg-paper'
                      }`}
                    >
                      <span
                        className={`h-3 w-3 rounded-full ${COLOR_TO_CLASS[k.avatar_color]}`}
                      />
                      <span className="flex-1 font-serif">{k.name}</span>
                      <span className="text-xs text-muted">age {k.age}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="mt-2 flex gap-2 border-t border-rule pt-2">
            {kidModeOn && (
              <button
                type="button"
                onClick={() => {
                  setKidModeOn(false);
                  setOpen(false);
                }}
                className="flex-1 rounded-full border border-rule px-3 py-1.5 text-xs text-ink hover:border-terracotta/40"
              >
                Turn off
              </button>
            )}
            <Link
              to="/household"
              onClick={() => setOpen(false)}
              className="flex-1 rounded-full border border-rule px-3 py-1.5 text-center text-xs text-ink hover:border-terracotta/40 !no-underline"
            >
              Manage kids
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
