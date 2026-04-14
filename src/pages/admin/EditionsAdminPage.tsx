import { useState } from 'react';
import { useAdminCrud, slugify } from '../../lib/adminCrud';
import { ResourceList, ResourceForm, AdminFieldDef, StatusPill } from './_shared';

interface Edition {
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  intro_text: string | null;
  cover_image_url: string | null;
  interior_pdf_url: string | null;
  pdf_storage_path: string | null;
  recipe_ids: string[];
  price_usd: number;
  price_pdf_usd: number | null;
  format: 'print' | 'pdf' | 'both';
  page_count: number | null;
  almanac_year: number | null;
  published: boolean;
  featured: boolean;
  sort_order: number;
}

const FIELDS: AdminFieldDef<Edition>[] = [
  { key: 'slug', label: 'Slug', type: 'text', required: true, help: 'URL-safe id, e.g. "lenten-table"' },
  { key: 'title', label: 'Title', type: 'text', required: true },
  { key: 'subtitle', label: 'Subtitle', type: 'text' },
  { key: 'description', label: 'Short description', type: 'textarea', help: 'Shown on the /editions listing and above the buy buttons.' },
  { key: 'intro_text', label: "A note from the editors", type: 'textarea', help: 'Long-form editor letter shown on the edition detail page. Blank lines become paragraphs.' },
  { key: 'cover_image_url', label: 'Cover image URL', type: 'text', help: 'Optional. Leave blank for the typeset placeholder.' },
  { key: 'interior_pdf_url', label: 'Interior PDF URL', type: 'text', help: 'Public URL of the pre-rendered interior PDF in storage.' },
  { key: 'pdf_storage_path', label: 'PDF storage path', type: 'text', help: 'Path within cookbook-pdfs bucket for signed downloads, e.g. "editions/lenten-table.pdf".' },
  { key: 'price_usd', label: 'Print price (USD)', type: 'number', step: '0.01' },
  { key: 'price_pdf_usd', label: 'PDF price (USD)', type: 'number', step: '0.01' },
  { key: 'format', label: 'Format', type: 'select', options: [
    { value: 'print', label: 'Print only' },
    { value: 'pdf', label: 'PDF download only' },
    { value: 'both', label: 'Print + PDF' },
  ] },
  { key: 'page_count', label: 'Page count', type: 'number' },
  { key: 'almanac_year', label: 'Almanac year', type: 'number', help: 'Set if this edition is part of the annual almanac series; leave blank otherwise.' },
  { key: 'sort_order', label: 'Sort order', type: 'number' },
  { key: 'published', label: 'Published', type: 'boolean' },
  { key: 'featured', label: 'Featured', type: 'boolean' },
];

export default function EditionsAdminPage() {
  const crud = useAdminCrud<Edition>('editions', 'slug', {
    orderBy: 'sort_order',
  });
  const [editing, setEditing] = useState<Edition | null>(null);

  return (
    <div className="space-y-6">
      <header className="flex items-baseline justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-terracotta">Bookshelf</p>
          <h1 className="mt-1 font-serif text-3xl">Editions</h1>
        </div>
        <button
          type="button"
          onClick={() =>
            setEditing({
              slug: '',
              title: 'New edition',
              subtitle: null,
              description: null,
              intro_text: null,
              cover_image_url: null,
              interior_pdf_url: null,
              pdf_storage_path: null,
              recipe_ids: [],
              price_usd: 34,
              price_pdf_usd: 9,
              format: 'both',
              page_count: null,
              almanac_year: null,
              published: false,
              featured: false,
              sort_order: (crud.rows.length ?? 0) + 1,
            })
          }
          className="btn-primary"
        >
          + New edition
        </button>
      </header>

      {editing && (
        <ResourceForm<Edition>
          title={editing.slug ? `Edit: ${editing.title}` : 'New edition'}
          fields={FIELDS}
          value={editing}
          onChange={setEditing}
          onCancel={() => setEditing(null)}
          onSave={async (row) => {
            const next = { ...row };
            if (!next.slug) next.slug = slugify(next.title);
            await crud.upsert(next);
            setEditing(null);
          }}
          onDelete={
            crud.rows.some((r) => r.slug === editing.slug)
              ? async () => {
                  if (!confirm(`Delete "${editing.title}"? This cannot be undone.`)) return;
                  await crud.remove(editing.slug);
                  setEditing(null);
                }
              : undefined
          }
        />
      )}

      <ResourceList
        loading={crud.loading}
        rows={crud.rows}
        columns={[
          { key: 'title', label: 'Title', render: (r) => (
            <div>
              <div className="font-serif">{r.title}</div>
              {r.subtitle && <div className="text-xs italic text-muted">{r.subtitle}</div>}
            </div>
          ) },
          { key: 'format', label: 'Format', render: (r) => <span className="text-xs">{r.format}</span> },
          { key: 'price', label: 'Price', render: (r) => (
            <span className="text-xs">
              {(r.format === 'pdf' || r.format === 'both') && r.price_pdf_usd != null && `PDF $${r.price_pdf_usd}`}
              {r.format === 'both' && ' · '}
              {(r.format === 'print' || r.format === 'both') && `Print $${r.price_usd}`}
            </span>
          ) },
          { key: 'status', label: 'Status', render: (r) => (
            <StatusPill color={r.published ? 'green' : 'gray'}>
              {r.published ? 'Published' : 'Draft'}
            </StatusPill>
          ) },
        ]}
        onEdit={(r) => setEditing(r)}
      />
    </div>
  );
}
