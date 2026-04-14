import { useEffect, useState } from 'react';
import { supabase } from './supabase';

export interface Edition {
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  cover_image_url: string | null;
  intro_text: string | null;
  recipe_ids: string[];
  price_usd: number;
  page_count: number | null;
  published: boolean;
  featured: boolean;
  sort_order: number;
}

/**
 * Client hooks for the Heritage Kitchen editions store.
 *
 * Editions are public-readable, admin-writable curated cookbooks that
 * Heritage Kitchen publishes and sells through the same Lulu + Stripe
 * pipeline that powers user-built cookbooks. Signed-in and anonymous
 * visitors can both browse and buy; the order flow itself collects
 * email and shipping address on the Stripe Checkout page.
 */

export function useEditions(opts: { publishedOnly?: boolean } = { publishedOnly: true }) {
  const [editions, setEditions] = useState<Edition[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!supabase) {
        setEditions([]);
        setLoading(false);
        return;
      }
      let query = supabase.from('editions').select('*').order('sort_order');
      if (opts.publishedOnly) query = query.eq('published', true);
      const { data } = await query;
      if (!cancelled) {
        setEditions((data as Edition[]) ?? []);
        setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [opts.publishedOnly]);

  return { editions, loading };
}

export function useEdition(slug: string) {
  const [edition, setEdition] = useState<Edition | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!supabase) {
        setEdition(null);
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from('editions')
        .select('*')
        .eq('slug', slug)
        .maybeSingle();
      if (!cancelled) {
        setEdition((data as Edition) ?? null);
        setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  return { edition, loading };
}

/**
 * Creates a Stripe Checkout Session for an edition order and returns the
 * redirect URL. Stripe collects the shipping address on its own page, so
 * we don't need to build one ourselves for editions.
 */
export async function startEditionCheckout(slug: string): Promise<string> {
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase.functions.invoke('stripe-checkout-edition', {
    body: { edition_slug: slug },
  });
  if (error) throw error;
  return (data as { url: string }).url;
}
