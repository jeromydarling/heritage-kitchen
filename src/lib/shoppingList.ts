import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { useUser } from './auth';
import { ensureHousehold } from './household';
import type { Recipe } from './types';

export interface ShoppingItem {
  id: string;
  household_id: string;
  text: string;
  quantity: string | null;
  checked: boolean;
  source_recipe_id: string | null;
  created_at: string;
}

export function useShoppingList() {
  const user = useUser();
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user || !supabase) {
      setItems([]);
      return;
    }
    const hh = await ensureHousehold(user.id, user.user_metadata?.full_name);
    if (!hh) return;
    setLoading(true);
    const { data } = await supabase
      .from('shopping_list_items')
      .select('*')
      .eq('household_id', hh.id)
      .order('checked')
      .order('created_at', { ascending: false });
    setLoading(false);
    if (data) setItems(data as ShoppingItem[]);
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const addItem = useCallback(
    async (text: string, sourceRecipeId?: string) => {
      if (!user || !supabase) return;
      const hh = await ensureHousehold(user.id, user.user_metadata?.full_name);
      if (!hh) return;
      await supabase.from('shopping_list_items').insert({
        household_id: hh.id,
        text: text.trim(),
        source_recipe_id: sourceRecipeId ?? null,
        created_by: user.id,
      });
      await refresh();
    },
    [user, refresh],
  );

  const toggleItem = useCallback(
    async (id: string, checked: boolean) => {
      if (!user || !supabase) return;
      await supabase.from('shopping_list_items').update({ checked }).eq('id', id);
      await refresh();
    },
    [user, refresh],
  );

  const removeItem = useCallback(
    async (id: string) => {
      if (!user || !supabase) return;
      await supabase.from('shopping_list_items').delete().eq('id', id);
      await refresh();
    },
    [user, refresh],
  );

  const clearChecked = useCallback(async () => {
    if (!user || !supabase) return;
    const hh = await ensureHousehold(user.id, user.user_metadata?.full_name);
    if (!hh) return;
    await supabase
      .from('shopping_list_items')
      .delete()
      .eq('household_id', hh.id)
      .eq('checked', true);
    await refresh();
  }, [user, refresh]);

  return { items, loading, refresh, addItem, toggleItem, removeItem, clearChecked };
}

/**
 * Pull all ingredient strings from a recipe's modern_recipe block. Handles
 * both the well-structured array form and the occasional prose fallback.
 */
export function ingredientsOf(recipe: Recipe): string[] {
  const m = recipe.modern_recipe;
  if (Array.isArray(m.ingredients)) return m.ingredients.filter(Boolean);
  if (typeof m.ingredients === 'string') return [m.ingredients];
  return [];
}

/**
 * De-duplicate a list of ingredient strings by lowercase equality. This is
 * the dumbest possible parser â€” it won't merge "2 tbsp butter" with "1/4
 * cup butter" â€” but it's predictable and users can clean up by hand. Doing
 * better requires a real ingredient parser, which is a project of its own.
 */
export function dedupeIngredients(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of items) {
    const key = raw.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(raw.trim());
  }
  return out;
}
