import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authAvailable, useUser } from '../lib/auth';
import { useCookbook } from '../lib/userData';
import { loadAllForIds } from '../lib/recipes';
import type { Recipe } from '../lib/types';
import { supabase } from '../lib/supabase';

/**
 * Step 1 of the Lulu cookbook flow: pick recipes and give the book a
 * title + dedication. We save it as a draft `cookbook_projects` row so
 * the user can come back to it, then send them to /print/cookbook/:id
 * which is the print-optimized view they can "Save as PDF" and upload to
 * Lulu.
 *
 * We deliberately do NOT talk to the Lulu Print API from the client â€” it
 * requires server-side credentials, webhooks, and a real Lulu developer
 * account. The plan is to ship a PDF-export-and-upload flow now and
 * upgrade to full API integration later.
 */
export default function CookbookBuilderPage() {
  const user = useUser();
  const { entries } = useCookbook();
  const navigate = useNavigate();

  const [savedRecipes, setSavedRecipes] = useState<Recipe[]>([]);
  const [title, setTitle] = useState('Our Heritage Kitchen');
  const [subtitle, setSubtitle] = useState('');
  const [dedication, setDedication] = useState('For our family, past and present.');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      if (entries.length === 0) {
        setSavedRecipes([]);
        return;
      }
      const list = await loadAllForIds(entries.map((e) => e.recipe_id));
      setSavedRecipes(list);
      // Default to all saved recipes picked
      setPicked(new Set(list.map((r) => r.id)));
    }
    void load();
  }, [entries]);

  const pickedList = useMemo(
    () => savedRecipes.filter((r) => picked.has(r.id)),
    [savedRecipes, picked],
  );

  function togglePick(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function createAndPreview() {
    if (!user || !supabase || pickedList.length === 0) return;
    setSaving(true);
    const { data, error } = await supabase
      .from('cookbook_projects')
      .insert({
        user_id: user.id,
        title,
        subtitle: subtitle || null,
        dedication: dedication || null,
        recipe_ids: pickedList.map((r) => r.id),
      })
      .select('id')
      .single();
    setSaving(false);
    if (error || !data) return;
    navigate(`/print/cookbook/${data.id}`);
  }

  if (!authAvailable || !user) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="font-serif text-3xl">Build a printable cookbook</h1>
        <p className="mt-3 text-muted">
          Sign in to turn your saved recipes into a printable family
          cookbook you can order from Lulu.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-terracotta">
          Heirloom in progress
        </p>
        <h1 className="mt-1 font-serif text-4xl">Build a printable cookbook</h1>
        <p className="mt-3 text-lg leading-relaxed text-muted">
          Turn the recipes you've saved into a real cookbook. We'll lay it
          out in our house typography, you save it as a PDF, and Lulu
          prints and ships it anywhere in the world.
        </p>
      </header>

      <section className="card space-y-4 p-6">
        <h2 className="font-serif text-xl">Title page</h2>
        <label className="block text-sm">
          <span className="text-muted">Title</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full rounded-full border border-rule bg-cream px-4 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="text-muted">Subtitle (optional)</span>
          <input
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            placeholder="e.g. Recipes for the Darling family"
            className="mt-1 w-full rounded-full border border-rule bg-cream px-4 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="text-muted">Dedication (optional)</span>
          <textarea
            rows={3}
            value={dedication}
            onChange={(e) => setDedication(e.target.value)}
            className="mt-1 w-full rounded-2xl border border-rule bg-cream p-3"
          />
        </label>
      </section>

      <section>
        <h2 className="font-serif text-xl">
          Recipes ({pickedList.length}/{savedRecipes.length})
        </h2>
        {savedRecipes.length === 0 ? (
          <p className="mt-3 text-muted">
            You haven't saved any recipes yet. Find a few you love and{' '}
            <Link to="/">browse the library</Link>.
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {savedRecipes.map((r) => (
              <li key={r.id}>
                <label className="flex cursor-pointer items-start gap-3 rounded-xl px-3 py-2 hover:bg-paper">
                  <input
                    type="checkbox"
                    checked={picked.has(r.id)}
                    onChange={() => togglePick(r.id)}
                    className="mt-1 h-4 w-4 rounded border-rule text-terracotta"
                  />
                  <span className="flex-1">
                    <span className="font-serif text-base">{r.title}</span>
                    <span className="block text-xs text-muted">
                      {r.source_book} Â· {r.source_year}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={pickedList.length === 0 || saving}
          onClick={() => void createAndPreview()}
          className="btn-primary"
        >
          {saving ? 'Savingâ€¦' : 'Preview printable view â†’'}
        </button>
      </section>

      <section className="card space-y-3 bg-paper p-6 text-sm leading-relaxed text-muted">
        <h2 className="font-serif text-lg text-ink">How printing works</h2>
        <p>
          When you preview the printable view, your browser's "Save as PDF"
          will produce a Lulu-ready file at US Letter size. Upload it to{' '}
          <a href="https://www.lulu.com" target="_blank" rel="noreferrer">
            Lulu.com
          </a>
          's print-on-demand service, pick your cover and paper stock, and
          they'll ship a bound copy to you in about a week. We don't
          charge for any of this; Lulu's price (usually $15â€“$40 for a
          softcover family cookbook) is what you pay.
        </p>
        <p>
          Later on we'll add direct ordering through Lulu's API so you
          won't have to leave the site. For now, manual upload is the
          simplest way to get a real book in your hands.
        </p>
      </section>
    </div>
  );
}
