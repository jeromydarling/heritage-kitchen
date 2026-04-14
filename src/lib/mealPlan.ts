import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { useUser } from './auth';
import { ensureHousehold } from './household';

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'feast';

export interface MealPlanEntry {
  id: string;
  household_id: string;
  planned_on: string; // ISO date yyyy-mm-dd
  meal_type: MealType;
  recipe_id: string;
  notes: string | null;
  created_at: string;
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Hook returning all meal plan entries between the given dates (inclusive),
 * along with mutation helpers. Dates are local dates; the DB stores plain
 * `date` values so timezone conversions don't matter here.
 */
export function useMealPlan(startDate: Date, endDate: Date) {
  const user = useUser();
  const [entries, setEntries] = useState<MealPlanEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const startIso = toIsoDate(startDate);
  const endIso = toIsoDate(endDate);

  const refresh = useCallback(async () => {
    if (!user || !supabase) {
      setEntries([]);
      return;
    }
    const hh = await ensureHousehold(user.id, user.user_metadata?.full_name);
    if (!hh) return;
    setLoading(true);
    const { data } = await supabase
      .from('meal_plan_entries')
      .select('*')
      .eq('household_id', hh.id)
      .gte('planned_on', startIso)
      .lte('planned_on', endIso)
      .order('planned_on');
    setLoading(false);
    if (data) setEntries(data as MealPlanEntry[]);
  }, [user, startIso, endIso]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const addEntry = useCallback(
    async (date: Date, recipeId: string, mealType: MealType = 'dinner') => {
      if (!user || !supabase) return;
      const hh = await ensureHousehold(user.id, user.user_metadata?.full_name);
      if (!hh) return;
      await supabase.from('meal_plan_entries').insert({
        household_id: hh.id,
        planned_on: toIsoDate(date),
        recipe_id: recipeId,
        meal_type: mealType,
        created_by: user.id,
      });
      await refresh();
    },
    [user, refresh],
  );

  const removeEntry = useCallback(
    async (id: string) => {
      if (!user || !supabase) return;
      await supabase.from('meal_plan_entries').delete().eq('id', id);
      await refresh();
    },
    [user, refresh],
  );

  return { entries, loading, refresh, addEntry, removeEntry };
}

/** Quick-add helper that drops a recipe onto the next empty day in the coming week. */
export async function addToNextOpenDay(userId: string, displayName: string | null | undefined, recipeId: string): Promise<Date | null> {
  if (!supabase) return null;
  const hh = await ensureHousehold(userId, displayName);
  if (!hh) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekLater = new Date(today);
  weekLater.setDate(weekLater.getDate() + 7);

  const { data } = await supabase
    .from('meal_plan_entries')
    .select('planned_on')
    .eq('household_id', hh.id)
    .gte('planned_on', toIsoDate(today))
    .lte('planned_on', toIsoDate(weekLater));
  const takenDinners = new Set((data ?? []).map((e) => e.planned_on as string));

  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    if (!takenDinners.has(toIsoDate(d))) {
      await supabase.from('meal_plan_entries').insert({
        household_id: hh.id,
        planned_on: toIsoDate(d),
        recipe_id: recipeId,
        meal_type: 'dinner',
        created_by: userId,
      });
      return d;
    }
  }
  // All full: still add to today
  const d = today;
  await supabase.from('meal_plan_entries').insert({
    household_id: hh.id,
    planned_on: toIsoDate(d),
    recipe_id: recipeId,
    meal_type: 'dinner',
    created_by: userId,
  });
  return d;
}
