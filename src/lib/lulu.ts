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
    recipes: Recipe[];
  },
): Promise<{ url: string; pageCount: number }> {
  if (!supabase) throw new Error('Supabase not configured');

  const { generateCookbookPdfWithMeta } = await import('./pdfGen');
  const { blob, pageCount } = await generateCookbookPdfWithMeta(project);
  const path = `${userId}/${projectId}-interior.pdf`;

  const { error: uploadErr } = await supabase.storage
    .from('cookbook-pdfs')
    .upload(path, blob, {
      contentType: 'application/pdf',
      upsert: true,
    });
  if (uploadErr) throw uploadErr;

  const { data } = supabase.storage.from('cookbook-pdfs').getPublicUrl(path);
  const url = data.publicUrl;

  await supabase
    .from('cookbook_projects')
    .update({
      pdf_interior_path: path,
      page_count: pageCount,
      updated_at: new Date().toISOString(),
    })
    .eq('id', projectId);

  return { url, pageCount };
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
