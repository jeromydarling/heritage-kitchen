import { useMemo } from 'react';
import { useSponsors, TIER_LABELS, type Sponsor } from '../lib/sponsors';

/**
 * The "Friends of Heritage Kitchen" page â€” annual sponsorship credits
 * written as museum donor plaques, not banner ads. Three tiers
 * (Patrons, Supporters, Friends). Each sponsor gets a short paragraph
 * of prose and a plain link to their site. No logos in the content,
 * no pop-ups, no impressions. This page is the only place their names
 * appear, which is exactly the trade we want to make.
 */
export default function FriendsPage() {
  const { sponsors, loading } = useSponsors();

  const byTier = useMemo(() => {
    const groups = new Map<string, Sponsor[]>();
    for (const s of sponsors) {
      if (!groups.has(s.tier)) groups.set(s.tier, []);
      groups.get(s.tier)!.push(s);
    }
    return groups;
  }, [sponsors]);

  return (
    <div className="mx-auto max-w-3xl space-y-12">
      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-terracotta">
          With gratitude
        </p>
        <h1 className="mt-1 font-serif text-4xl sm:text-5xl">
          Friends of Heritage Kitchen
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-muted">
          Heritage Kitchen doesn&rsquo;t run ads. We don&rsquo;t sell
          impressions, we don&rsquo;t embed tracking scripts, and we
          don&rsquo;t let anyone influence the editorial. What we do
          accept is sponsorship from companies whose work we already
          admire &mdash; the mills, foundries, spice importers, and
          small-batch food makers who are quietly keeping real
          ingredients alive. Their annual gift keeps this project
          going, and this page is our thank-you note.
        </p>
        <p className="mt-3 text-lg leading-relaxed text-muted">
          The list is short because we are careful. If you run a
          business that belongs here and want to talk about an annual
          sponsorship, there are details at the bottom of the page.
        </p>
      </header>

      {loading ? (
        <p className="text-muted">Loadingâ€¦</p>
      ) : sponsors.length === 0 ? (
        <div className="card p-8 text-center text-muted">
          <p className="font-serif text-lg italic">
            This page is waiting for its first friends.
          </p>
          <p className="mt-2 text-sm">
            If you&rsquo;d like to help, see below.
          </p>
        </div>
      ) : (
        (['patron', 'supporter', 'friend'] as const).map((tier) => {
          const list = byTier.get(tier);
          if (!list || list.length === 0) return null;
          return (
            <section key={tier} className="space-y-5">
              <h2 className="font-serif text-2xl">{TIER_LABELS[tier]}</h2>
              <ul className="space-y-6">
                {list.map((s) => (
                  <li key={s.slug} className="card p-5">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h3 className="font-serif text-xl leading-tight">
                        {s.name}
                      </h3>
                      {s.since && (
                        <p className="text-xs text-muted">since {s.since.slice(0, 4)}</p>
                      )}
                    </div>
                    {s.description && (
                      <p className="mt-3 leading-relaxed text-ink/90">
                        {s.description}
                      </p>
                    )}
                    {s.url && (
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 inline-block text-sm"
                      >
                        {s.url.replace(/^https?:\/\//, '').replace(/\/$/, '')} â†—
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}

      <section className="card bg-paper p-6">
        <h2 className="font-serif text-2xl text-ink">Become a friend</h2>
        <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted">
          <p>
            Annual sponsorships come in three tiers. Every tier gets a
            permanent place on this page with a short prose credit, and
            nothing else. No logo placements on recipe pages, no
            sponsored content, no pop-ups. The editorial is always ours.
          </p>
          <dl className="mt-4 space-y-3">
            <div>
              <dt className="font-serif text-base text-ink">
                Patron &middot; $2,500 / year
              </dt>
              <dd className="mt-1">
                Top billing on this page with a paragraph-length
                write-up, and a sponsored editorial project once a year
                &mdash; e.g. a recipe series on your ingredient, written
                by us with full editorial control.
              </dd>
            </div>
            <div>
              <dt className="font-serif text-base text-ink">
                Supporter &middot; $1,000 / year
              </dt>
              <dd className="mt-1">
                Listed on this page with a short prose credit. A line in
                the acknowledgments of whichever Heritage Kitchen
                edition ships that year.
              </dd>
            </div>
            <div>
              <dt className="font-serif text-base text-ink">
                Friend &middot; $300 / year
              </dt>
              <dd className="mt-1">
                A single-line thank-you on this page. Perfect for small
                makers.
              </dd>
            </div>
          </dl>
          <p className="mt-4">
            To discuss sponsorship, write to{' '}
            <a href="mailto:friends@heritagekitchen.app">
              friends@heritagekitchen.app
            </a>
            . We read every note.
          </p>
        </div>
      </section>
    </div>
  );
}
