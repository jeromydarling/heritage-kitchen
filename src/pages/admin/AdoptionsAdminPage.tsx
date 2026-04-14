import { useState } from 'react';
import { useAdminCrud } from '../../lib/adminCrud';
import { ResourceList, ResourceForm, AdminFieldDef, StatusPill } from './_shared';

interface RecipeAdoption {
  id: string;
  recipe_id: string;
  sponsor_slug: string | null;
  credit_text: string | null;
  adopted_from: string | null;
  adopted_until: string | null;
  active: boolean;
}

const FIELDS: AdminFieldDef<RecipeAdoption>[] = [
  { key: 'recipe_id', label: 'Recipe id (slug)', type: 'text', required: true, help: 'e.g. bcs-sour-milk-griddle-cakes' },
  { key: 'sponsor_slug', label: 'Sponsor slug', type: 'text', help: 'Must match a row in the sponsors table.' },
  { key: 'credit_text', label: 'Credit text', type: 'textarea', help: "Optional custom credit. If blank, the sponsor's description is used." },
  { key: 'adopted_from', label: 'Adopted from', type: 'date' },
  { key: 'adopted_until', label: 'Adopted until', type: 'date' },
  { key: 'active', label: 'Active', type: 'boolean' },
];

export default function AdoptionsAdminPage() {
  const crud = useAdminCrud<RecipeAdoption>('recipe_adoptions', 'id', {
    orderBy: 'created_at',
    ascending: false,
  });
  const [editing, setEditing] = useState<RecipeAdoption | null>(null);

  return (
    <div className="space-y-6">
      <header className="flex items-baseline justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-terracotta">Museum donor plaques</p>
          <h1 className="mt-1 font-serif text-3xl">Adopt-a-recipe</h1>
        </div>
        <button
          type="button"
          onClick={() =>
            setEditing({
              id: '',
              recipe_id: '',
              sponsor_slug: null,
              credit_text: null,
              adopted_from: new Date().toISOString().slice(0, 10),
              adopted_until: null,
              active: true,
            })
          }
          className="btn-primary"
        >
          + New adoption
        </button>
      </header>

      {editing && (
        <ResourceForm<RecipeAdoption>
          title={editing.id ? 'Edit adoption' : 'New adoption'}
          fields={FIELDS}
          value={editing}
          onChange={setEditing}
          onCancel={() => setEditing(null)}
          onSave={async (row) => {
            const next: Partial<RecipeAdoption> = { ...row };
            if (!next.id) delete (next as Record<string, unknown>).id;
            await crud.upsert(next as Partial<RecipeAdoption>);
            setEditing(null);
          }}
          onDelete={
            editing.id
              ? async () => {
                  if (!confirm('Delete this adoption?')) return;
                  await crud.remove(editing.id);
                  setEditing(null);
                }
              : undefined
          }
        />
      )}

      <ResourceList<RecipeAdoption>
        loading={crud.loading}
        rows={crud.rows}
        columns={[
          { key: 'recipe', label: 'Recipe', render: (r) => <span className="font-mono text-xs">{r.recipe_id}</span> },
          { key: 'sponsor', label: 'Sponsor', render: (r) => <span className="text-xs">{r.sponsor_slug ?? '\u2014'}</span> },
          { key: 'dates', label: 'Dates', render: (r) => (
            <span className="text-xs text-muted">
              {r.adopted_from ?? '\u2014'} &rarr; {r.adopted_until ?? 'ongoing'}
            </span>
          ) },
          { key: 'active', label: 'Active', render: (r) => (
            <StatusPill color={r.active ? 'green' : 'gray'}>{r.active ? 'Yes' : 'No'}</StatusPill>
          ) },
        ]}
        onEdit={(r) => setEditing(r)}
      />
    </div>
  );
}
