import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

interface Counts {
  editions: number;
  editions_published: number;
  courses: number;
  store_items: number;
  monasteries: number;
  sponsors: number;
  adoptions: number;
  enquiries_new: number;
  cookbook_orders: number;
}

/**
 * The admin home page: a simple dashboard of row counts for every
 * editable resource, with quick-jump links and a small health note.
 * No chrome, no graphs, just numbers at a glance.
 */
export default function AdminOverviewPage() {
  const [counts, setCounts] = useState<Counts | null>(null);

  useEffect(() => {
    async function load() {
      if (!supabase) return;
      const count = async (table: string, filter?: (q: any) => any) => {
        let q = supabase!.from(table).select('*', { count: 'exact', head: true });
        if (filter) q = filter(q);
        const { count: c } = await q;
        return c ?? 0;
      };
      setCounts({
        editions: await count('editions'),
        editions_published: await count('editions', (q) => q.eq('published', true)),
        courses: await count('courses'),
        store_items: await count('store_items'),
        monasteries: await count('monasteries'),
        sponsors: await count('sponsors'),
        adoptions: await count('recipe_adoptions', (q) => q.eq('active', true)),
        enquiries_new: await count('service_enquiries', (q) => q.eq('status', 'new')),
        cookbook_orders: await count('cookbook_projects', (q) =>
          q.neq('status', 'draft'),
        ),
      });
    }
    void load();
  }, []);

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-terracotta">CMS</p>
        <h1 className="mt-1 font-serif text-3xl">Overview</h1>
        <p className="mt-2 text-sm text-muted">
          Everything you can edit without opening the Supabase SQL editor.
          Numbers update on load.
        </p>
      </header>

      {!counts ? (
        <p className="text-muted">Loadingâ€¦</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard to="/admin/editions" label="Editions" n={counts.editions} sub={`${counts.editions_published} published`} />
          <StatCard to="/admin/courses" label="Courses" n={counts.courses} />
          <StatCard to="/admin/store" label="Store items" n={counts.store_items} />
          <StatCard to="/admin/monasteries" label="Monasteries" n={counts.monasteries} />
          <StatCard to="/admin/sponsors" label="Friends" n={counts.sponsors} />
          <StatCard to="/admin/adoptions" label="Adoptions" n={counts.adoptions} />
          <StatCard
            to="/admin/enquiries"
            label="New enquiries"
            n={counts.enquiries_new}
            sub="service inbox"
            accent={counts.enquiries_new > 0}
          />
          <StatCard
            to="/admin"
            label="Cookbook orders"
            n={counts.cookbook_orders}
            sub="across all users"
          />
        </div>
      )}

      <section className="card bg-paper p-5 text-sm leading-relaxed text-muted">
        <h2 className="font-serif text-base text-ink">A few notes</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Editing anything here writes straight to Supabase. No drafts, no undo. Be careful with delete.</li>
          <li>All copy supports multi-paragraph prose &mdash; blank lines become paragraph breaks in the printed book.</li>
          <li>Publishing an edition or a course flips its <code>published</code> flag to true and makes it visible on the public pages immediately.</li>
          <li>The <Link to="/admin/images">recipe images</Link> admin is the old per-recipe AI illustration regenerator, kept as-is.</li>
        </ul>
      </section>
    </div>
  );
}

function StatCard({
  to,
  label,
  n,
  sub,
  accent,
}: {
  to: string;
  label: string;
  n: number;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <Link
      to={to}
      className={`card flex flex-col gap-1 p-5 !no-underline !text-ink transition hover:-translate-y-0.5 hover:border-terracotta ${
        accent ? 'border-terracotta/60' : ''
      }`}
    >
      <span className="text-xs uppercase tracking-widest text-muted">{label}</span>
      <span className="font-serif text-3xl">{n}</span>
      {sub && <span className="text-xs text-muted">{sub}</span>}
    </Link>
  );
}
