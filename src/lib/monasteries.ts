import { useEffect, useState } from 'react';
import { supabase } from './supabase';

export interface Monastery {
  slug: string;
  name: string;
  tradition: string | null;
  location: string | null;
  founded: string | null;
  description: string | null;
  products_summary: string | null;
  image_url: string | null;
  website_url: string | null;
  shop_url: string | null;
  published: boolean;
  featured: boolean;
  sort_order: number;
}

// Bundled fallback so the /monasteries page still renders something real
// before the SQL seed has been applied to a fresh database.
const SAMPLE: Monastery[] = [
  {
    slug: 'gethsemani',
    name: 'Abbey of Our Lady of Gethsemani',
    tradition: 'Trappist (OCSO)',
    location: 'Trappist, Kentucky',
    founded: '1848',
    description:
      'The oldest Trappist monastery in the United States, and the house where Thomas Merton lived and wrote from 1941 until his death. The monks at Gethsemani pray the liturgy of the hours seven times a day and support themselves in large part by selling bourbon-aged fruitcake, fudge, and cheese. If you have never had a real Trappist fruitcake, the Gethsemani one is a good place to begin \u2014 dense, bourbon-rich, aged four months, and a direct line back to a kind of monastic baking that has almost vanished outside these walls.',
    products_summary: 'Fruitcake, fudge, Trappist cheese',
    image_url: null,
    website_url: 'https://www.monks.org',
    shop_url: 'https://www.gethsemanifarms.org',
    published: true,
    featured: true,
    sort_order: 1,
  },
  {
    slug: 'new-camaldoli-hermitage',
    name: 'New Camaldoli Hermitage',
    tradition: 'Camaldolese Benedictine',
    location: 'Big Sur, California',
    founded: '1958',
    description:
      'The Camaldolese Benedictines are an 11th-century reform of the Benedictine rule that leans toward hermitic life. Their American house sits on a narrow shelf above the Big Sur coast. The hermits make and sell small batches of Mediterranean-style fruitcake and date nut cake. Orders for the Christmas fruitcake open around All Saints and sell out every year.',
    products_summary: 'Fruitcake, date nut cake, jam',
    image_url: null,
    website_url: 'https://www.contemplation.com',
    shop_url: 'https://www.contemplation.com/store',
    published: true,
    featured: true,
    sort_order: 2,
  },
];

export function useMonasteries() {
  const [list, setList] = useState<Monastery[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!supabase) {
        setList(SAMPLE);
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from('monasteries')
        .select('*')
        .eq('published', true)
        .order('sort_order');
      if (!cancelled) {
        const rows = ((data as Monastery[]) ?? []);
        setList(rows.length > 0 ? rows : SAMPLE);
        setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { list, loading };
}

export function useMonastery(slug: string) {
  const [monastery, setMonastery] = useState<Monastery | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!supabase) {
        setMonastery(SAMPLE.find((m) => m.slug === slug) ?? null);
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from('monasteries')
        .select('*')
        .eq('slug', slug)
        .maybeSingle();
      if (!cancelled) {
        setMonastery((data as Monastery) ?? SAMPLE.find((m) => m.slug === slug) ?? null);
        setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [slug]);
  return { monastery, loading };
}
