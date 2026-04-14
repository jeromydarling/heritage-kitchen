import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useMonastery } from '../lib/monasteries';

export default function MonasteryDetailPage() {
  const { slug = '' } = useParams();
  const { monastery, loading } = useMonastery(slug);
  const [params] = useSearchParams();
  const isPreview = params.get('preview') === '1';

  if (loading) return <p className="text-muted">Loadingâ€¦</p>;
  if (!monastery) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="font-serif text-3xl">Not found</h1>
        <p className="mt-3 text-muted">
          <Link to="/monasteries">Back to the directory</Link>.
        </p>
      </div>
    );
  }

  return (
    <article className="mx-auto max-w-2xl space-y-8">
      {isPreview && !monastery.published && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <strong>Draft preview.</strong> This monastery is not published yet.
        </div>
      )}
      <nav className="text-xs uppercase tracking-widest text-muted">
        <Link to="/">Home</Link> <span className="mx-1 text-rule">/</span>
        <Link to="/monasteries">Monasteries</Link>{' '}
        <span className="mx-1 text-rule">/</span>
        <span>{monastery.name}</span>
      </nav>

      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-terracotta">
          {monastery.tradition ?? 'Monastic community'}
        </p>
        <h1 className="mt-1 font-serif text-4xl leading-tight">
          {monastery.name}
        </h1>
        <p className="mt-2 text-sm italic text-muted">
          {monastery.location}
          {monastery.founded && ` Â· founded ${monastery.founded}`}
        </p>
      </header>

      {monastery.description && (
        <div className="space-y-4 text-lg leading-relaxed">
          {monastery.description.split(/\n\n+/).map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>
      )}

      {monastery.products_summary && (
        <section className="card p-5">
          <h2 className="font-serif text-lg">What the kitchen ships</h2>
          <p className="mt-2 text-muted">{monastery.products_summary}</p>
        </section>
      )}

      <div className="flex flex-wrap gap-2">
        {monastery.shop_url && (
          <a
            href={monastery.shop_url}
            target="_blank"
            rel="noreferrer"
            className="btn-primary"
          >
            Visit their shop
          </a>
        )}
        {monastery.website_url && (
          <a
            href={monastery.website_url}
            target="_blank"
            rel="noreferrer"
            className="btn"
          >
            About the community
          </a>
        )}
      </div>
    </article>
  );
}
