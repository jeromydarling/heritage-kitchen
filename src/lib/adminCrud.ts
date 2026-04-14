import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { useUser } from './auth';

/**
 * Admin utilities. v1 is single-admin: a single email address (set via
 * VITE_ADMIN_EMAIL at build time) gets admin privileges. Everything
 * else on the site ignores this â€” the admin flag only controls access
 * to the /admin/* route tree.
 *
 * All writes go through Supabase's service-enforced RLS policies; the
 * client admin check is UI-only.
 */

const ADMIN_EMAIL = (import.meta.env.VITE_ADMIN_EMAIL as string | undefined) ?? '';

export function useIsAdmin(): boolean {
  const user = useUser();
  if (!ADMIN_EMAIL) return false;
  return (user?.email ?? '').toLowerCase() === ADMIN_EMAIL.toLowerCase();
}

export interface AdminCrudOptions {
  orderBy?: string;
  ascending?: boolean;
  select?: string;
}

/**
 * Generic CRUD hook for admin tables. Returns the rows, loading state,
 * and mutator helpers. `primaryKey` is the column name used to identify
 * rows for delete (defaults to `id` or `slug` â€” pass whichever your
 * table uses).
 */
export function useAdminCrud<T extends Record<string, any>>(
  table: string,
  primaryKey: string = 'id',
  options: AdminCrudOptions = {},
) {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    let query = supabase.from(table).select(options.select ?? '*');
    if (options.orderBy) {
      query = query.order(options.orderBy, { ascending: options.ascending ?? true });
    }
    const { data, error: err } = await query;
    if (err) setError(err.message);
    setRows((data as unknown as T[]) ?? []);
    setLoading(false);
  }, [table, options.orderBy, options.ascending, options.select]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const upsert = useCallback(
    async (row: Partial<T>) => {
      if (!supabase) return { ok: false, error: 'no supabase' };
      const { error: err } = await supabase.from(table).upsert(row as never);
      if (err) {
        setError(err.message);
        return { ok: false, error: err.message };
      }
      await refresh();
      return { ok: true };
    },
    [table, refresh],
  );

  const remove = useCallback(
    async (id: string) => {
      if (!supabase) return { ok: false };
      const { error: err } = await supabase.from(table).delete().eq(primaryKey, id);
      if (err) {
        setError(err.message);
        return { ok: false, error: err.message };
      }
      await refresh();
      return { ok: true };
    },
    [table, primaryKey, refresh],
  );

  return { rows, loading, error, refresh, upsert, remove };
}

/**
 * Slugify a title into a stable URL-safe slug. Used when creating new
 * rows in tables whose primary key is a text slug.
 */
export function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}
