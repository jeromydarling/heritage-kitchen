import { useEffect, useState } from 'react';
import { supabase } from './supabase';

export type SponsorTier = 'patron' | 'supporter' | 'friend';

export interface Sponsor {
  slug: string;
  name: string;
  tier: SponsorTier;
  url: string | null;
  logo_url: string | null;
  description: string | null;
  since: string | null;
  until: string | null;
  published: boolean;
  sort_order: number;
}

export interface RecipeAdoption {
  id: string;
  recipe_id: string;
  sponsor_slug: string | null;
  credit_text: string | null;
  active: boolean;
  // Joined sponsor fields when available
  sponsor?: Sponsor | null;
}

export function useSponsors() {
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!supabase) {
        setSponsors([]);
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from('sponsors')
        .select('*')
        .eq('published', true)
        .order('sort_order');
      if (!cancelled) {
        setSponsors((data as Sponsor[]) ?? []);
        setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { sponsors, loading };
}

/**
 * Returns the active adoption for a given recipe, if any. Joins the
 * sponsor row so the caller has everything it needs to render a credit.
 */
export function useRecipeAdoption(recipeId: string) {
  const [adoption, setAdoption] = useState<RecipeAdoption | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!supabase) {
        setAdoption(null);
        return;
      }
      const { data } = await supabase
        .from('recipe_adoptions')
        .select('*, sponsor:sponsors(*)')
        .eq('recipe_id', recipeId)
        .eq('active', true)
        .maybeSingle();
      if (!cancelled) setAdoption((data as RecipeAdoption) ?? null);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [recipeId]);

  return adoption;
}

export const TIER_LABELS: Record<SponsorTier, string> = {
  patron: 'Patrons',
  supporter: 'Supporters',
  friend: 'Friends',
};
