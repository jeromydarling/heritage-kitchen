import { Link } from 'react-router-dom';
import { useMonasteries } from '../lib/monasteries';

/**
 * A directory of monastic food makers whose sales support real
 * contemplative communities. Each monastery is a short editorial entry
 * with a link out to the order page. This page is explicitly not a
 * store category â€” it's a "list of houses," written the way a careful
 * magazine would write it.
 */
export default function MonasteriesPage() {
  const { list, loading } = useMonasteries();

  return (
    <div className="mx-auto max-w-3xl space-y-12">
      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-terracotta">
          From the monastery
        </p>
        <h1 className="mt-1 font-serif text-4xl sm:text-5xl">
          A short directory of monastic kitchens
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-muted">
          For sixteen centuries Benedictine, Cistercian, and Camaldolese
          communities have supported themselves by the work of their own
          hands &mdash; the old phrase <em>ora et labora</em>, "pray and
          work," is what Benedict meant when he wrote his Rule. In the
          United States that still largely takes the form of food: the
          fruitcakes, cheeses, mushrooms, jams, and beers that
          contemplative houses ship out into the world.
        </p>
        <p className="mt-3 text-lg leading-relaxed text-muted">
          We keep a small list of these kitchens here. Buying from them
          is closer to underwriting a real community than it is to
          ordinary grocery shopping &mdash; and in our experience, the
          food is also usually better than anything you can get at a
          supermarket.
        </p>
      </header>

      {loading ? (
        <p className="text-muted">Loadingâ€¦</p>
      ) : (
        <ul className="space-y-10">
          {list.map((m) => (
            <li key={m.slug} className="border-t border-rule pt-8">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-serif text-2xl leading-tight">
                  <Link to={`/monasteries/${m.slug}`} className="!text-ink hover:!text-terracotta">
                    {m.name}
                  </Link>
                </h2>
                {m.tradition && (
                  <p className="text-xs uppercase tracking-widest text-muted">
                    {m.tradition}
                  </p>
                )}
              </div>
              <p className="mt-1 text-sm italic text-muted">
                {m.location}
                {m.founded && ` Â· since ${m.founded}`}
              </p>
              {m.description && (
                <p className="mt-4 leading-relaxed text-ink/90">
                  {m.description}
                </p>
              )}
              {m.products_summary && (
                <p className="mt-3 text-sm text-muted">
                  <strong className="font-serif text-ink">They sell:</strong>{' '}
                  {m.products_summary}
                </p>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                {m.shop_url && (
                  <a href={m.shop_url} target="_blank" rel="noreferrer" className="btn-primary">
                    Visit their shop
                  </a>
                )}
                {m.website_url && (
                  <a href={m.website_url} target="_blank" rel="noreferrer" className="btn">
                    About the community
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <section className="card bg-paper p-6 text-sm leading-relaxed text-muted">
        <p>
          If you run a monastic kitchen and would like to be added to
          this list, write to us. We read everything and we take the
          community's own wishes about visibility into account.
        </p>
      </section>
    </div>
  );
}
