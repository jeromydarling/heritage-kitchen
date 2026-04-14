import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { authAvailable, useUser } from '../lib/auth';
import { useCookbook, useRecentCooks, type CookLogEntry } from '../lib/userData';
import { loadAllForIds } from '../lib/recipes';
import type { Recipe } from '../lib/types';
import RecipeCard from '../components/RecipeCard';
import { useHousehold, joinHouseholdByCode } from '../lib/household';
import { supabase } from '../lib/supabase';

/**
 * The signed-in visitor's home base: saved recipes and recent cook-log
 * entries. This is the screen they open when they come back to the site
 * because it's where *their* stuff lives.
 */
export default function CookbookPage() {
  const user = useUser();
  const { entries, loading } = useCookbook();
  const { entries: recentCooks } = useRecentCooks(12);
  const { household, refresh: refreshHousehold } = useHousehold();

  const [savedRecipes, setSavedRecipes] = useState<Recipe[]>([]);
  const [recentRecipes, setRecentRecipes] = useState<Record<string, Recipe>>({});
  const [joinCode, setJoinCode] = useState('');
  const [joinStatus, setJoinStatus] = useState<string | null>(null);
  const [digestOn, setDigestOn] = useState(false);

  useEffect(() => {
    async function loadPrefs() {
      if (!user || !supabase) return;
      const { data } = await supabase
        .from('profiles')
        .select('weekly_digest_enabled, email')
        .eq('user_id', user.id)
        .maybeSingle();
      setDigestOn(!!data?.weekly_digest_enabled);
    }
    void loadPrefs();
  }, [user]);

  async function setDigestPref(enabled: boolean) {
    if (!user || !supabase) return;
    setDigestOn(enabled);
    await supabase.from('profiles').upsert({
      user_id: user.id,
      weekly_digest_enabled: enabled,
      email: user.email ?? null,
    });
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const res = await joinHouseholdByCode(user.id, joinCode);
    if (res.ok) {
      setJoinStatus('Joined.');
      setJoinCode('');
      await refreshHousehold();
    } else {
      setJoinStatus(res.error ?? 'Could not join');
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const ids = new Set<string>();
      entries.forEach((e) => ids.add(e.recipe_id));
      recentCooks.forEach((e) => ids.add(e.recipe_id));
      if (ids.size === 0) return;
      const all = await loadAllForIds([...ids]);
      if (cancelled) return;
      const byId = Object.fromEntries(all.map((r) => [r.id, r]));
      setSavedRecipes(
        entries.map((e) => byId[e.recipe_id]).filter((r): r is Recipe => !!r),
      );
      setRecentRecipes(byId);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [entries, recentCooks]);

  if (!authAvailable) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="font-serif text-3xl">Not configured</h1>
        <p className="mt-3 text-muted">
          This build of the site doesn't have user accounts turned on. Ask
          whoever runs the deploy to configure Supabase.
        </p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="font-serif text-3xl">Your cookbook</h1>
        <p className="mt-3 text-muted">
          Sign in with Google (top right) to start saving recipes, keeping
          private notes, and building a year of your cooking.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-12">
      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-terracotta">Your kitchen</p>
        <h1 className="mt-1 font-serif text-4xl">
          Welcome back,{' '}
          {user.user_metadata?.full_name?.split(' ')[0] ?? 'friend'}.
        </h1>
        <p className="mt-3 text-lg text-muted">
          Everything youâ€™ve saved and everything youâ€™ve cooked, in one place.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="card p-5">
          <h2 className="font-serif text-lg">Your household</h2>
          {household ? (
            <>
              <p className="mt-2 text-sm text-muted">
                <em>{household.name}</em>. Share this code with anyone you
                want cooking from the same plan and shopping list:
              </p>
              <p className="mt-3 font-mono text-xl tracking-widest text-terracotta">
                {household.invite_code}
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted">Creating your householdâ€¦</p>
          )}
          <form onSubmit={handleJoin} className="mt-4 flex gap-2">
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              placeholder="Or enter a code to join"
              className="flex-1 rounded-full border border-rule bg-cream px-3 py-1.5 text-sm uppercase tracking-widest"
            />
            <button type="submit" className="btn">Join</button>
          </form>
          {joinStatus && <p className="mt-2 text-xs text-terracotta">{joinStatus}</p>}
        </div>
        <div className="card p-5">
          <h2 className="font-serif text-lg">Sunday digest</h2>
          <p className="mt-2 text-sm text-muted">
            Once a week we'll email you the week ahead, the upcoming feasts,
            and the recipes you made this time last year.
          </p>
          <label className="mt-4 flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={digestOn}
              onChange={(e) => void setDigestPref(e.target.checked)}
              className="h-4 w-4 rounded border-rule text-terracotta"
            />
            <span>Send me the Sunday evening digest</span>
          </label>
        </div>
      </section>

      <section className="flex flex-wrap gap-3">
        <Link to="/plan" className="btn-primary">Meal plan â†’</Link>
        <Link to="/shopping" className="btn">Shopping list</Link>
        <Link to="/cookbook/build" className="btn">Build a printable cookbook</Link>
      </section>

      <section>
        <div className="mb-6 flex items-end justify-between">
          <h2 className="font-serif text-2xl">Saved recipes</h2>
          <p className="text-xs text-muted">
            {savedRecipes.length} saved
          </p>
        </div>
        {loading && savedRecipes.length === 0 ? (
          <p className="text-muted">Loadingâ€¦</p>
        ) : savedRecipes.length === 0 ? (
          <p className="text-muted">
            Nothing saved yet. Find a recipe you like and tap{' '}
            <em>Save to cookbook</em>.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {savedRecipes.map((r) => (
              <RecipeCard key={r.id} recipe={r} />
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-6 flex items-end justify-between">
          <h2 className="font-serif text-2xl">Recent cook log</h2>
          <p className="text-xs text-muted">{recentCooks.length} entries</p>
        </div>
        {recentCooks.length === 0 ? (
          <p className="text-muted">
            When you log something you cooked, it will show up here as a
            running journal of your year in the kitchen.
          </p>
        ) : (
          <ul className="space-y-3">
            {recentCooks.map((entry) => (
              <CookLogRow
                key={entry.id}
                entry={entry}
                recipe={recentRecipes[entry.recipe_id]}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function CookLogRow({ entry, recipe }: { entry: CookLogEntry; recipe?: Recipe }) {
  const date = new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(entry.cooked_on + 'T00:00:00'));

  return (
    <li className="card flex flex-col gap-2 p-4 sm:flex-row sm:items-baseline sm:justify-between">
      <div>
        <p className="font-serif text-lg">
          {recipe ? (
            <Link to={`/recipe/${recipe.id}`}>{recipe.title}</Link>
          ) : (
            entry.recipe_id
          )}
        </p>
        {entry.liturgical_day && (
          <p className="text-xs italic text-muted">{entry.liturgical_day}</p>
        )}
        {entry.notes && <p className="mt-1 text-sm text-muted">{entry.notes}</p>}
      </div>
      <div className="text-right text-xs text-muted">
        <p>{date}</p>
        {entry.rating && (
          <p className="mt-1 text-terracotta">
            {'â˜…'.repeat(entry.rating)}
            <span className="text-rule">{'â˜…'.repeat(5 - entry.rating)}</span>
          </p>
        )}
      </div>
    </li>
  );
}
