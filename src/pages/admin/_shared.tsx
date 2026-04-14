import { useState } from 'react';

/**
 * Shared admin primitives: a resource list table and a resource form
 * driven by a declarative field definition. Keeps every /admin/*
 * resource page thin.
 */

export type AdminFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'boolean'
  | 'select'
  | 'date'
  | 'json';

export interface AdminFieldDef<T> {
  key: keyof T;
  label: string;
  type: AdminFieldType;
  required?: boolean;
  help?: string;
  step?: string;
  rows?: number;
  options?: Array<{ value: string; label: string }>;
}

interface Column<T> {
  key: string;
  label: string;
  render: (row: T) => React.ReactNode;
  width?: string;
}

export function ResourceList<T extends Record<string, any>>({
  loading,
  rows,
  columns,
  onEdit,
  emptyLabel = 'Nothing here yet.',
}: {
  loading: boolean;
  rows: T[];
  columns: Column<T>[];
  onEdit: (row: T) => void;
  emptyLabel?: string;
}) {
  if (loading) return <p className="text-muted">Loadingâ€¦</p>;
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-rule bg-surface p-10 text-center text-sm text-muted">
        {emptyLabel}
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-2xl border border-rule bg-surface">
      <table className="w-full text-sm">
        <thead className="bg-paper text-left text-xs uppercase tracking-widest text-muted">
          <tr>
            {columns.map((c) => (
              <th key={c.key} className="px-4 py-3" style={c.width ? { width: c.width } : undefined}>
                {c.label}
              </th>
            ))}
            <th className="w-20 px-4 py-3 text-right">Edit</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={(row as Record<string, unknown>).id as string ?? (row as Record<string, unknown>).slug as string ?? i}
              className="border-t border-rule hover:bg-paper"
            >
              {columns.map((c) => (
                <td key={c.key} className="px-4 py-3 align-top">
                  {c.render(row)}
                </td>
              ))}
              <td className="px-4 py-3 text-right">
                <button
                  type="button"
                  onClick={() => onEdit(row)}
                  className="text-xs text-terracotta hover:underline"
                >
                  Edit â†’
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ResourceForm<T extends Record<string, any>>({
  title,
  fields,
  value,
  onChange,
  onSave,
  onCancel,
  onDelete,
}: {
  title: string;
  fields: AdminFieldDef<T>[];
  value: T;
  onChange: (v: T) => void;
  onSave: (v: T) => Promise<void>;
  onCancel: () => void;
  onDelete?: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await onSave(value);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function setField(key: keyof T, v: unknown) {
    onChange({ ...value, [key]: v } as T);
  }

  return (
    <form onSubmit={handleSave} className="rounded-2xl border border-rule bg-surface p-6 shadow-card">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-serif text-xl">{title}</h2>
        <button type="button" onClick={onCancel} className="text-xs text-muted hover:text-terracotta">
          Cancel
        </button>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {fields.map((f) => (
          <FieldInput<T> key={String(f.key)} field={f} value={value} setField={setField} />
        ))}
      </div>
      {err && <p className="mt-3 text-sm text-terracotta">{err}</p>}
      <div className="mt-6 flex items-center justify-between gap-3">
        {onDelete && (
          <button
            type="button"
            onClick={() => void onDelete()}
            className="text-xs text-rose-700 hover:underline"
          >
            Delete
          </button>
        )}
        <div className="ml-auto flex gap-2">
          <button type="button" onClick={onCancel} className="btn">
            Cancel
          </button>
          <button type="submit" disabled={busy} className="btn-primary">
            {busy ? 'Savingâ€¦' : 'Save'}
          </button>
        </div>
      </div>
    </form>
  );
}

function FieldInput<T extends Record<string, any>>({
  field,
  value,
  setField,
}: {
  field: AdminFieldDef<T>;
  value: T;
  setField: (key: keyof T, v: unknown) => void;
}) {
  const current = value[field.key] as unknown;
  const cls = 'mt-1 w-full rounded-xl border border-rule bg-cream px-3 py-2 text-sm';
  const wrapCls =
    field.type === 'textarea' || field.type === 'json'
      ? 'sm:col-span-2'
      : '';
  return (
    <label className={`block text-sm ${wrapCls}`}>
      <span className="text-muted">{field.label}</span>
      {field.type === 'textarea' ? (
        <textarea
          rows={field.rows ?? 5}
          value={(current as string) ?? ''}
          onChange={(e) => setField(field.key, e.target.value || null)}
          className={cls}
        />
      ) : field.type === 'boolean' ? (
        <select
          value={current ? 'true' : 'false'}
          onChange={(e) => setField(field.key, e.target.value === 'true')}
          className={cls}
        >
          <option value="false">No</option>
          <option value="true">Yes</option>
        </select>
      ) : field.type === 'select' ? (
        <select
          value={(current as string) ?? ''}
          onChange={(e) => setField(field.key, e.target.value)}
          className={cls}
        >
          {field.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : field.type === 'number' ? (
        <input
          type="number"
          step={field.step}
          value={(current as number | null) ?? ''}
          onChange={(e) => {
            const v = e.target.value;
            setField(field.key, v === '' ? null : Number(v));
          }}
          className={cls}
        />
      ) : field.type === 'date' ? (
        <input
          type="date"
          value={(current as string) ?? ''}
          onChange={(e) => setField(field.key, e.target.value || null)}
          className={cls}
        />
      ) : field.type === 'json' ? (
        <textarea
          rows={field.rows ?? 6}
          value={JSON.stringify(current ?? null, null, 2)}
          onChange={(e) => {
            try {
              setField(field.key, JSON.parse(e.target.value));
            } catch {
              // silently ignore invalid JSON during typing
            }
          }}
          className={`${cls} font-mono text-xs`}
        />
      ) : (
        <input
          type="text"
          required={field.required}
          value={(current as string) ?? ''}
          onChange={(e) => setField(field.key, e.target.value || null)}
          className={cls}
        />
      )}
      {field.help && <span className="mt-1 block text-xs text-muted">{field.help}</span>}
    </label>
  );
}

export function StatusPill({
  color,
  children,
}: {
  color: 'green' | 'gray' | 'amber' | 'rose' | 'indigo' | 'sky';
  children: React.ReactNode;
}) {
  const classes: Record<string, string> = {
    green: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    gray: 'bg-paper text-muted border-rule',
    amber: 'bg-amber-50 text-amber-900 border-amber-200',
    rose: 'bg-rose-50 text-rose-900 border-rose-200',
    indigo: 'bg-indigo-50 text-indigo-900 border-indigo-200',
    sky: 'bg-sky-50 text-sky-900 border-sky-200',
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest ${classes[color]}`}
    >
      {children}
    </span>
  );
}
