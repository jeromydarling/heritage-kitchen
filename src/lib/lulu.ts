import { supabase } from './supabase';
import type { Recipe } from './types';

/**
 * Client helpers for the Lulu Print API direct-ordering flow backed by
 * Stripe Checkout for payment.
 *
 * The browser:
 *   1. generates a PDF via pdfGen.ts (lazy-loaded)
 *   2. uploads it to the cookbook-pdfs Supabase Storage bucket
 *   3. asks `lulu-quote` for a price estimate
 *   4. asks `stripe-checkout` to create a Stripe Checkout Session
 *   5. redirects to Stripe
 *   6. Stripe webhook creates the real Lulu print-job on successful payment
 *
 * All sensitive Lulu/Stripe credentials live in the edge functions.
 */

export interface ShippingAddress {
  name: string;
  street1: string;
  street2?: string;
  city: string;
  state_code: string;
  postcode: string;
  country_code: string;
  phone_number: string;
  email: string;
}

export interface LuluQuote {
  project_id: string;
  page_count: number;
  lulu_cost: string;
  markup: string;
  customer_total: string;
  currency: string;
  shipping_cost: string | null;
  estimated_ship_date: string | null;
}

/**
 * Generate the interior PDF (lazy-imports jspdf to keep the main bundle
 * small), upload it to storage, and record its path and page count on
 * the project. Returns the public URL Lulu will fetch.
 */
export async function uploadInteriorPdf(
  projectId: string,
  userId: string,
  project: {
    title: string;
    subtitle: string | null;
    dedication: string | null;
    foreword?: string | null;
    groupByCategory?: boolean;
    recipes: Recipe[];
  },
): Promise<{ url: string; pageCount: number }> {
  if (!supabase) throw new Error('Supabase not configured');

  const { generateCookbookPdfWithMeta, generateCoverPdf } = await import('./pdfGen');
  const { blob, pageCount } = await generateCookbookPdfWithMeta(project);
  const interiorPath = `${userId}/${projectId}-interior.pdf`;

  const { error: uploadErr } = await supabase.storage
    .from('cookbook-pdfs')
    .upload(interiorPath, blob, {
      contentType: 'application/pdf',
      upsert: true,
    });
  if (uploadErr) throw uploadErr;

  const { data: pub } = supabase.storage
    .from('cookbook-pdfs')
    .getPublicUrl(interiorPath);
  const url = pub.publicUrl;

  // Generate the matching cover. We ask lulu-cover-dimensions for the exact
  // geometry (spine width, wrap, safe zone) and pass it into the cover
  // generator so the cover fits the Lulu template exactly.
  let coverPath: string | null = null;
  try {
    const dims = await fetchCoverDimensions(pageCount);
    if (dims) {
      const coverBlob = await generateCoverPdf(project, dims);
      coverPath = `${userId}/${projectId}-cover.pdf`;
      await supabase.storage
        .from('cookbook-pdfs')
        .upload(coverPath, coverBlob, {
          contentType: 'application/pdf',
          upsert: true,
        });
    }
  } catch (err) {
    // Cover generation is best-effort in v1 -- if it fails (e.g. Lulu
    // sandbox is down) we still upload the interior and let the webhook
    // fall back to the stub cover. The order is not blocked.
    console.warn('Cover generation failed, continuing with interior only:', err);
  }

  await supabase
    .from('cookbook_projects')
    .update({
      pdf_interior_path: interiorPath,
      pdf_cover_path: coverPath,
      page_count: pageCount,
      updated_at: new Date().toISOString(),
    })
    .eq('id', projectId);

  return { url, pageCount };
}

/**
 * Asks the lulu-cover-dimensions edge function for the exact cover
 * geometry for a given page count. Returns null on failure so callers
 * can degrade gracefully.
 */
async function fetchCoverDimensions(pageCount: number): Promise<{
  width_in: number;
  height_in: number;
  spine_in: number;
  wrap_in: number;
  safe_zone_in: number;
} | null> {
  if (!supabase) return null;
  // POD package id is configurable server-side via env. We send a placeholder
  // string that the edge function swaps for its configured default.
  const { data, error } = await supabase.functions.invoke('lulu-cover-dimensions', {
    body: {
      pod_package_id: (import.meta.env.VITE_LULU_POD_PACKAGE_ID as string) ?? '0600X0900BWSTDPB060UW444MXX',
      page_count: pageCount,
    },
  });
  if (error) return null;
  return data as {
    width_in: number;
    height_in: number;
    spine_in: number;
    wrap_in: number;
    safe_zone_in: number;
  };
}

export async function requestLuluQuote(
  projectId: string,
  shipping: ShippingAddress,
): Promise<LuluQuote> {
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase.functions.invoke('lulu-quote', {
    body: { project_id: projectId, shipping_address: shipping },
  });
  if (error) throw error;
  return data as LuluQuote;
}

/**
 * Creates a Stripe Checkout Session for a quoted cookbook order. Returns
 * the Stripe-hosted URL the caller should redirect the browser to.
 */
export async function createStripeCheckoutForOrder(
  projectId: string,
  quote: LuluQuote,
  shipping: ShippingAddress,
): Promise<{ url: string }> {
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase.functions.invoke('stripe-checkout', {
    body: {
      project_id: projectId,
      customer_total: quote.customer_total,
      currency: quote.currency,
      shipping_address: shipping,
    },
  });
  if (error) throw error;
  return data as { url: string };
}
