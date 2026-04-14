import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  useEdition,
  startEditionCheckout,
  fetchEditionOrderBySession,
  type EditionOrderDownload,
} from '../lib/editions';
import { authAvailable } from '../lib/auth';

export default function EditionDetailPage() {
  const { slug = '' } = useParams();
  const { edition, loading } = useEdition(slug);
  const [params] = useSearchParams();
  const justPaid = params.get('paid') === '1';
  const isPreview = params.get('preview') === '1';
  const paidFormat = params.get('format');
  const sessionId = params.get('session_id');

  const [busyFormat, setBusyFormat] = useState<'print' | 'pdf' | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [download, setDownload] = useState<EditionOrderDownload | null>(null);
  const [downloadPolling, setDownloadPolling] = useState(false);

  // If the customer just came back from Stripe with a PDF purchase, poll
  // for the order row to appear (the webhook may take a moment).
  useEffect(() => {
    if (paidFormat !== 'pdf' || !sessionId) return;
    let cancelled = false;
    let attempts = 0;
    setDownloadPolling(true);

    async function poll() {
      if (cancelled) return;
      attempts++;
      const order = await fetchEditionOrderBySession(sessionId!);
      if (order?.pdf_download_url) {
        setDownload(order);
        setDownloadPolling(false);
        return;
      }
      if (attempts > 20) {
        setDownloadPolling(false);
        return;
      }
      setTimeout(poll, 1500);
    }
    void poll();

    return () => {
      cancelled = true;
    };
  }, [paidFormat, sessionId]);

  async function buy(format: 'print' | 'pdf') {
    if (!edition) return;
    setBusyFormat(format);
    setErr(null);
    try {
      const url = await startEditionCheckout(edition.slug, format);
      window.location.href = url;
    } catch (e) {
      setErr((e as Error).message);
      setBusyFormat(null);
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

  const hasPrint = edition.format === 'print' || edition.format === 'both';
  const hasPdf = edition.format === 'pdf' || edition.format === 'both';

  return (
    <article className="space-y-10">
      <nav className="text-xs uppercase tracking-widest text-muted">
        <Link to="/">Home</Link> <span className="mx-1 text-rule">/</span>
        <Link to="/editions">Editions</Link> <span className="mx-1 text-rule">/</span>
        <span>{edition.title}</span>
      </nav>

      {isPreview && !edition.published && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <strong>Draft preview.</strong> This edition is not published. You
          are seeing it because the <code>?preview=1</code> query param is
          set. Close this tab and click Publish in the admin when ready.
        </div>
      )}

      {justPaid && paidFormat === 'pdf' && (
        <DownloadCard download={download} polling={downloadPolling} />
      )}

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

          {authAvailable ? (
            <div className="mt-8 space-y-3">
              {hasPrint && (
                <div className="flex items-center justify-between gap-4 rounded-2xl border border-rule bg-surface p-4">
                  <div>
                    <p className="font-serif text-lg">Printed copy</p>
                    <p className="text-xs text-muted">
                      Ships worldwide via Lulu print-on-demand
                    </p>
                  </div>
                  <div className="flex items-baseline gap-3">
                    <span className="font-serif text-2xl">
                      ${edition.price_usd.toFixed(2)}
                    </span>
                    <button
                      type="button"
                      onClick={() => void buy('print')}
                      disabled={busyFormat !== null}
                      className="btn-primary"
                    >
                      {busyFormat === 'print' ? 'Redirectingâ€¦' : 'Order'}
                    </button>
                  </div>
                </div>
              )}
              {hasPdf && edition.price_pdf_usd != null && (
                <div className="flex items-center justify-between gap-4 rounded-2xl border border-rule bg-surface p-4">
                  <div>
                    <p className="font-serif text-lg">PDF download</p>
                    <p className="text-xs text-muted">
                      Instant, worldwide, print-at-home friendly
                    </p>
                  </div>
                  <div className="flex items-baseline gap-3">
                    <span className="font-serif text-2xl">
                      ${edition.price_pdf_usd.toFixed(2)}
                    </span>
                    <button
                      type="button"
                      onClick={() => void buy('pdf')}
                      disabled={busyFormat !== null}
                      className="btn-primary"
                    >
                      {busyFormat === 'pdf' ? 'Redirectingâ€¦' : 'Buy PDF'}
                    </button>
                  </div>
                </div>
              )}
              {err && <p className="text-sm text-terracotta">{err}</p>}
              <p className="text-xs text-muted">
                Payment is handled by Stripe. No accounts required for
                buying.
              </p>
            </div>
          ) : (
            <p className="mt-6 text-muted">
              Direct ordering requires Stripe to be configured on this
              build. See the README for setup.
            </p>
          )}
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

function DownloadCard({
  download,
  polling,
}: {
  download: EditionOrderDownload | null;
  polling: boolean;
}) {
  if (polling) {
    return (
      <div className="card border-terracotta/40 bg-terracotta/5 p-6">
        <p className="text-xs uppercase tracking-widest text-terracotta">
          Payment received
        </p>
        <h2 className="mt-2 font-serif text-2xl">
          Preparing your downloadâ€¦
        </h2>
        <p className="mt-2 text-sm text-muted">
          This usually takes a few seconds. Your link will appear here as
          soon as Stripe and our download service sync up.
        </p>
      </div>
    );
  }
  if (!download || !download.pdf_download_url) {
    return (
      <div className="card p-6">
        <p className="text-sm text-muted">
          Your payment is confirmed. If the download link doesn't appear
          in a moment, check your email &mdash; we'll send it there as a
          backup.
        </p>
      </div>
    );
  }
  return (
    <div className="card border-emerald-200 bg-emerald-50 p-6">
      <p className="text-xs uppercase tracking-widest text-emerald-800">
        Ready to download
      </p>
      <h2 className="mt-2 font-serif text-2xl text-ink">Thank you.</h2>
      <p className="mt-2 text-sm text-ink/80">
        Your cookbook is ready. This link is valid for a year, and we've
        also emailed it to you as a backup.
      </p>
      <a
        href={download.pdf_download_url}
        className="btn-primary mt-4"
        download
      >
        Download the PDF
      </a>
    </div>
  );
}
