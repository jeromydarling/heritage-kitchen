import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { useUser } from './auth';
import { ensureHousehold } from './household';

/**
 * "Cook with kids" mode — per-household kid profiles.
 *
 * A household can have any number of named kid profiles. Each has a
 * name, an age (which shifts the kid/grown-up task split in the recipe
 * view), and an avatar color that tints the header when that kid is
 * active. The active kid is stored in localStorage so the mode
 * persists across page loads without another Supabase round-trip.
 *
 * When kid mode is on and a kid is selected, cook_log entries made
 * from the recipe page get tagged with that kid_id — the parent's
 * running journal of every dish they've cooked together.
 */

export type AvatarColor =
  | 'terracotta'
  | 'sage'
  | 'cream'
  | 'ink'
  | 'butter'
  | 'plum'
  | 'sky';

export const AVATAR_COLORS: AvatarColor[] = [
  'terracotta',
  'sage',
  'butter',
  'plum',
  'sky',
  'ink',
  'cream',
];

export interface Kid {
  id: string;
  household_id: string;
  name: string;
  age: number;
  avatar_color: AvatarColor;
  created_at: string;
}

const ACTIVE_KID_KEY = 'hk:active-kid-id';
const KID_MODE_KEY = 'hk:kid-mode-on';

function readLocal(key: string): string | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
  } catch {
    return null;
  }
}

function writeLocal(key: string, value: string | null): void {
  try {
    if (typeof window === 'undefined') return;
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

/**
 * React hook that loads the household's kids and exposes CRUD plus the
 * active-kid / kid-mode session state. Components can subscribe to this
 * hook anywhere — the kid list is re-fetched on refresh() calls.
 */
export function useKids() {
  const user = useUser();
  const [kids, setKids] = useState<Kid[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeKidId, setActiveKidIdState] = useState<string | null>(() =>
    readLocal(ACTIVE_KID_KEY),
  );
  const [kidModeOn, setKidModeOnState] = useState<boolean>(
    () => readLocal(KID_MODE_KEY) === '1',
  );

  const refresh = useCallback(async () => {
    if (!user || !supabase) {
      setKids([]);
      return;
    }
    const hh = await ensureHousehold(user.id, user.user_metadata?.full_name);
    if (!hh) return;
    setLoading(true);
    const { data } = await supabase
      .from('kids')
      .select('*')
      .eq('household_id', hh.id)
      .order('created_at', { ascending: true });
    setLoading(false);
    if (data) setKids(data as Kid[]);
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Keep the active-kid pointer consistent: if the selected kid was
  // deleted from another tab, clear the local state.
  useEffect(() => {
    if (!activeKidId) return;
    if (kids.length === 0) return;
    if (!kids.find((k) => k.id === activeKidId)) {
      setActiveKidIdState(null);
      writeLocal(ACTIVE_KID_KEY, null);
    }
  }, [kids, activeKidId]);

  const setActiveKidId = useCallback((id: string | null) => {
    setActiveKidIdState(id);
    writeLocal(ACTIVE_KID_KEY, id);
  }, []);

  const setKidModeOn = useCallback((on: boolean) => {
    setKidModeOnState(on);
    writeLocal(KID_MODE_KEY, on ? '1' : null);
  }, []);

  const addKid = useCallback(
    async (input: { name: string; age: number; avatar_color: AvatarColor }) => {
      if (!user || !supabase) return null;
      const hh = await ensureHousehold(user.id, user.user_metadata?.full_name);
      if (!hh) return null;
      const { data, error } = await supabase
        .from('kids')
        .insert({
          household_id: hh.id,
          name: input.name.trim(),
          age: input.age,
          avatar_color: input.avatar_color,
        })
        .select('*')
        .single();
      if (error || !data) return null;
      await refresh();
      return data as Kid;
    },
    [user, refresh],
  );

  const updateKid = useCallback(
    async (
      id: string,
      patch: Partial<Pick<Kid, 'name' | 'age' | 'avatar_color'>>,
    ) => {
      if (!supabase) return;
      await supabase.from('kids').update(patch).eq('id', id);
      await refresh();
    },
    [refresh],
  );

  const removeKid = useCallback(
    async (id: string) => {
      if (!supabase) return;
      await supabase.from('kids').delete().eq('id', id);
      if (activeKidId === id) setActiveKidId(null);
      await refresh();
    },
    [refresh, activeKidId, setActiveKidId],
  );

  const activeKid = kids.find((k) => k.id === activeKidId) ?? null;

  return {
    kids,
    loading,
    refresh,
    addKid,
    updateKid,
    removeKid,
    activeKid,
    activeKidId,
    setActiveKidId,
    kidModeOn,
    setKidModeOn,
  };
}
