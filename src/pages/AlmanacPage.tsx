import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Edition } from '../lib/editions';

interface AlmanacEdition extends Edition {
  almanac_year: number | null;
}

/**
 * The Heritage Kitchen Almanac is an annual printed edition â€” one book
 * per year, collected on a shelf like the old paper almanacs people
 * used to keep by the salt. This page lists every year's almanac,
 * newest first, with the same checkout flow as any other edition.
 */
export default function AlmanacPage() {
  const [editions, setEditions] = useState<AlmanacEdition[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!supabase) {
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from('editions')
        .select('*')
        .not('almanac_year', 'is', null)
        .eq('published', true)
        .order('almanac_year', { ascending: false });
      if (!cancelled) {
        setEditions((data as AlmanacEdition[]) ?? []);
        setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto max-w-3xl space-y-12">
      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-terracotta">
          Annual
        </p>
        <h1 className="mt-1 font-serif text-4xl sm:text-5xl">
          The Heritage Kitchen Almanac
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-muted">
          There used to be a paper almanac on every kitchen shelf in
          America. Ours is an attempt to bring the habit back, with a
          liturgical year instead of a farming one (or, really, the
          same year seen from two sides). Each volume stands on its own
          &mdash; you don&rsquo;t have to start at the beginning, and
          you don&rsquo;t have to buy the next one for the last one to
          make sense. Printed in time for Advent and shipped worldwide.
        </p>
      </header>

      {loading ? (
        <p className="text-muted">Loadingâ€¦</p>
      ) : editions.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="font-serif text-lg italic text-muted">
            The first almanac is still being typeset.
          </p>
          <p className="mt-2 text-sm text-muted">
            Subscribe to the Sunday digest on your{' '}
            <Link to="/cookbook">cookbook page</Link> and you&rsquo;ll
            hear when pre-orders open.
          </p>
        </div>
      ) : (
        <ul className="space-y-6">
          {editions.map((e) => (
            <li key={e.slug}>
              <Link
                to={`/editions/${e.slug}`}
                className="card block p-6 !no-underline !text-ink transition hover:border-terracotta"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-terracotta">
                      {e.almanac_year}
                    </p>
                    <h2 className="mt-1 font-serif text-2xl">{e.title}</h2>
                    {e.subtitle && (
                      <p className="mt-1 italic text-muted">{e.subtitle}</p>
                    )}
                  </div>
                  <p className="font-serif text-lg text-terracotta">
                    ${e.price_usd.toFixed(2)}
                  </p>
                </div>
                {e.description && (
                  <p className="mt-4 leading-relaxed text-muted">
                    {e.description}
                  </p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}

      <section className="card bg-paper p-6 text-sm leading-relaxed text-muted">
        <p>
          The almanac is a printed book, not a subscription. We publish
          one each year. When the current year is sold out we print
          more, until the following October, after which the next
          year&rsquo;s volume takes over.
        </p>
      </section>
    </div>
  );
}
