import { useMemo } from 'react';
import { useStoreItems, CATEGORY_LABELS, type StoreItem } from '../lib/store';

/**
 * The Heritage Kitchen store. Not a catalog â€” a curated list with prose.
 * Each item has a paragraph about the maker and a button that opens the
 * maker's own site. We don't handle payment or fulfillment for any of
 * these; the site's only job is to point at good things.
 */
export default function StorePage() {
  const { items, loading } = useStoreItems();

  const byCategory = useMemo(() => {
    const grouped = new Map<string, StoreItem[]>();
    for (const item of items) {
      if (!grouped.has(item.category)) grouped.set(item.category, []);
      grouped.get(item.category)!.push(item);
    }
    return grouped;
  }, [items]);

  return (
    <div className="mx-auto max-w-3xl space-y-12">
      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-terracotta">
          A curator&rsquo;s letter
        </p>
        <h1 className="mt-1 font-serif text-4xl sm:text-5xl">The store</h1>
        <p className="mt-4 text-lg leading-relaxed text-muted">
          This page is not a catalog. It&rsquo;s a small, hand-written
          list of the things we think belong in a kitchen like the ones
          our recipes were written for. Most are made by people we
          know a little about and trust enough to say so in print. A few
          are monastery goods &mdash; food that pays a real contemplative
          community&rsquo;s bills.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          We don&rsquo;t take ads and we don&rsquo;t run a warehouse. When
          you click through, you buy directly from the maker, on their
          site. If we earn a small affiliate cut for the referral, it
          keeps the lights on here.
        </p>
      </header>

      {loading ? (
        <p className="text-muted">Loadingâ€¦</p>
      ) : (
        Array.from(byCategory.entries()).map(([category, catItems]) => (
          <section key={category} className="space-y-5">
            <h2
              className="font-serif text-2xl"
              dangerouslySetInnerHTML={{
                __html: CATEGORY_LABELS[category] ?? category,
              }}
            />
            <ul className="space-y-5">
              {catItems.map((item) => (
                <li key={item.slug} className="card p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-serif text-xl leading-tight">
                        {item.title}
                      </h3>
                      {item.subtitle && (
                        <p className="mt-1 text-sm italic text-muted">
                          {item.subtitle}
                        </p>
                      )}
                    </div>
                    {item.price_display && (
                      <p className="font-serif text-base text-terracotta">
                        {item.price_display}
                      </p>
                    )}
                  </div>
                  {item.curator_note && (
                    <p className="mt-4 leading-relaxed text-ink/90">
                      {item.curator_note}
                    </p>
                  )}
                  {item.affiliate_url && (
                    <a
                      href={item.affiliate_url}
                      target="_blank"
                      rel="noreferrer"
                      className="btn mt-5"
                    >
                      Visit {item.maker_name ?? 'the maker'} &rarr;
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      <section className="card bg-paper p-6 text-sm leading-relaxed text-muted">
        <h2 className="font-serif text-lg text-ink">How this list is chosen</h2>
        <p className="mt-2">
          Everything on this page is on it because we actually use it.
          Nothing is here because someone paid for placement, and
          nothing will be. If you want us to consider something you
          make, write to us &mdash; we read every note, we just can&rsquo;t
          promise to add it.
        </p>
      </section>
    </div>
  );
}
