import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { useUser } from './auth';
import { getLiturgicalDay } from './liturgical';

/**
 * Hooks and helpers for per-user data: cookbook saves, private notes, and
 * the cook log. All reads/writes go through Supabase and are protected by
 * row-level security policies, so clients can only touch their own rows.
 *
 * When there is no signed-in user (or Supabase is not configured) the
 * hooks return empty state and the mutation helpers are no-ops.
 */

export interface CookbookEntry {
  recipe_id: string;
  saved_at: string;
  notes: string | null;
}

export interface CookLogEntry {
  id: string;
  recipe_id: string;
  cooked_on: string; // ISO date
  rating: number | null;
  notes: string | null;
  liturgical_day: string | null;
  liturgical_season: string | null;
  kid_id: string | null;
  created_at: string;
}

// ---------- Cookbook ----------

export function useCookbook() {
  const user = useUser();
  const [entries, setEntries] = useState<CookbookEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user || !supabase) {
      setEntries([]);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('cookbook_entries')
      .select('recipe_id, saved_at, notes')
      .eq('user_id', user.id)
      .order('saved_at', { ascending: false });
    setLoading(false);
    if (!error && data) setEntries(data as CookbookEntry[]);
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { entries, loading, refresh };
}

export function useIsSaved(recipeId: string): {
  saved: boolean;
  loading: boolean;
  toggle: () => Promise<void>;
} {
  const user = useUser();
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      if (!user || !supabase) {
        setSaved(false);
        return;
      }
      const { data } = await supabase
        .from('cookbook_entries')
        .select('recipe_id')
        .eq('user_id', user.id)
        .eq('recipe_id', recipeId)
        .maybeSingle();
      if (!cancelled) setSaved(!!data);
    }
    void check();
    return () => {
      cancelled = true;
    };
  }, [user, recipeId]);

  const toggle = useCallback(async () => {
    if (!user || !supabase) return;
    setLoading(true);
    if (saved) {
      await supabase
        .from('cookbook_entries')
        .delete()
        .eq('user_id', user.id)
        .eq('recipe_id', recipeId);
      setSaved(false);
    } else {
      await supabase.from('cookbook_entries').upsert({
        user_id: user.id,
        recipe_id: recipeId,
      });
      setSaved(true);
    }
    setLoading(false);
  }, [user, recipeId, saved]);

  return { saved, loading, toggle };
}

// ---------- Private notes (stored on the cookbook entry) ----------

export function useRecipeNote(recipeId: string) {
  const user = useUser();
  const [note, setNote] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!user || !supabase) {
        setNote('');
        return;
      }
      const { data } = await supabase
        .from('cookbook_entries')
        .select('notes')
        .eq('user_id', user.id)
        .eq('recipe_id', recipeId)
        .maybeSingle();
      if (!cancelled) setNote(data?.notes ?? '');
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [user, recipeId]);

  const save = useCallback(
    async (value: string) => {
      if (!user || !supabase) return;
      setLoading(true);
      await supabase.from('cookbook_entries').upsert({
        user_id: user.id,
        recipe_id: recipeId,
        notes: value,
      });
      setLoading(false);
      setDirty(false);
    },
    [user, recipeId],
  );

  return {
    note,
    setNote: (v: string) => {
      setNote(v);
      setDirty(true);
    },
    save: () => save(note),
    loading,
    dirty,
  };
}

// ---------- Cook log ----------

export function useCookLog(recipeId: string) {
  const user = useUser();
  const [entries, setEntries] = useState<CookLogEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user || !supabase) {
      setEntries([]);
      return;
    }
    const { data } = await supabase
      .from('cook_log')
      .select('*')
      .eq('user_id', user.id)
      .eq('recipe_id', recipeId)
      .order('cooked_on', { ascending: false });
    if (data) setEntries(data as CookLogEntry[]);
  }, [user, recipeId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const logCook = useCallback(
    async (opts: {
      rating?: number | null;
      notes?: string;
      cookedOn?: Date;
      kidId?: string | null;
    }) => {
      if (!user || !supabase) return;
      const when = opts.cookedOn ?? new Date();
      const lit = getLiturgicalDay(when);
      setLoading(true);
      await supabase.from('cook_log').insert({
        user_id: user.id,
        recipe_id: recipeId,
        cooked_on: when.toISOString().slice(0, 10),
        rating: opts.rating ?? null,
        notes: opts.notes ?? null,
        liturgical_day: lit.feast?.name ?? lit.seasonLabel,
        liturgical_season: lit.seasonLabel,
        kid_id: opts.kidId ?? null,
      });
      setLoading(false);
      await refresh();
    },
    [user, recipeId, refresh],
  );

  const deleteEntry = useCallback(
    async (id: string) => {
      if (!user || !supabase) return;
      await supabase.from('cook_log').delete().eq('id', id).eq('user_id', user.id);
      await refresh();
    },
    [user, refresh],
  );

  return { entries, loading, logCook, deleteEntry, refresh };
}

/**
 * Every cook log entry tagged with a specific kid's id, ordered
 * newest first. Powers the per-kid journal page — the parent's
 * running record of every dish they've cooked with a kid.
 */
export function useKidJournal(kidId: string | null) {
  const user = useUser();
  const [entries, setEntries] = useState<CookLogEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!user || !supabase || !kidId) {
        setEntries([]);
        return;
      }
      setLoading(true);
      const { data } = await supabase
        .from('cook_log')
        .select('*')
        .eq('user_id', user.id)
        .eq('kid_id', kidId)
        .order('cooked_on', { ascending: false });
      setLoading(false);
      if (!cancelled && data) setEntries(data as CookLogEntry[]);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [user, kidId]);

  return { entries, loading };
}

/** Recent cooks across all recipes, for the /cookbook page. */
export function useRecentCooks(limit = 25) {
  const user = useUser();
  const [entries, setEntries] = useState<CookLogEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!user || !supabase) {
        setEntries([]);
        return;
      }
      setLoading(true);
      const { data } = await supabase
        .from('cook_log')
        .select('*')
        .eq('user_id', user.id)
        .order('cooked_on', { ascending: false })
        .limit(limit);
      setLoading(false);
      if (!cancelled && data) setEntries(data as CookLogEntry[]);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [user, limit]);

  return { entries, loading };
}
