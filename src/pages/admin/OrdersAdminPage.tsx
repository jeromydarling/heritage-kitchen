import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { StatusPill } from './_shared';

/**
 * Unified order management dashboard over the three revenue surfaces:
 *   - cookbook_projects  (user-built Lulu direct orders)
 *   - edition_orders     (editorial cookbooks from /editions)
 *   - course_enrollments (paid email course purchases)
 *
 * Shows one combined, time-sorted table with product title, customer
 * email, status, total paid, Lulu tracking, and a detail drawer on
 * click. The drawer exposes manual status override controls so you
 * can fix stuck or failed orders without leaving the page.
 */

type OrderKind = 'cookbook' | 'edition' | 'course';

interface Order {
  kind: OrderKind;
  id: string;
  created_at: string;
  customer_email: string;
  customer_name: string | null;
  title: string;
  status: string;
  amount_cents: number | null;
  currency: string | null;
  lulu_order_id: string | null;
  lulu_status: string | null;
  lulu_tracking_url: string | null;
  shipping_address: Record<string, string> | null;
  raw: Record<string, unknown>;
}

type StatusFilter = 'all' | 'active' | 'shipped' | 'failed';

export default function OrdersAdminPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>('active');
  const [kindFilter, setKindFilter] = useState<OrderKind | 'all'>('all');
  const [open, setOpen] = useState<Order | null>(null);

  const refresh = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    const all: Order[] = [];

    // cookbook_projects (user-built direct orders)
    {
      const { data } = await supabase
        .from('cookbook_projects')
        .select('*')
        .neq('status', 'draft')
        .order('created_at', { ascending: false })
        .limit(200);
      for (const row of data ?? []) {
        const addr = (row as any).shipping_address as Record<string, string> | null;
        all.push({
          kind: 'cookbook',
          id: (row as any).id,
          created_at: (row as any).created_at,
          customer_email: addr?.email ?? '',
          customer_name: addr?.name ?? null,
          title: (row as any).title,
          status: (row as any).status,
          amount_cents:
            (row as any).lulu_total_cost != null
              ? Math.round(Number((row as any).lulu_total_cost) * 100)
              : null,
          currency: (row as any).lulu_currency ?? 'USD',
          lulu_order_id: (row as any).lulu_order_id,
          lulu_status: (row as any).lulu_status,
          lulu_tracking_url: (row as any).lulu_tracking_url,
          shipping_address: addr,
          raw: row as Record<string, unknown>,
        });
      }
    }

    // edition_orders
    {
      const { data } = await supabase
        .from('edition_orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      for (const row of data ?? []) {
        all.push({
          kind: 'edition',
          id: (row as any).id,
          created_at: (row as any).created_at,
          customer_email: (row as any).customer_email ?? '',
          customer_name: (row as any).customer_name,
          title: (row as any).edition_slug,
          status: (row as any).status,
          amount_cents: (row as any).amount_paid_cents,
          currency: (row as any).currency ?? 'USD',
          lulu_order_id: (row as any).lulu_order_id,
          lulu_status: (row as any).lulu_status,
          lulu_tracking_url: (row as any).lulu_tracking_url,
          shipping_address: (row as any).shipping_address,
          raw: row as Record<string, unknown>,
        });
      }
    }

    // course_enrollments
    {
      const { data } = await supabase
        .from('course_enrollments')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      for (const row of data ?? []) {
        all.push({
          kind: 'course',
          id: (row as any).id,
          created_at: (row as any).created_at,
          customer_email: (row as any).email ?? '',
          customer_name: (row as any).customer_name,
          title: (row as any).course_slug,
          status: (row as any).status,
          amount_cents: (row as any).amount_paid_cents,
          currency: (row as any).currency ?? 'USD',
          lulu_order_id: null,
          lulu_status: `Day ${(row as any).last_sent_day ?? 0}`,
          lulu_tracking_url: null,
          shipping_address: null,
          raw: row as Record<string, unknown>,
        });
      }
    }

    all.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
    setOrders(all);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      if (kindFilter !== 'all' && o.kind !== kindFilter) return false;
      if (filter === 'all') return true;
      if (filter === 'failed') return o.status === 'failed' || o.status === 'cancelled';
      if (filter === 'shipped') return o.status === 'shipped' || o.status === 'delivered';
      if (filter === 'active')
        return ['ordered', 'in_production', 'ready', 'active', 'scheduled'].includes(
          o.status,
        );
      return true;
    });
  }, [orders, filter, kindFilter]);

  async function setStatus(order: Order, status: string) {
    if (!supabase) return;
    const table =
      order.kind === 'cookbook'
        ? 'cookbook_projects'
        : order.kind === 'edition'
          ? 'edition_orders'
          : 'course_enrollments';
    await supabase.from(table).update({ status }).eq('id', order.id);
    await refresh();
    if (open?.id === order.id) setOpen({ ...open, status });
  }

  const counts = useMemo(() => {
    const c = { all: orders.length, active: 0, shipped: 0, failed: 0 };
    for (const o of orders) {
      if (['ordered', 'in_production', 'ready', 'active', 'scheduled'].includes(o.status)) c.active++;
      if (o.status === 'shipped' || o.status === 'delivered') c.shipped++;
      if (o.status === 'failed' || o.status === 'cancelled') c.failed++;
    }
    return c;
  }, [orders]);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-terracotta">
          Ops
        </p>
        <h1 className="mt-1 font-serif text-3xl">Orders</h1>
        <p className="mt-2 text-sm text-muted">
          Every paid transaction across the three revenue surfaces.
          Printed books, editions, and course enrollments, most recent
          first. Click a row to see details and override status.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <FilterPill label={`All (${counts.all})`} active={filter === 'all'} onClick={() => setFilter('all')} />
        <FilterPill label={`Active (${counts.active})`} active={filter === 'active'} onClick={() => setFilter('active')} />
        <FilterPill label={`Shipped (${counts.shipped})`} active={filter === 'shipped'} onClick={() => setFilter('shipped')} />
        <FilterPill
          label={`Needs attention (${counts.failed})`}
          active={filter === 'failed'}
          onClick={() => setFilter('failed')}
          accent={counts.failed > 0}
        />
        <div className="ml-auto">
          <select
            value={kindFilter}
            onChange={(e) => setKindFilter(e.target.value as OrderKind | 'all')}
            className="rounded-full border border-rule bg-surface px-3 py-1.5 text-xs"
          >
            <option value="all">All products</option>
            <option value="cookbook">Custom cookbooks</option>
            <option value="edition">Editions</option>
            <option value="course">Courses</option>
          </select>
        </div>
      </div>

      {open && (
        <OrderDrawer
          order={open}
          onClose={() => setOpen(null)}
          onStatusChange={setStatus}
        />
      )}

      {loading ? (
        <p className="text-muted">Loadingâ€¦</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-rule bg-surface p-10 text-center text-sm text-muted">
          No orders matching that filter.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-rule bg-surface">
          <table className="w-full text-sm">
            <thead className="bg-paper text-left text-xs uppercase tracking-widest text-muted">
              <tr>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Kind</th>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Paid</th>
                <th className="px-4 py-3">Status</th>
                <th className="w-20 px-4 py-3 text-right">Open</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => (
                <tr
                  key={`${o.kind}-${o.id}`}
                  className="border-t border-rule hover:bg-paper"
                >
                  <td className="px-4 py-3 align-top text-xs text-muted">
                    {new Date(o.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 align-top text-xs">{o.kind}</td>
                  <td className="px-4 py-3 align-top font-serif">{o.title}</td>
                  <td className="px-4 py-3 align-top">
                    <div className="text-sm">{o.customer_name ?? ''}</div>
                    <div className="text-xs italic text-muted">{o.customer_email}</div>
                  </td>
                  <td className="px-4 py-3 align-top text-xs">
                    {o.amount_cents != null
                      ? `$${(o.amount_cents / 100).toFixed(2)} ${o.currency ?? ''}`
                      : '\u2014'}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <OrderStatusPill status={o.status} />
                    {o.lulu_status && (
                      <div className="mt-1 text-[10px] italic text-muted">
                        Lulu: {o.lulu_status}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right align-top">
                    <button
                      type="button"
                      onClick={() => setOpen(o)}
                      className="text-xs text-terracotta hover:underline"
                    >
                      Open &rarr;
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FilterPill({
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
      className={`rounded-full border px-3 py-1 text-xs ${
        active
          ? 'border-terracotta bg-terracotta text-cream'
          : accent
            ? 'border-rose-300 bg-rose-50 text-rose-900 hover:border-rose-500'
            : 'border-rule bg-surface text-muted hover:border-terracotta'
      }`}
    >
      {label}
    </button>
  );
}

function OrderStatusPill({ status }: { status: string }) {
  const color: Record<string, 'green' | 'gray' | 'amber' | 'rose' | 'indigo' | 'sky'> = {
    draft: 'gray',
    ready: 'amber',
    ordered: 'sky',
    in_production: 'indigo',
    shipped: 'green',
    delivered: 'green',
    active: 'indigo',
    scheduled: 'amber',
    completed: 'green',
    cancelled: 'rose',
    failed: 'rose',
    pending: 'amber',
  };
  return <StatusPill color={color[status] ?? 'gray'}>{status}</StatusPill>;
}

function OrderDrawer({
  order,
  onClose,
  onStatusChange,
}: {
  order: Order;
  onClose: () => void;
  onStatusChange: (o: Order, s: string) => Promise<void>;
}) {
  const overrides = ORDER_STATUS_OPTIONS[order.kind];
  return (
    <div className="rounded-2xl border border-rule bg-surface p-6 shadow-card">
      <div className="flex items-baseline justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted">
            {order.kind} order
          </p>
          <h2 className="mt-1 font-serif text-xl">{order.title}</h2>
          <p className="mt-1 text-xs text-muted">
            {new Date(order.created_at).toLocaleString()} &middot;{' '}
            {order.customer_name} &middot; {order.customer_email}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-muted hover:text-terracotta"
        >
          Close
        </button>
      </div>

      <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs uppercase tracking-widest text-muted">Paid</dt>
          <dd>
            {order.amount_cents != null
              ? `$${(order.amount_cents / 100).toFixed(2)} ${order.currency ?? ''}`
              : '\u2014'}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-widest text-muted">Status</dt>
          <dd>
            <OrderStatusPill status={order.status} />
          </dd>
        </div>
        {order.lulu_order_id && (
          <div>
            <dt className="text-xs uppercase tracking-widest text-muted">
              Lulu reference
            </dt>
            <dd className="font-mono text-xs">{order.lulu_order_id}</dd>
          </div>
        )}
        {order.lulu_status && (
          <div>
            <dt className="text-xs uppercase tracking-widest text-muted">
              Lulu status
            </dt>
            <dd className="text-xs italic">{order.lulu_status}</dd>
          </div>
        )}
        {order.lulu_tracking_url && (
          <div className="sm:col-span-2">
            <dt className="text-xs uppercase tracking-widest text-muted">Tracking</dt>
            <dd>
              <a href={order.lulu_tracking_url} target="_blank" rel="noreferrer" className="text-xs">
                {order.lulu_tracking_url} &rarr;
              </a>
            </dd>
          </div>
        )}
      </dl>

      {order.shipping_address && (
        <div className="mt-5 rounded-xl border border-rule bg-cream p-4 text-xs leading-relaxed">
          <div className="mb-1 text-[10px] uppercase tracking-widest text-muted">
            Shipping to
          </div>
          <div>{order.shipping_address.name}</div>
          <div>{order.shipping_address.street1}</div>
          {order.shipping_address.street2 && <div>{order.shipping_address.street2}</div>}
          <div>
            {order.shipping_address.city}, {order.shipping_address.state_code}{' '}
            {order.shipping_address.postcode}
          </div>
          <div>{order.shipping_address.country_code}</div>
        </div>
      )}

      <div className="mt-5 border-t border-rule pt-4">
        <p className="mb-2 text-[10px] uppercase tracking-widest text-muted">
          Override status
        </p>
        <div className="flex flex-wrap gap-2">
          {overrides.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => void onStatusChange(order, s)}
              className={`rounded-full border px-3 py-1 text-xs ${
                order.status === s
                  ? 'border-terracotta bg-terracotta text-cream'
                  : 'border-rule bg-surface text-muted hover:border-terracotta'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <p className="mt-3 text-[11px] italic text-muted">
          Manual overrides do not call Lulu or Stripe. Use only when an
          order is stuck and you've resolved the underlying issue by hand.
        </p>
      </div>

      <div className="mt-5 border-t border-rule pt-4">
        <details>
          <summary className="cursor-pointer text-xs text-muted hover:text-terracotta">
            Raw database row
          </summary>
          <pre className="mt-2 max-h-96 overflow-auto rounded-xl bg-paper p-3 text-[10px] leading-relaxed">
            {JSON.stringify(order.raw, null, 2)}
          </pre>
        </details>
      </div>
    </div>
  );
}

const ORDER_STATUS_OPTIONS: Record<OrderKind, string[]> = {
  cookbook: ['draft', 'ready', 'ordered', 'in_production', 'shipped', 'delivered', 'cancelled', 'failed'],
  edition: ['pending', 'ordered', 'in_production', 'shipped', 'delivered', 'cancelled', 'failed'],
  course: ['scheduled', 'active', 'completed', 'cancelled', 'failed'],
};
