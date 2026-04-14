import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useLesson, loadLessons, TOPIC_META, type Lesson } from '../lib/lessons';
import { loadRecipes } from '../lib/recipes';
import type { Recipe } from '../lib/types';

/**
 * The detail page for a single lesson. Layout:
 *
 *   - Breadcrumb (Home / How to Cook / topic / title)
 *   - Source attribution in small caps
 *   - Title in Playfair display
 *   - Key takeaways callout
 *   - The original text (paper-styled, typewriter font)
 *   - Modern explanation (serif body, generous leading)
 *   - "Still true / Needs updating" two-column block -- the trust filter,
 *     the feature that makes this section credible instead of nostalgic
 *   - Related recipes from the library
 *   - "More on this topic" navigation
 */
export default function LessonDetailPage() {
  const { id = '' } = useParams();
  const { lesson, loading } = useLesson(id);
  const [params] = useSearchParams();
  const isPreview = params.get('preview') === '1';
  const [related, setRelated] = useState<Recipe[]>([]);
  const [neighbors, setNeighbors] = useState<{ prev: Lesson | null; next: Lesson | null }>({
    prev: null,
    next: null,
  });

  useEffect(() => {
    if (!lesson) return;
    let cancelled = false;

    // Related recipes: any recipe whose category or tags overlap with
    // the lesson's related_recipe_tags. Cheap filter over the loaded
    // library.
    void loadRecipes().then((recipes) => {
      if (cancelled) return;
      const wants = new Set(
        (lesson.related_recipe_tags ?? []).map((t) => t.toLowerCase()),
      );
      const matches = recipes
        .filter((r) => {
          if (wants.has(r.category.toLowerCase())) return true;
          const tags = (r.tags ?? []).map((t) => t.toLowerCase());
          return tags.some((t) => wants.has(t));
        })
        .slice(0, 6);
      setRelated(matches);
    });

    // Prev/next within the same topic
    void loadLessons().then((all) => {
      if (cancelled) return;
      const sameTopic = all.filter((l) => l.topic === lesson.topic);
      const idx = sameTopic.findIndex((l) => l.id === lesson.id);
      setNeighbors({
        prev: idx > 0 ? sameTopic[idx - 1] : null,
        next: idx < sameTopic.length - 1 ? sameTopic[idx + 1] : null,
      });
    });

    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    return () => {
      cancelled = true;
    };
  }, [lesson]);

  useEffect(() => {
    if (!lesson) return;
    const prev = document.title;
    document.title = `${lesson.title} â€” How to Cook â€” Heritage Kitchen`;
    return () => {
      document.title = prev;
    };
  }, [lesson]);

  const topicMeta = useMemo(
    () => (lesson ? TOPIC_META[lesson.topic] : undefined),
    [lesson],
  );

  if (loading) return <p className="text-muted">Loadingâ€¦</p>;
  if (!lesson) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="font-serif text-3xl">Lesson not found</h1>
        <p className="mt-3 text-muted">
          <Link to="/how-to-cook">Back to How to Cook</Link>
        </p>
      </div>
    );
  }

  return (
    <article className="mx-auto max-w-3xl space-y-10">
      {isPreview && !lesson.published && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <strong>Draft preview.</strong> This lesson is not published yet.
          You are seeing it because the <code>?preview=1</code> query param
          is set.
        </div>
      )}
      <nav className="text-xs uppercase tracking-widest text-muted">
        <Link to="/">Home</Link> <span className="mx-1 text-rule">/</span>
        <Link to="/how-to-cook">How to Cook</Link>{' '}
        <span className="mx-1 text-rule">/</span>
        <Link to={`/how-to-cook?topic=${lesson.topic}`}>
          {topicMeta?.label ?? lesson.topic}
        </Link>{' '}
        <span className="mx-1 text-rule">/</span>
        <span>{lesson.title}</span>
      </nav>

      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-terracotta">
          {topicMeta?.label ?? lesson.topic} Â· {lesson.source_book} Â· {lesson.source_year}
        </p>
        <h1 className="mt-1 font-serif text-4xl leading-tight sm:text-5xl">
          {lesson.title}
        </h1>
        <p className="mt-2 text-sm italic text-muted">
          by {lesson.source_author}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="chip capitalize">{lesson.difficulty}</span>
          {lesson.fun_for_kids && (
            <span className="chip border-terracotta/40 text-terracotta">
              Kid-friendly
            </span>
          )}
        </div>
      </header>

      {lesson.key_takeaways?.length > 0 && (
        <section className="card bg-paper p-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-terracotta">
            The takeaways
          </p>
          <ul className="mt-3 space-y-2">
            {lesson.key_takeaways.map((t, i) => (
              <li key={i} className="flex items-start gap-3 text-sm leading-relaxed">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-terracotta" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="paper rounded-2xl border border-rule p-6 shadow-card sm:p-10">
        <p className="mb-4 font-serif text-xs uppercase tracking-[0.2em] text-terracotta">
          As written in {lesson.source_year}
        </p>
        <pre className="whitespace-pre-wrap font-mono text-[0.92rem] leading-relaxed text-ink">
          {lesson.original_text}
        </pre>
      </section>

      <section>
        <h2 className="font-serif text-2xl">What&rsquo;s actually going on</h2>
        <div className="mt-4 space-y-4 text-base leading-relaxed text-ink/90">
          {lesson.modern_explanation.split(/\n\n+/).map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border-l-4 border-l-emerald-700 border-y border-r border-rule bg-surface p-5">
          <p className="text-[0.7rem] font-semibold uppercase tracking-widest text-emerald-800">
            Still true
          </p>
          <p className="mt-2 text-sm leading-relaxed text-ink/90">
            {lesson.still_true}
          </p>
        </div>
        <div className="rounded-2xl border-l-4 border-l-terracotta border-y border-r border-rule bg-surface p-5">
          <p className="text-[0.7rem] font-semibold uppercase tracking-widest text-terracotta">
            Needs updating
          </p>
          <p className="mt-2 text-sm leading-relaxed text-ink/90">
            {lesson.outdated}
          </p>
        </div>
      </section>

      {related.length > 0 && (
        <section>
          <h2 className="font-serif text-2xl">Put it to work</h2>
          <p className="mt-1 text-sm text-muted">
            Recipes in the library that rely on what you just read.
          </p>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {related.map((r) => (
              <li key={r.id}>
                <Link
                  to={`/recipe/${r.id}`}
                  className="card block p-4 !no-underline !text-ink transition hover:border-terracotta"
                >
                  <div className="font-serif text-base leading-tight">
                    {r.title}
                  </div>
                  <div className="mt-1 text-xs italic text-muted">
                    {r.source_book} Â· {r.source_year}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card p-5">
        <p className="text-xs uppercase tracking-widest text-muted">Source</p>
        <p className="mt-2 text-sm leading-relaxed">
          {lesson.source_book}
          <br />
          <em>{lesson.source_author}, {lesson.source_year}</em>
        </p>
        {lesson.source_url && (
          <a
            href={lesson.source_url}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-block text-sm"
          >
            Read the original on Project Gutenberg &rarr;
          </a>
        )}
      </section>

      <nav className="flex items-stretch justify-between gap-3 border-t border-rule pt-6">
        <div className="flex-1">
          {neighbors.prev && (
            <Link
              to={`/how-to-cook/${neighbors.prev.id}`}
              className="block rounded-2xl border border-rule bg-surface p-4 !no-underline !text-ink hover:border-terracotta"
            >
              <p className="text-[10px] uppercase tracking-widest text-muted">
                Previous in {topicMeta?.label ?? lesson.topic}
              </p>
              <p className="mt-1 font-serif text-sm leading-tight">
                &larr; {neighbors.prev.title}
              </p>
            </Link>
          )}
        </div>
        <div className="flex-1">
          {neighbors.next && (
            <Link
              to={`/how-to-cook/${neighbors.next.id}`}
              className="block rounded-2xl border border-rule bg-surface p-4 text-right !no-underline !text-ink hover:border-terracotta"
            >
              <p className="text-[10px] uppercase tracking-widest text-muted">
                Next in {topicMeta?.label ?? lesson.topic}
              </p>
              <p className="mt-1 font-serif text-sm leading-tight">
                {neighbors.next.title} &rarr;
              </p>
            </Link>
          )}
        </div>
      </nav>
    </article>
  );
}
