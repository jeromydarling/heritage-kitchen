// @ts-nocheck
/**
 * Supabase Edge Function: generate-recipe-image
 *
 * Skeleton implementation. When a recipe page is visited and its image_url is
 * null, the frontend invokes this function with:
 *
 *   { recipe_id: string, image_prompt: string }
 *
 * Steps to wire up a real image provider later:
 *   1. Call your image generation API with `image_prompt`.
 *   2. Download the returned bytes and upload them to the `recipe-images`
 *      bucket at `${recipe_id}.png`.
 *   3. Fetch the public URL and update recipes.image_url.
 *   4. Return { image_url } to the caller.
 *
 * For now, this function just stubs the response so the frontend can be
 * tested end-to-end without burning any image credits.
 */
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const IMAGE_API_KEY = Deno.env.get('IMAGE_API_KEY'); // set later when provider is chosen

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const { recipe_id, image_prompt } = await req.json();
    if (!recipe_id || !image_prompt) {
      return json({ error: 'recipe_id and image_prompt are required' }, 400);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // TODO: call the real image generator once a provider is configured.
    if (!IMAGE_API_KEY) {
      return json({ image_url: null, status: 'stub', note: 'IMAGE_API_KEY not set' });
    }

    // --- placeholder for provider call ---
    // const imgBytes = await callProvider(image_prompt, IMAGE_API_KEY);
    // const path = `${recipe_id}.png`;
    // await supabase.storage.from('recipe-images').upload(path, imgBytes, {
    //   contentType: 'image/png',
    //   upsert: true,
    // });
    // const { data } = supabase.storage.from('recipe-images').getPublicUrl(path);
    // const image_url = data.publicUrl;
    // await supabase.from('recipes').update({ image_url, updated_at: new Date().toISOString() }).eq('id', recipe_id);
    // return json({ image_url });

    return json({ image_url: null, status: 'stub' });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...CORS },
  });
}
