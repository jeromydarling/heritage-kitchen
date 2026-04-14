import { useState } from 'react';
import { useAdminCrud, slugify } from '../../lib/adminCrud';
import { ResourceList, ResourceForm, AdminFieldDef, StatusPill } from './_shared';

interface Sponsor {
  slug: string;
  name: string;
  tier: 'patron' | 'supporter' | 'friend';
  url: string | null;
  logo_url: string | null;
  description: string | null;
  since: string | null;
  until: string | null;
  published: boolean;
  sort_order: number;
}

const FIELDS: AdminFieldDef<Sponsor>[] = [
  { key: 'slug', label: 'Slug', type: 'text', required: true },
  { key: 'name', label: 'Name', type: 'text', required: true },
  { key: 'tier', label: 'Tier', type: 'select', options: [
    { value: 'patron', label: 'Patron ($2,500/yr)' },
    { value: 'supporter', label: 'Supporter ($1,000/yr)' },
    { value: 'friend', label: 'Friend ($300/yr)' },
  ] },
  { key: 'url', label: 'Website URL', type: 'text' },
  { key: 'logo_url', label: 'Logo URL (optional)', type: 'text' },
  { key: 'description', label: 'Credit copy', type: 'textarea', help: 'Prose paragraph shown on /friends.' },
  { key: 'since', label: 'Since', type: 'date' },
  { key: 'until', label: 'Until (blank = ongoing)', type: 'date' },
  { key: 'sort_order', label: 'Sort order', type: 'number' },
  { key: 'published', label: 'Published', type: 'boolean' },
];

export default function SponsorsAdminPage() {
  const crud = useAdminCrud<Sponsor>('sponsors', 'slug', { orderBy: 'sort_order' });
  const [editing, setEditing] = useState<Sponsor | null>(null);

  return (
    <div className="space-y-6">
      <header className="flex items-baseline justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-terracotta">Friends page</p>
          <h1 className="mt-1 font-serif text-3xl">Sponsors</h1>
        </div>
        <button
          type="button"
          onClick={() =>
            setEditing({
              slug: '',
              name: 'New sponsor',
              tier: 'friend',
              url: null,
              logo_url: null,
              description: null,
              since: null,
              until: null,
              published: true,
              sort_order: (crud.rows.length ?? 0) + 1,
            })
          }
          className="btn-primary"
        >
          + New sponsor
        </button>
      </header>

      {editing && (
        <ResourceForm<Sponsor>
          title={editing.slug ? `Edit: ${editing.name}` : 'New sponsor'}
          fields={FIELDS}
          value={editing}
          onChange={setEditing}
          onCancel={() => setEditing(null)}
          onSave={async (row) => {
            const next = { ...row };
            if (!next.slug) next.slug = slugify(next.name);
            await crud.upsert(next);
            setEditing(null);
          }}
          onDelete={
            crud.rows.some((r) => r.slug === editing.slug)
              ? async () => {
                  if (!confirm(`Remove "${editing.name}" from the Friends page?`)) return;
                  await crud.remove(editing.slug);
                  setEditing(null);
                }
              : undefined
          }
        />
      )}

      <ResourceList<Sponsor>
        loading={crud.loading}
        rows={crud.rows}
        columns={[
          { key: 'name', label: 'Name', render: (r) => <span className="font-serif">{r.name}</span> },
          { key: 'tier', label: 'Tier', render: (r) => (
            <StatusPill color={r.tier === 'patron' ? 'indigo' : r.tier === 'supporter' ? 'sky' : 'gray'}>
              {r.tier}
            </StatusPill>
          ) },
          { key: 'since', label: 'Since', render: (r) => <span className="text-xs text-muted">{r.since ?? '\u2014'}</span> },
          { key: 'pub', label: 'Published', render: (r) => (
            <StatusPill color={r.published ? 'green' : 'gray'}>{r.published ? 'Yes' : 'No'}</StatusPill>
          ) },
        ]}
        onEdit={(r) => setEditing(r)}
      />
    </div>
  );
}
