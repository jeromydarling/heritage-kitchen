/**
 * Seeds the Supabase `recipes` table from heritage_kitchen_recipes.json.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *   DATA_FILE=./heritage_kitchen_recipes.json \
 *   npm run seed
 *
 * The service role key is required so the script can bypass RLS. Never commit
 * it. Run this locally or from a secure CI environment.
 */
import { readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DATA_FILE = process.env.DATA_FILE ?? './heritage_kitchen_recipes.json';
const BATCH_SIZE = 200;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env var.');
  process.exit(1);
}

interface RawRecipe {
  id: string;
  title: string;
  source_book: string;
  source_author: string;
  source_year: string;
  source_url: string;
  category: string;
  original_recipe: string;
  modern_recipe: unknown;
  history_note?: string;
  tags?: string[];
  difficulty: 'easy' | 'moderate' | 'involved';
  image_prompt: string;
  image_url?: string | null;
}

async function main() {
  const text = await readFile(DATA_FILE, 'utf8');
  const data = JSON.parse(text) as RawRecipe[];
  console.log(`Loaded ${data.length} recipes from ${DATA_FILE}`);

  const client = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });

  let ok = 0;
  let failed = 0;

  for (let i = 0; i < data.length; i += BATCH_SIZE) {
    const batch = data.slice(i, i + BATCH_SIZE);
    const { error } = await client.from('recipes').upsert(batch, { onConflict: 'id' });
    if (error) {
      console.error(`Batch ${i}-${i + batch.length} failed:`, error.message);
      failed += batch.length;
    } else {
      ok += batch.length;
      process.stdout.write(`  upserted ${ok}/${data.length}\r`);
    }
  }

  console.log(`\nDone. Success: ${ok}, failed: ${failed}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
