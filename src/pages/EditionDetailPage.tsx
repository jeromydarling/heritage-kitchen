import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useEdition, startEditionCheckout } from '../lib/editions';
import { authAvailable } from '../lib/auth';

export default function EditionDetailPage() {
  const { slug = '' } = useParams();
  const { edition, loading } = useEdition(slug);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function buy() {
    if (!edition) return;
    setBusy(true);
    setErr(null);
    try {
      const url = await startEditionCheckout(edition.slug);
      window.location.href = url;
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  if (loading) return <p className="text-muted">Loadingâ€¦</p>;
  if (!edition) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="font-serif text-3xl">Not found</h1>
        <p className="mt-3 text-muted">
          We can't find that edition. <Link to="/editions">Back to the bookshelf</Link>.
        </p>
      </div>
    );
  }

  return (
    <article className="space-y-10">
      <nav className="text-xs uppercase tracking-widest text-muted">
        <Link to="/">Home</Link> <span className="mx-1 text-rule">/</span>
        <Link to="/editions">Editions</Link> <span className="mx-1 text-rule">/</span>
        <span>{edition.title}</span>
      </nav>

      <header className="grid gap-8 sm:grid-cols-5">
        <div className="sm:col-span-2">
          <div className="aspect-[2/3] overflow-hidden rounded-2xl border border-rule bg-paper shadow-card">
            {edition.cover_image_url ? (
              <img
                src={edition.cover_image_url}
                alt={edition.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center p-8 text-center">
                <p className="text-[10px] uppercase tracking-[0.3em] text-terracotta">
                  Heritage Kitchen
                </p>
                <h2 className="mt-6 font-serif text-xl leading-tight">
                  {edition.title}
                </h2>
                {edition.subtitle && (
                  <p className="mt-3 font-serif text-xs italic text-muted">
                    {edition.subtitle}
                  </p>
                )}
                <p className="mt-auto pt-8 text-[10px] italic text-muted">
                  ever ancient, ever new
                </p>
              </div>
            )}
          </div>
        </div>
        <div className="sm:col-span-3">
          <p className="text-xs uppercase tracking-widest text-terracotta">
            Heritage Kitchen edition
          </p>
          <h1 className="mt-1 font-serif text-4xl leading-tight">
            {edition.title}
          </h1>
          {edition.subtitle && (
            <p className="mt-2 font-serif text-lg italic text-muted">
              {edition.subtitle}
            </p>
          )}
          {edition.description && (
            <p className="mt-5 text-lg leading-relaxed text-ink/90">
              {edition.description}
            </p>
          )}

          <div className="mt-8 flex items-baseline gap-4">
            <span className="font-serif text-3xl">
              ${edition.price_usd.toFixed(2)}
            </span>
            <span className="text-sm text-muted">Printed and shipped</span>
          </div>

          <div className="mt-6 space-y-3">
            {authAvailable ? (
              <>
                <button
                  type="button"
                  onClick={() => void buy()}
                  disabled={busy}
                  className="btn-primary w-full sm:w-auto"
                >
                  {busy ? 'Redirecting to checkoutâ€¦' : 'Order a copy'}
                </button>
                {err && <p className="text-sm text-terracotta">{err}</p>}
                <p className="text-xs text-muted">
                  Payment is handled by Stripe. Shipping worldwide via
                  Lulu print-on-demand &mdash; usually ships within a week.
                </p>
              </>
            ) : (
              <p className="text-muted">
                Direct ordering requires Stripe to be configured on this
                build. See the README for setup.
              </p>
            )}
          </div>
        </div>
      </header>

      {edition.intro_text && (
        <section className="card bg-paper p-6 sm:p-10">
          <h2 className="font-serif text-2xl">A note from the editors</h2>
          <div className="mt-4 space-y-3 whitespace-pre-line font-serif text-base leading-relaxed">
            {edition.intro_text}
          </div>
        </section>
      )}

      {edition.recipe_ids.length > 0 && (
        <section>
          <h2 className="font-serif text-2xl">What's inside</h2>
          <p className="mt-1 text-sm text-muted">
            {edition.recipe_ids.length} recipes, laid out one per section
            with ingredients, instructions, and a short historical note.
          </p>
        </section>
      )}
    </article>
  );
}
