import { useEffect, useState } from 'react';
import { supabase } from './supabase';

export type StoreKind = 'affiliate' | 'referral' | 'print_on_demand' | 'etsy';

export interface StoreItem {
  slug: string;
  title: string;
  subtitle: string | null;
  curator_note: string | null;
  maker_name: string | null;
  maker_url: string | null;
  category: string;
  kind: StoreKind;
  affiliate_url: string | null;
  affiliate_network?: string | null;
  commission_rate?: string | null;
  image_url: string | null;
  price_display: string | null;
  partner_status?: 'prospect' | 'active' | 'inactive' | 'contacted' | 'declined';
  last_verified?: string | null;
  source_url?: string | null;
  published: boolean;
  featured: boolean;
  sort_order: number;
}

const SAMPLE_ITEMS: StoreItem[] = [
  {
    slug: 'anson-mills-antebellum-fine-yellow-cornmeal',
    title: 'Antebellum Fine Yellow Cornmeal',
    subtitle: 'Anson Mills, South Carolina',
    curator_note:
      'Glenn Roberts at Anson Mills revived a handful of nearly-extinct Southern corn varieties and built a mill around them. The Antebellum Fine Yellow is what the 1890s cookbooks in our library meant when they said "corn meal" \u2014 sweet, grassy, alive in a way supermarket meal isn\u2019t. Use it in any spoon bread, johnnycake, or muffin recipe and the difference is embarrassing.',
    maker_name: 'Anson Mills',
    maker_url: 'https://ansonmills.com',
    category: 'flour-and-grain',
    kind: 'affiliate',
    affiliate_url: 'https://ansonmills.com',
    image_url: null,
    price_display: '$7 / lb',
    published: true,
    featured: true,
    sort_order: 1,
  },
  {
    slug: 'lodge-10-inch-cast-iron-skillet',
    title: 'Lodge 10-inch Cast Iron Skillet',
    subtitle: 'Made in South Pittsburg, Tennessee',
    curator_note:
      'Lodge has been pouring iron in the same Tennessee foundry since 1896 \u2014 the same year Fannie Farmer published The Boston Cooking-School Cook Book. The 10-inch is the workhorse: big enough for cornbread or a whole chicken, small enough to lift with one hand. One of these will outlast you and go to your grandchildren.',
    maker_name: 'Lodge Cast Iron',
    maker_url: 'https://www.lodgecastiron.com',
    category: 'cookware',
    kind: 'affiliate',
    affiliate_url: 'https://www.lodgecastiron.com',
    image_url: null,
    price_display: '$25',
    published: true,
    featured: true,
    sort_order: 2,
  },
  {
    slug: 'gethsemani-farms-kentucky-bourbon-fruitcake',
    title: 'Kentucky Bourbon Fruitcake',
    subtitle: 'Abbey of Our Lady of Gethsemani',
    curator_note:
      'The Trappist monks at Gethsemani in Kentucky (Thomas Merton\u2019s monastery) have been making fruitcake and fudge since the 1950s to support the abbey. The fruitcake is aged with bourbon and candied fruit; it keeps forever; it tastes like Christmas actually does. Buying one underwrites a real contemplative community.',
    maker_name: 'Gethsemani Farms',
    maker_url: 'https://www.gethsemanifarms.org',
    category: 'monastery',
    kind: 'affiliate',
    affiliate_url: 'https://www.gethsemanifarms.org',
    image_url: null,
    price_display: '$28',
    published: true,
    featured: true,
    sort_order: 4,
  },
];

/**
 * Returns the published curated store items. When Supabase is not
 * configured or returns no rows (e.g. the seed hasn't been applied yet),
 * falls back to a bundled sample so the /store page is never empty.
 */
export function useStoreItems() {
  const [items, setItems] = useState<StoreItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!supabase) {
        setItems(SAMPLE_ITEMS);
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from('store_items')
        .select('*')
        .eq('published', true)
        .order('sort_order');
      if (!cancelled) {
        const list = ((data as StoreItem[]) ?? []).length > 0
          ? (data as StoreItem[])
          : SAMPLE_ITEMS;
        setItems(list);
        setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { items, loading };
}

export const CATEGORY_LABELS: Record<string, string> = {
  'flour-and-grain': 'Flour &amp; grain',
  cookware: 'Cookware',
  'kitchen-tools': 'Kitchen tools',
  preserving: 'Preserving',
  starters: 'Starters &amp; cultures',
  'kitchen-garden': 'Kitchen garden',
  monastery: 'From the monastery',
  spices: 'Spices',
  books: 'Books',
  apparel: 'Kitchen linens &amp; workwear',
  merch: 'Heritage Kitchen merch',
};
