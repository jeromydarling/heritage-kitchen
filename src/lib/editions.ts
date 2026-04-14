import { useEffect, useState } from 'react';
import { supabase } from './supabase';

export type EditionFormat = 'print' | 'pdf' | 'both';

export interface Edition {
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  cover_image_url: string | null;
  intro_text: string | null;
  recipe_ids: string[];
  price_usd: number;
  price_pdf_usd: number | null;
  format: EditionFormat;
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
 * redirect URL. For printed editions, Stripe collects the shipping
 * address on its own page. For PDF editions, shipping is skipped and the
 * customer gets an instant download on the success page.
 */
export async function startEditionCheckout(
  slug: string,
  format: 'print' | 'pdf' = 'print',
): Promise<string> {
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase.functions.invoke('stripe-checkout-edition', {
    body: { edition_slug: slug, format },
  });
  if (error) throw error;
  return (data as { url: string }).url;
}

export interface EditionOrderDownload {
  edition_slug: string;
  pdf_download_url: string | null;
  pdf_download_expires_at: string | null;
  status: string;
}

/**
 * Fetches an edition order by its Stripe checkout session id. Used on the
 * download success page to show the signed PDF URL after payment.
 */
export async function fetchEditionOrderBySession(
  sessionId: string,
): Promise<EditionOrderDownload | null> {
  if (!supabase) return null;
  const { data } = await supabase
    .from('edition_orders')
    .select('edition_slug, pdf_download_url, pdf_download_expires_at, status')
    .eq('stripe_session_id', sessionId)
    .maybeSingle();
  return (data as EditionOrderDownload) ?? null;
}
