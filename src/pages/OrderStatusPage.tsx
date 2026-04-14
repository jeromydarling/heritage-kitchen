import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useUser } from '../lib/auth';

interface OrderProject {
  id: string;
  title: string;
  subtitle: string | null;
  status: string;
  lulu_order_id: string | null;
  lulu_status: string | null;
  lulu_total_cost: number | null;
  lulu_currency: string | null;
  lulu_tracking_url: string | null;
  page_count: number | null;
  shipping_address: Record<string, string> | null;
  updated_at: string;
}

/**
 * The order status page at /order/:id. Shows where a printed cookbook
 * order sits in the production/shipping lifecycle. The page re-fetches
 * every 10 seconds so that customers who come back after payment or a
 * day or two later see the latest status without a manual reload.
 */
export default function OrderStatusPage() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const justPaid = params.get('paid') === '1';
  const user = useUser();
  const [project, setProject] = useState<OrderProject | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!user || !supabase) {
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from('cookbook_projects')
        .select(
          'id, title, subtitle, status, lulu_order_id, lulu_status, lulu_total_cost, lulu_currency, lulu_tracking_url, page_count, shipping_address, updated_at',
        )
        .eq('id', id)
        .eq('user_id', user.id)
        .maybeSingle();
      if (!cancelled) {
        setProject((data as OrderProject) ?? null);
        setLoading(false);
      }
    }
    void load();
    const timer = setInterval(load, 10000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [id, user]);

  if (loading) return <p className="text-muted">Loadingâ€¦</p>;
  if (!project) {
    return (
      <p className="text-muted">
        No order found with that id. <Link to="/cookbook">Back to cookbook</Link>.
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-8">
      {justPaid && (
        <div className="card border-terracotta/40 bg-terracotta/5 p-4 text-sm">
          Payment received. Weâ€™ve sent your book to Lulu â€” you'll see the
          status change here as it moves through production and shipping.
        </div>
      )}

      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-terracotta">
          Order status
        </p>
        <h1 className="mt-1 font-serif text-3xl">{project.title}</h1>
        {project.subtitle && (
          <p className="mt-1 italic text-muted">{project.subtitle}</p>
        )}
      </header>

      <section className="card p-6">
        <StatusPill status={project.status} />
        {project.lulu_status && (
          <p className="mt-3 text-sm text-muted">
            Lulu reports: <em>{formatLuluStatus(project.lulu_status)}</em>
          </p>
        )}
        <dl className="mt-5 space-y-2 text-sm">
          {project.lulu_total_cost != null && (
            <div className="flex justify-between">
              <dt className="text-muted">Paid</dt>
              <dd>
                ${project.lulu_total_cost.toFixed(2)}{' '}
                {project.lulu_currency ?? 'USD'}
              </dd>
            </div>
          )}
          {project.page_count != null && (
            <div className="flex justify-between">
              <dt className="text-muted">Pages</dt>
              <dd>{project.page_count}</dd>
            </div>
          )}
          {project.lulu_order_id && (
            <div className="flex justify-between">
              <dt className="text-muted">Lulu reference</dt>
              <dd className="font-mono text-xs">{project.lulu_order_id}</dd>
            </div>
          )}
        </dl>
        {project.lulu_tracking_url && (
          <a
            href={project.lulu_tracking_url}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-block text-sm"
          >
            Track the shipment â†—
          </a>
        )}
      </section>

      {project.shipping_address && (
        <section className="card p-5 text-sm">
          <h2 className="font-serif text-lg">Shipping to</h2>
          <div className="mt-2 leading-relaxed text-muted">
            <p>{project.shipping_address.name}</p>
            <p>{project.shipping_address.street1}</p>
            {project.shipping_address.street2 && (
              <p>{project.shipping_address.street2}</p>
            )}
            <p>
              {project.shipping_address.city},{' '}
              {project.shipping_address.state_code}{' '}
              {project.shipping_address.postcode}
            </p>
            <p>{project.shipping_address.country_code}</p>
          </div>
        </section>
      )}

      <p className="text-xs text-muted">
        Last updated{' '}
        {new Date(project.updated_at).toLocaleString(undefined, {
          dateStyle: 'medium',
          timeStyle: 'short',
        })}
        . This page refreshes automatically.
      </p>

      <Link to="/cookbook" className="btn">
        â† Back to your cookbook
      </Link>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const classes: Record<string, string> = {
    draft: 'bg-paper text-muted border-rule',
    ready: 'bg-amber-50 text-amber-900 border-amber-200',
    ordered: 'bg-sky-50 text-sky-900 border-sky-200',
    in_production: 'bg-indigo-50 text-indigo-900 border-indigo-200',
    shipped: 'bg-emerald-50 text-emerald-900 border-emerald-200',
    delivered: 'bg-emerald-100 text-emerald-900 border-emerald-200',
    cancelled: 'bg-rose-50 text-rose-900 border-rose-200',
    failed: 'bg-rose-50 text-rose-900 border-rose-200',
  };
  const labels: Record<string, string> = {
    draft: 'Draft',
    ready: 'Ready to print',
    ordered: 'Order placed',
    in_production: 'At the printer',
    shipped: 'Shipped',
    delivered: 'Delivered',
    cancelled: 'Cancelled',
    failed: 'Something went wrong',
  };
  const cls = classes[status] ?? classes.draft;
  const label = labels[status] ?? status;
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-widest ${cls}`}
    >
      <span className="h-2 w-2 rounded-full bg-current" />
      {label}
    </span>
  );
}

function formatLuluStatus(raw: string): string {
  return raw
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
