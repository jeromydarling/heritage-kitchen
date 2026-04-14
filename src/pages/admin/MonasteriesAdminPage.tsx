import { useState } from 'react';
import { useAdminCrud, slugify } from '../../lib/adminCrud';
import { ResourceList, ResourceForm, AdminFieldDef, StatusPill } from './_shared';
import { ImageUploadField, MarkdownField } from './_fields';

interface Monastery {
  slug: string;
  name: string;
  tradition: string | null;
  location: string | null;
  founded: string | null;
  description: string | null;
  products_summary: string | null;
  image_url: string | null;
  website_url: string | null;
  shop_url: string | null;
  ships_internationally: boolean | null;
  partner_status: string;
  notes_for_owner: string | null;
  last_verified: string | null;
  source_url: string | null;
  published: boolean;
  featured: boolean;
  sort_order: number;
}

const FIELDS: AdminFieldDef<Monastery>[] = [
  { key: 'slug', label: 'Slug', type: 'text', required: true },
  { key: 'name', label: 'Name', type: 'text', required: true },
  { key: 'tradition', label: 'Tradition', type: 'text', help: 'e.g. Trappist (OCSO), Benedictine (OSB), Camaldolese' },
  { key: 'location', label: 'Location', type: 'text', help: 'City, state/country' },
  { key: 'founded', label: 'Founded', type: 'text', help: 'Year as text' },
  { key: 'products_summary', label: 'What they sell', type: 'text' },
  { key: 'website_url', label: 'Website URL', type: 'text' },
  { key: 'shop_url', label: 'Shop URL', type: 'text' },
  { key: 'ships_internationally', label: 'Ships internationally', type: 'boolean' },
  { key: 'partner_status', label: 'Partner status', type: 'select', options: [
    { value: 'prospect', label: 'Prospect' },
    { value: 'contacted', label: 'Contacted' },
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive (not shipping)' },
    { value: 'declined', label: 'Declined' },
  ] },
  { key: 'notes_for_owner', label: 'Private notes', type: 'textarea' },
  { key: 'last_verified', label: 'Last verified', type: 'date' },
  { key: 'source_url', label: 'Source URL', type: 'text' },
  { key: 'sort_order', label: 'Sort order', type: 'number' },
  { key: 'published', label: 'Published', type: 'boolean' },
  { key: 'featured', label: 'Featured', type: 'boolean' },
];

export default function MonasteriesAdminPage() {
  const crud = useAdminCrud<Monastery>('monasteries', 'slug', { orderBy: 'sort_order' });
  const [editing, setEditing] = useState<Monastery | null>(null);

  return (
    <div className="space-y-6">
      <header className="flex items-baseline justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-terracotta">Directory</p>
          <h1 className="mt-1 font-serif text-3xl">Monasteries</h1>
        </div>
        <button
          type="button"
          onClick={() =>
            setEditing({
              slug: '',
              name: 'New monastery',
              tradition: null,
              location: null,
              founded: null,
              description: null,
              products_summary: null,
              image_url: null,
              website_url: null,
              shop_url: null,
              ships_internationally: null,
              partner_status: 'prospect',
              notes_for_owner: null,
              last_verified: null,
              source_url: null,
              published: true,
              featured: false,
              sort_order: (crud.rows.length ?? 0) + 1,
            })
          }
          className="btn-primary"
        >
          + New
        </button>
      </header>

      {editing && (
        <ResourceForm<Monastery>
          title={editing.slug ? `Edit: ${editing.name}` : 'New monastery'}
          fields={FIELDS}
          value={editing}
          onChange={setEditing}
          onCancel={() => setEditing(null)}
          previewUrl={
            editing.slug
              ? `#/monasteries/${editing.slug}${editing.published ? '' : '?preview=1'}`
              : undefined
          }
          extra={
            <>
              <ImageUploadField
                label="Photograph of the community"
                value={editing.image_url}
                onChange={(url) => setEditing({ ...editing, image_url: url })}
                pathPrefix="monasteries/"
              />
              <MarkdownField
                label="Description (long-form prose about the community)"
                value={editing.description ?? ''}
                onChange={(v) => setEditing({ ...editing, description: v || null })}
                rows={10}
              />
            </>
          }
          onSave={async (row) => {
            const next = { ...row };
            if (!next.slug) next.slug = slugify(next.name);
            await crud.upsert(next);
            setEditing(null);
          }}
          onDelete={
            crud.rows.some((r) => r.slug === editing.slug)
              ? async () => {
                  if (!confirm(`Remove "${editing.name}" from the directory?`)) return;
                  await crud.remove(editing.slug);
                  setEditing(null);
                }
              : undefined
          }
        />
      )}

      <ResourceList<Monastery>
        loading={crud.loading}
        rows={crud.rows}
        columns={[
          { key: 'name', label: 'Name', render: (r) => (
            <div>
              <div className="font-serif">{r.name}</div>
              {r.tradition && <div className="text-xs italic text-muted">{r.tradition}</div>}
            </div>
          ) },
          { key: 'loc', label: 'Location', render: (r) => <span className="text-xs text-muted">{r.location}</span> },
          { key: 'status', label: 'Status', render: (r) => (
            <StatusPill color={r.partner_status === 'active' ? 'green' : r.partner_status === 'inactive' ? 'rose' : 'gray'}>
              {r.partner_status}
            </StatusPill>
          ) },
          { key: 'pub', label: 'Published', render: (r) => (
            <StatusPill color={r.published ? 'green' : 'gray'}>{r.published ? 'Yes' : 'No'}</StatusPill>
          ) },
        ]}
        onEdit={(r) => setEditing(r)}
      />
    </div>
  );
}
