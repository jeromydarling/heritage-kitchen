import { Link } from 'react-router-dom';
import { useEditions } from '../lib/editions';

/**
 * Public bookshelf of Heritage Kitchen editorial cookbooks. Anyone can
 * browse, anyone can buy. Each card links to the detail page for the
 * full description and checkout flow.
 */
export default function EditionsPage() {
  const { editions, loading } = useEditions();

  return (
    <div className="space-y-10">
      <header className="max-w-2xl">
        <p className="text-xs uppercase tracking-[0.2em] text-terracotta">
          The bookshelf
        </p>
        <h1 className="mt-1 font-serif text-4xl sm:text-5xl">
          Heritage Kitchen editions
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-muted">
          Short, honest cookbooks assembled from the library by hand. Each
          edition is printed on demand and shipped to your door. No
          subscriptions, no recurring charges &mdash; just a book when you
          want one.
        </p>
      </header>

      {loading ? (
        <p className="text-muted">Loading the bookshelfâ€¦</p>
      ) : editions.length === 0 ? (
        <div className="card p-8 text-muted">
          <p>
            The first editions are being typeset. Check back soon &mdash;
            or start{' '}
            <Link to="/cookbook/build">building your own cookbook</Link> in
            the meantime.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {editions.map((e) => (
            <Link
              key={e.slug}
              to={`/editions/${e.slug}`}
              className="card group flex flex-col overflow-hidden !no-underline !text-ink transition hover:-translate-y-0.5 hover:border-terracotta"
            >
              <div className="aspect-[2/3] border-b border-rule bg-paper">
                {e.cover_image_url ? (
                  <img
                    src={e.cover_image_url}
                    alt={e.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <PlaceholderCover title={e.title} subtitle={e.subtitle} />
                )}
              </div>
              <div className="flex flex-1 flex-col gap-2 p-5">
                <h2 className="font-serif text-xl leading-tight">{e.title}</h2>
                {e.subtitle && (
                  <p className="text-sm italic text-muted">{e.subtitle}</p>
                )}
                <div className="mt-auto flex items-baseline justify-between pt-3">
                  <p className="font-serif text-base">
                    {e.format === 'pdf'
                      ? `PDF $${(e.price_pdf_usd ?? 0).toFixed(2)}`
                      : e.format === 'both' && e.price_pdf_usd
                        ? `From $${e.price_pdf_usd.toFixed(2)}`
                        : `$${e.price_usd.toFixed(2)}`}
                  </p>
                  {e.format === 'pdf' && (
                    <span className="rounded-full border border-rule px-2 py-0.5 text-[10px] uppercase tracking-widest text-muted">
                      Instant
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <section className="card bg-paper p-6 text-sm leading-relaxed text-muted">
        <p>
          Every edition is printed by{' '}
          <a href="https://www.lulu.com" target="_blank" rel="noreferrer">
            Lulu
          </a>{' '}
          on acid-free paper and ships worldwide. Because we print on
          demand, there is no warehouse, no waste, and no pre-order. Your
          book is made for you after you order it.
        </p>
      </section>
    </div>
  );
}

function PlaceholderCover({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string | null;
}) {
  return (
    <div
      className="flex h-full w-full flex-col items-center justify-center p-6 text-center"
      style={{
        backgroundImage:
          'radial-gradient(ellipse at top, rgba(168,75,47,0.12), transparent 70%), repeating-linear-gradient(0deg, rgba(59,35,20,0.04) 0px, rgba(59,35,20,0.04) 1px, transparent 1px, transparent 4px)',
      }}
    >
      <p className="text-[9px] uppercase tracking-[0.3em] text-terracotta">
        Heritage Kitchen
      </p>
      <h3 className="mt-6 font-serif text-lg leading-tight text-ink">
        {title}
      </h3>
      {subtitle && (
        <p className="mt-3 font-serif text-xs italic text-muted">{subtitle}</p>
      )}
      <div className="mt-auto pt-6 text-[9px] italic text-muted">
        ever ancient, ever new
      </div>
    </div>
  );
}
