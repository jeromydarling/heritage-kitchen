import { useEffect, useMemo, useState } from 'react';
import { loadRecipes } from '../lib/recipes';
import { regenerateRecipeImage } from '../lib/images';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { CATEGORIES, SOURCE_BOOKS, type Recipe } from '../lib/types';
import RecipeImage from '../components/RecipeImage';

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [bookFilter, setBookFilter] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;
    supabase.auth.getSession().then(({ data }) => setAuthed(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthed(!!session);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    loadRecipes().then(setRecipes);
  }, []);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!supabase) return;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
  }

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
  }

  async function regenerate(recipe: Recipe) {
    setBusy(recipe.id);
    const url = await regenerateRecipeImage(recipe);
    setRecipes((prev) =>
      prev.map((r) => (r.id === recipe.id ? { ...r, image_url: url ?? null } : r)),
    );
    setBusy(null);
  }

  async function bulkRegenerate(predicate: (r: Recipe) => boolean) {
    const targets = filtered.filter(predicate);
    if (!confirm(`Regenerate ${targets.length} images? This may take a while.`)) return;
    for (const r of targets) {
      setBusy(r.id);
      // Intentionally sequential to avoid rate limits.
      // eslint-disable-next-line no-await-in-loop
      await regenerateRecipeImage(r);
    }
    setBusy(null);
    const refreshed = await loadRecipes();
    setRecipes(refreshed);
  }

  const filtered = useMemo(
    () =>
      recipes.filter((r) => {
        if (categoryFilter && r.category !== categoryFilter) return false;
        if (bookFilter && r.source_book !== bookFilter) return false;
        return true;
      }),
    [recipes, categoryFilter, bookFilter],
  );

  if (!isSupabaseConfigured) {
    return (
      <div className="max-w-xl space-y-4">
        <h1 className="font-serif text-3xl">Admin</h1>
        <p className="text-muted">
          The admin interface requires Supabase to be configured. Add{' '}
          <code className="rounded bg-paper px-1">VITE_SUPABASE_URL</code> and{' '}
          <code className="rounded bg-paper px-1">VITE_SUPABASE_ANON_KEY</code> to your build
          environment and sign in as the admin user.
        </p>
      </div>
    );
  }

  if (!authed) {
    return (
      <form onSubmit={signIn} className="mx-auto max-w-sm space-y-4">
        <h1 className="font-serif text-3xl">Admin sign-in</h1>
        <label className="block text-sm">
          <span className="text-muted">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-full border border-rule bg-surface px-4 py-2"
            required
          />
        </label>
        <label className="block text-sm">
          <span className="text-muted">Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-full border border-rule bg-surface px-4 py-2"
            required
          />
        </label>
        {error && <p className="text-sm text-terracotta">{error}</p>}
        <button type="submit" className="btn-primary w-full justify-center">
          Sign in
        </button>
      </form>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-4xl">Image admin</h1>
          <p className="text-sm text-muted">
            Regenerate AI illustrations for individual recipes or in bulk.
          </p>
        </div>
        <button onClick={signOut} className="btn">
          Sign out
        </button>
      </header>

      <div className="flex flex-wrap gap-2">
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-full border border-rule bg-surface px-3 py-1.5 text-sm"
        >
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.label}
            </option>
          ))}
        </select>
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
        <button onClick={() => bulkRegenerate(() => true)} className="btn">
          Regenerate all ({filtered.length})
        </button>
        <button onClick={() => bulkRegenerate((r) => !r.image_url)} className="btn">
          Fill missing only
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filtered.slice(0, 120).map((r) => (
          <div key={r.id} className="card overflow-hidden">
            <div className="aspect-[4/3] border-b border-rule">
              <RecipeImage recipe={r} className="h-full w-full object-cover" />
            </div>
            <div className="space-y-2 p-3 text-sm">
              <p className="font-serif text-base leading-tight">{r.title}</p>
              <p className="text-xs text-muted">
                {r.source_book} Â· {r.source_year}
              </p>
              <button
                onClick={() => regenerate(r)}
                disabled={busy === r.id}
                className="btn w-full justify-center"
              >
                {busy === r.id ? 'Regeneratingâ€¦' : 'Regenerate'}
              </button>
            </div>
          </div>
        ))}
      </div>
      {filtered.length > 120 && (
        <p className="text-sm text-muted">Showing first 120 of {filtered.length}. Narrow the filter to see more.</p>
      )}
    </div>
  );
}
