import { useState } from 'react';
import { useAdminCrud, slugify } from '../../lib/adminCrud';
import { ResourceList, ResourceForm, AdminFieldDef, StatusPill } from './_shared';

interface StoreItem {
  slug: string;
  title: string;
  subtitle: string | null;
  curator_note: string | null;
  maker_name: string | null;
  maker_url: string | null;
  category: string;
  kind: 'affiliate' | 'referral' | 'print_on_demand' | 'etsy';
  affiliate_url: string | null;
  affiliate_network: string | null;
  commission_rate: string | null;
  price_display: string | null;
  partner_status: string;
  notes_for_owner: string | null;
  last_verified: string | null;
  source_url: string | null;
  published: boolean;
  featured: boolean;
  sort_order: number;
}

const FIELDS: AdminFieldDef<StoreItem>[] = [
  { key: 'slug', label: 'Slug', type: 'text', required: true },
  { key: 'title', label: 'Title', type: 'text', required: true },
  { key: 'subtitle', label: 'Subtitle / maker line', type: 'text' },
  { key: 'maker_name', label: 'Maker name', type: 'text' },
  { key: 'maker_url', label: 'Maker site URL', type: 'text' },
  { key: 'category', label: 'Category', type: 'select', options: [
    { value: 'flour-and-grain', label: 'Flour & grain' },
    { value: 'cookware', label: 'Cookware' },
    { value: 'kitchen-tools', label: 'Kitchen tools' },
    { value: 'preserving', label: 'Preserving' },
    { value: 'starters', label: 'Starters & cultures' },
    { value: 'kitchen-garden', label: 'Kitchen garden' },
    { value: 'monastery', label: 'From the monastery' },
    { value: 'spices', label: 'Spices' },
    { value: 'books', label: 'Books' },
    { value: 'apparel', label: 'Apparel / linens' },
    { value: 'merch', label: 'Heritage Kitchen merch' },
  ] },
  { key: 'kind', label: 'Kind', type: 'select', options: [
    { value: 'affiliate', label: 'Affiliate (commission)' },
    { value: 'referral', label: 'Referral (no commission)' },
    { value: 'etsy', label: 'Etsy shop' },
    { value: 'print_on_demand', label: 'Print-on-demand merch' },
  ] },
  { key: 'affiliate_url', label: 'Affiliate / destination URL', type: 'text' },
  { key: 'affiliate_network', label: 'Affiliate network', type: 'text' },
  { key: 'commission_rate', label: 'Commission rate', type: 'text', help: 'Free-form, e.g. "10%" or "5% new / 2% loyalty"' },
  { key: 'price_display', label: 'Price display', type: 'text', help: 'Shown next to the title, never transacted.' },
  { key: 'curator_note', label: 'Curator note', type: 'textarea', help: 'Prose paragraph about the maker. This is the whole pitch.' },
  { key: 'partner_status', label: 'Partner status', type: 'select', options: [
    { value: 'prospect', label: 'Prospect (not yet contacted)' },
    { value: 'contacted', label: 'Contacted' },
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
    { value: 'declined', label: 'Declined' },
  ] },
  { key: 'notes_for_owner', label: 'Private notes', type: 'textarea', help: 'Not shown publicly. Use for CRM tracking.' },
  { key: 'last_verified', label: 'Last verified', type: 'date' },
  { key: 'source_url', label: 'Source URL', type: 'text', help: 'Where you verified the affiliate program terms.' },
  { key: 'sort_order', label: 'Sort order', type: 'number' },
  { key: 'published', label: 'Published', type: 'boolean' },
  { key: 'featured', label: 'Featured', type: 'boolean' },
];

export default function StoreAdminPage() {
  const crud = useAdminCrud<StoreItem>('store_items', 'slug', { orderBy: 'sort_order' });
  const [editing, setEditing] = useState<StoreItem | null>(null);

  return (
    <div className="space-y-6">
      <header className="flex items-baseline justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-terracotta">Curator letter</p>
          <h1 className="mt-1 font-serif text-3xl">Store</h1>
        </div>
        <button
          type="button"
          onClick={() =>
            setEditing({
              slug: '',
              title: 'New store item',
              subtitle: null,
              curator_note: null,
              maker_name: null,
              maker_url: null,
              category: 'flour-and-grain',
              kind: 'affiliate',
              affiliate_url: null,
              affiliate_network: null,
              commission_rate: null,
              price_display: null,
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
          + New item
        </button>
      </header>

      {editing && (
        <ResourceForm<StoreItem>
          title={editing.slug ? `Edit: ${editing.title}` : 'New store item'}
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
                  if (!confirm(`Remove "${editing.title}" from the store?`)) return;
                  await crud.remove(editing.slug);
                  setEditing(null);
                }
              : undefined
          }
        />
      )}

      <ResourceList<StoreItem>
        loading={crud.loading}
        rows={crud.rows}
        columns={[
          { key: 'title', label: 'Item', render: (r) => (
            <div>
              <div className="font-serif">{r.title}</div>
              {r.maker_name && <div className="text-xs italic text-muted">{r.maker_name}</div>}
            </div>
          ) },
          { key: 'category', label: 'Category', render: (r) => <span className="text-xs text-muted">{r.category}</span> },
          { key: 'kind', label: 'Kind', render: (r) => <span className="text-xs">{r.kind}</span> },
          { key: 'partner', label: 'Partner', render: (r) => (
            <StatusPill color={r.partner_status === 'active' ? 'green' : r.partner_status === 'prospect' ? 'amber' : 'gray'}>
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
