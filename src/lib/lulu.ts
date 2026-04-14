import { supabase } from './supabase';
import type { Recipe } from './types';
import { generateCookbookPdfWithMeta } from './pdfGen';

/**
 * Client helpers for the Lulu Print API direct-ordering flow.
 *
 * The flow (all from the browser):
 *   1. generate a PDF via pdfGen.ts
 *   2. upload it to the cookbook-pdfs Supabase Storage bucket
 *   3. ask the `lulu-quote` edge function for a price estimate
 *   4. ask the `lulu-create-order` edge function to create a real print job
 *   5. poll cookbook_projects to watch the status change
 *
 * The edge functions own the Lulu OAuth flow and credentials; nothing
 * sensitive lives in the browser.
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
  total_cost_incl_tax: string;
  currency: string;
  shipping_cost: string;
  line_item_cost: string;
  estimated_ship_date?: string;
}

/**
 * Generate the interior PDF, upload it to Supabase Storage, and record
 * its path on the cookbook project. Returns the public URL Lulu will
 * fetch.
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

export async function createLuluOrder(
  projectId: string,
  shipping: ShippingAddress,
): Promise<{ lulu_order_id: string }> {
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase.functions.invoke('lulu-create-order', {
    body: { project_id: projectId, shipping_address: shipping },
  });
  if (error) throw error;
  return data as { lulu_order_id: string };
}
