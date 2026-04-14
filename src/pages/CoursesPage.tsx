import { Link } from 'react-router-dom';
import { useCourses, describeStart } from '../lib/courses';

/**
 * Public listing of Heritage Kitchen email courses. One-time purchase,
 * multi-day delivery, no subscription. Think: The Lenten Table, The
 * Advent Pantry, The Twelve Days of Christmas.
 */
export default function CoursesPage() {
  const { courses, loading } = useCourses();

  return (
    <div className="space-y-10">
      <header className="max-w-2xl">
        <p className="text-xs uppercase tracking-[0.2em] text-terracotta">
          One email a day
        </p>
        <h1 className="mt-1 font-serif text-4xl sm:text-5xl">Courses</h1>
        <p className="mt-4 text-lg leading-relaxed text-muted">
          Short email courses that walk you through a liturgical season
          in the kitchen, one morning at a time. Each course is a
          one-time purchase &mdash; no subscription &mdash; and ends when
          the season does.
        </p>
      </header>

      {loading ? (
        <p className="text-muted">Loadingâ€¦</p>
      ) : courses.length === 0 ? (
        <div className="card p-8 text-muted">
          <p>
            The first courses are being written. Check back soon, or{' '}
            <Link to="/editions">browse the editions bookshelf</Link> in
            the meantime.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((c) => (
            <Link
              key={c.slug}
              to={`/courses/${c.slug}`}
              className="card group flex flex-col gap-3 p-6 !no-underline !text-ink transition hover:-translate-y-0.5 hover:border-terracotta"
            >
              <p className="text-xs uppercase tracking-widest text-terracotta">
                {c.total_days} days
              </p>
              <h2 className="font-serif text-2xl leading-tight">{c.title}</h2>
              {c.subtitle && (
                <p className="text-sm italic text-muted">{c.subtitle}</p>
              )}
              <p className="mt-2 text-xs text-muted">{describeStart(c)}</p>
              <p className="mt-auto pt-3 font-serif text-lg">
                ${c.price_usd.toFixed(2)}
              </p>
            </Link>
          ))}
        </div>
      )}

      <section className="card bg-paper p-6 text-sm leading-relaxed text-muted">
        <p>
          Every course is a <em>one-time purchase</em>. Nothing renews.
          You buy the course, we walk you through the season, and then
          you're done &mdash; unless you want to do it again next year,
          which some people do, because the seasons come back and so do
          we.
        </p>
      </section>
    </div>
  );
}
