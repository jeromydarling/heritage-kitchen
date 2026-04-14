import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useCourse, startCourseCheckout, describeStart } from '../lib/courses';
import { authAvailable } from '../lib/auth';

export default function CourseDetailPage() {
  const { slug = '' } = useParams();
  const { course, loading } = useCourse(slug);
  const [params] = useSearchParams();
  const justPaid = params.get('paid') === '1';
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function buy() {
    if (!course) return;
    setBusy(true);
    setErr(null);
    try {
      const url = await startCourseCheckout(course.slug);
      window.location.href = url;
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  if (loading) return <p className="text-muted">Loadingâ€¦</p>;
  if (!course) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="font-serif text-3xl">Not found</h1>
        <p className="mt-3 text-muted">
          <Link to="/courses">Back to courses</Link>.
        </p>
      </div>
    );
  }

  return (
    <article className="mx-auto max-w-2xl space-y-10">
      <nav className="text-xs uppercase tracking-widest text-muted">
        <Link to="/">Home</Link> <span className="mx-1 text-rule">/</span>
        <Link to="/courses">Courses</Link> <span className="mx-1 text-rule">/</span>
        <span>{course.title}</span>
      </nav>

      {justPaid && (
        <div className="card border-emerald-200 bg-emerald-50 p-6">
          <p className="text-xs uppercase tracking-widest text-emerald-800">
            Payment received
          </p>
          <h2 className="mt-2 font-serif text-2xl text-ink">
            Welcome to the course.
          </h2>
          <p className="mt-2 text-sm text-ink/80">
            {course.start_trigger === 'on_purchase'
              ? "Your first email arrives tomorrow morning."
              : `You're enrolled. Emails will start ${describeStart(course).toLowerCase().replace('starts', '')}`}
          </p>
        </div>
      )}

      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-terracotta">
          {course.total_days}-day course
        </p>
        <h1 className="mt-1 font-serif text-4xl leading-tight">{course.title}</h1>
        {course.subtitle && (
          <p className="mt-2 font-serif text-lg italic text-muted">
            {course.subtitle}
          </p>
        )}
        {course.description && (
          <p className="mt-5 text-lg leading-relaxed text-ink/90">
            {course.description}
          </p>
        )}
      </header>

      <section className="card p-5">
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">Length</dt>
            <dd>{course.total_days} daily emails</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">Starts</dt>
            <dd>{describeStart(course)}</dd>
          </div>
          <div className="flex justify-between border-t border-rule pt-3 font-serif text-lg">
            <dt>Price</dt>
            <dd>${course.price_usd.toFixed(2)}</dd>
          </div>
        </dl>
        <div className="mt-5">
          {authAvailable ? (
            <>
              <button
                type="button"
                onClick={() => void buy()}
                disabled={busy}
                className="btn-primary w-full justify-center"
              >
                {busy ? 'Redirectingâ€¦' : 'Enroll'}
              </button>
              {err && <p className="mt-2 text-sm text-terracotta">{err}</p>}
              <p className="mt-3 text-center text-xs text-muted">
                One-time purchase. No subscription. Payment by Stripe.
              </p>
            </>
          ) : (
            <p className="text-muted">
              Course enrollment requires Stripe to be configured. See the
              README.
            </p>
          )}
        </div>
      </section>

      {course.intro_text && (
        <section className="card bg-paper p-6 sm:p-8">
          <h2 className="font-serif text-2xl">A note from the editors</h2>
          <div className="mt-4 whitespace-pre-line font-serif text-base leading-relaxed">
            {course.intro_text}
          </div>
        </section>
      )}
    </article>
  );
}
