import { useState } from 'react';
import { useAdminCrud } from '../../lib/adminCrud';
import { ResourceList, StatusPill } from './_shared';

interface Enquiry {
  id: string;
  kind: 'custom_cookbook' | 'parish_cookbook' | 'research' | 'licensing' | 'other';
  name: string;
  email: string;
  subject: string | null;
  message: string;
  budget_range: string | null;
  status: 'new' | 'replied' | 'scheduled' | 'completed' | 'declined';
  created_at: string;
}

const STATUS_COLORS: Record<Enquiry['status'], 'amber' | 'sky' | 'indigo' | 'green' | 'rose'> = {
  new: 'amber',
  replied: 'sky',
  scheduled: 'indigo',
  completed: 'green',
  declined: 'rose',
};

export default function EnquiriesAdminPage() {
  const crud = useAdminCrud<Enquiry>('service_enquiries', 'id', {
    orderBy: 'created_at',
    ascending: false,
  });
  const [open, setOpen] = useState<Enquiry | null>(null);

  async function setStatus(e: Enquiry, status: Enquiry['status']) {
    await crud.upsert({ id: e.id, status } as Partial<Enquiry>);
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-terracotta">Service inbox</p>
        <h1 className="mt-1 font-serif text-3xl">Enquiries</h1>
        <p className="mt-2 text-sm text-muted">
          Every commission, research request, and licensing enquiry that
          comes through the /services and /licensing pages lands here.
        </p>
      </header>

      {open && (
        <div className="rounded-2xl border border-rule bg-surface p-6 shadow-card">
          <div className="flex items-baseline justify-between">
            <div>
              <p className="text-xs uppercase tracking-widest text-muted">{open.kind}</p>
              <h2 className="mt-1 font-serif text-xl">
                {open.name} &middot; {open.subject ?? 'Enquiry'}
              </h2>
              <p className="mt-1 text-xs text-muted">
                {open.email} &middot; {new Date(open.created_at).toLocaleString()}
                {open.budget_range && ` &middot; Budget: ${open.budget_range}`}
              </p>
            </div>
            <button type="button" onClick={() => setOpen(null)} className="text-xs text-muted hover:text-terracotta">
              Close
            </button>
          </div>
          <p className="mt-4 whitespace-pre-wrap font-serif leading-relaxed text-ink">
            {open.message}
          </p>
          <div className="mt-5 flex flex-wrap gap-2 border-t border-rule pt-4">
            {(['new', 'replied', 'scheduled', 'completed', 'declined'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => void setStatus(open, s)}
                className={`rounded-full border px-3 py-1 text-xs ${
                  open.status === s
                    ? 'border-terracotta bg-terracotta text-cream'
                    : 'border-rule bg-surface text-muted hover:border-terracotta'
                }`}
              >
                {s}
              </button>
            ))}
            <a
              href={`mailto:${open.email}?subject=Re: ${encodeURIComponent(open.subject ?? 'Your enquiry')}`}
              className="ml-auto text-xs text-terracotta"
            >
              Reply by email &rarr;
            </a>
          </div>
        </div>
      )}

      <ResourceList<Enquiry>
        loading={crud.loading}
        rows={crud.rows}
        columns={[
          { key: 'date', label: 'When', render: (r) => (
            <span className="text-xs text-muted">
              {new Date(r.created_at).toLocaleDateString()}
            </span>
          ) },
          { key: 'kind', label: 'Kind', render: (r) => <span className="text-xs">{r.kind}</span> },
          { key: 'who', label: 'From', render: (r) => (
            <div>
              <div className="font-serif">{r.name}</div>
              <div className="text-xs italic text-muted">{r.email}</div>
            </div>
          ) },
          { key: 'preview', label: 'Message', render: (r) => (
            <span className="line-clamp-2 block max-w-sm text-xs text-muted">
              {r.message}
            </span>
          ) },
          { key: 'status', label: 'Status', render: (r) => (
            <StatusPill color={STATUS_COLORS[r.status]}>{r.status}</StatusPill>
          ) },
        ]}
        onEdit={(r) => setOpen(r)}
        emptyLabel="No enquiries yet. When someone fills in the /services or /licensing form, it lands here."
      />
    </div>
  );
}
