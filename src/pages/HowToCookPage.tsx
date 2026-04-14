import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useLessons, TOPIC_META, type Lesson, type Difficulty } from '../lib/lessons';

/**
 * The /how-to-cook index. Shows every lesson, filtered by topic chips,
 * difficulty, and an optional "kids" toggle. The page is deliberately
 * framed as a classroom you can walk into and browse -- not as a linear
 * course with a start and finish.
 */
export default function HowToCookPage() {
  const { lessons, loading } = useLessons();
  const [params, setParams] = useSearchParams();
  const topic = params.get('topic') ?? '';
  const diff = (params.get('difficulty') ?? '') as Difficulty | '';
  const kidsOnly = params.get('kids') === '1';

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
  }

  const topicCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const l of lessons) counts[l.topic] = (counts[l.topic] ?? 0) + 1;
    return counts;
  }, [lessons]);

  const sortedTopics = useMemo(() => {
    return Object.keys(topicCounts)
      .sort((a, b) => topicCounts[b] - topicCounts[a]);
  }, [topicCounts]);

  const filtered = useMemo(() => {
    return lessons.filter((l) => {
      if (topic && l.topic !== topic) return false;
      if (diff && l.difficulty !== diff) return false;
      if (kidsOnly && !l.fun_for_kids) return false;
      return true;
    });
  }, [lessons, topic, diff, kidsOnly]);

  return (
    <div className="space-y-10">
      <header className="max-w-3xl">
        <p className="text-xs uppercase tracking-[0.2em] text-terracotta">
          The kitchen school
        </p>
        <h1 className="mt-1 font-serif text-4xl sm:text-5xl">How to Cook</h1>
        <p className="mt-4 text-lg leading-relaxed text-muted">
          One hundred and fifty-eight lessons drawn from the home-economics
          textbooks of the 1890s through the 1920s &mdash; the books our
          great-grandmothers were actually handed at school and told to
          master before anyone let them feed a family. Yeast biology, wood
          stoves, the chemistry of a roux, how to cook for someone who is
          sick, how to feed a house on a farmer's budget. Every lesson
          shows you the original text, the modern explanation, and an
          honest split between <em>what the 1900s got right and what we
          know better now</em>.
        </p>
      </header>

      {loading ? (
        <p className="text-muted">Loading the curriculumâ€¦</p>
      ) : (
        <>
          <section className="space-y-4">
            <h2 className="font-serif text-lg">Filter the shelf</h2>
            <div className="flex flex-wrap gap-2">
              <FilterChip
                label={`All topics (${lessons.length})`}
                active={!topic}
                onClick={() => setParam('topic', '')}
              />
              {sortedTopics.map((t) => (
                <FilterChip
                  key={t}
                  label={`${TOPIC_META[t]?.label ?? t} (${topicCounts[t]})`}
                  active={topic === t}
                  onClick={() => setParam('topic', topic === t ? '' : t)}
                />
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {(['beginner', 'intermediate', 'advanced'] as Difficulty[]).map((d) => (
                <FilterChip
                  key={d}
                  label={d}
                  active={diff === d}
                  onClick={() => setParam('difficulty', diff === d ? '' : d)}
                />
              ))}
              <FilterChip
                label="Fun for kids"
                active={kidsOnly}
                onClick={() => setParam('kids', kidsOnly ? '' : '1')}
                accent
              />
              <Link
                to="/how-to-cook/kids"
                className="ml-auto text-xs text-terracotta hover:underline"
              >
                The kids track &rarr;
              </Link>
            </div>
          </section>

          {topic && TOPIC_META[topic] && (
            <section className="card bg-paper p-5">
              <p className="font-serif text-lg text-ink">{TOPIC_META[topic].label}</p>
              <p className="mt-1 text-sm italic text-muted">
                {TOPIC_META[topic].blurb}
              </p>
            </section>
          )}

          <section>
            <p className="mb-4 text-sm text-muted">
              {filtered.length} lesson{filtered.length === 1 ? '' : 's'}
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((l) => (
                <LessonCard key={l.id} lesson={l} />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
  accent,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  accent?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs capitalize ${
        active
          ? 'border-terracotta bg-terracotta text-cream'
          : accent
            ? 'border-terracotta/40 bg-terracotta/5 text-terracotta hover:border-terracotta'
            : 'border-rule bg-surface text-muted hover:border-terracotta'
      }`}
    >
      {label}
    </button>
  );
}

export function LessonCard({ lesson }: { lesson: Lesson }) {
  return (
    <Link
      to={`/how-to-cook/${lesson.id}`}
      className="card group flex flex-col gap-2 p-5 !no-underline !text-ink transition hover:-translate-y-0.5 hover:border-terracotta"
    >
      <p className="text-xs uppercase tracking-widest text-terracotta">
        {TOPIC_META[lesson.topic]?.label ?? lesson.topic}
      </p>
      <h3 className="font-serif text-lg leading-tight">{lesson.title}</h3>
      <p className="text-xs text-muted">
        {lesson.source_book} Â· {lesson.source_year}
      </p>
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-3 text-xs">
        <span className="chip capitalize">{lesson.difficulty}</span>
        {lesson.fun_for_kids && (
          <span className="chip border-terracotta/40 text-terracotta">Kid-friendly</span>
        )}
      </div>
    </Link>
  );
}
