import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useLessons } from '../lib/lessons';
import { LessonCard } from './HowToCookPage';

/**
 * The kids track: a filtered view of How to Cook showing only lessons
 * flagged fun_for_kids. Framed editorially as an invitation to cook with
 * your children -- the heritage-to-the-next-generation pitch in its
 * purest form.
 */
export default function HowToCookKidsPage() {
  const { lessons, loading } = useLessons();

  const kidsLessons = useMemo(
    () => lessons.filter((l) => l.fun_for_kids),
    [lessons],
  );

  return (
    <div className="space-y-10">
      <header className="max-w-3xl">
        <p className="text-xs uppercase tracking-[0.2em] text-terracotta">
          Kids in the kitchen
        </p>
        <h1 className="mt-1 font-serif text-4xl sm:text-5xl">
          How to Cook, with your children
        </h1>
        <p className="mt-5 text-lg leading-relaxed text-muted">
          Sixty-five lessons from the kitchen school that are simple
          enough, hands-on enough, and interesting enough to do with your
          kids over a weekend morning. Not dumbed-down versions of the
          adult lessons &mdash; these are the lessons the 1920s
          home-economics textbooks used to teach children in the first
          place.
        </p>
        <p className="mt-4 text-base leading-relaxed text-muted">
          We built this track because the best thing to pass down to a
          child is not money or advice. It is a set of hands that know
          how to do something useful in the world &mdash; and the kitchen
          is the best place to start.
        </p>
      </header>

      <section className="card bg-paper p-6">
        <h2 className="font-serif text-lg">How to use these with your kids</h2>
        <ul className="mt-3 space-y-2 text-sm leading-relaxed text-muted">
          <li>
            <strong className="font-serif text-ink">Start with the takeaways.</strong>{' '}
            Every lesson has a bullet list at the top. Read the bullets
            together and then go into the kitchen.
          </li>
          <li>
            <strong className="font-serif text-ink">Let them read the original.</strong>{' '}
            The 1920 text is surprisingly readable for a child, and it
            is a real, old book. Kids notice the difference.
          </li>
          <li>
            <strong className="font-serif text-ink">Skip the science lecture if it isn&rsquo;t landing.</strong>{' '}
            The modern explanation is there when they ask <em>why</em>,
            not as something to grind through.
          </li>
          <li>
            <strong className="font-serif text-ink">Cook a recipe after.</strong>{' '}
            Every lesson links to recipes in the library that use the
            technique. Finish in the stomach, not the head.
          </li>
        </ul>
      </section>

      {loading ? (
        <p className="text-muted">Loadingâ€¦</p>
      ) : (
        <section>
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="font-serif text-2xl">
              {kidsLessons.length} lessons
            </h2>
            <Link to="/how-to-cook" className="text-xs text-terracotta hover:underline">
              All lessons &rarr;
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {kidsLessons.map((l) => (
              <LessonCard key={l.id} lesson={l} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
