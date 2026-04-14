import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { loadRecipes } from '../../lib/recipes';
import { loadLessons, type Lesson } from '../../lib/lessons';
import type { Recipe } from '../../lib/types';

/**
 * Rich field components used inside admin forms. Each one is a
 * controlled input: takes (value, onChange) and renders whatever UI
 * makes sense for the field's shape.
 */

// ---------- Markdown field with live preview ----------

export function MarkdownField({
  label,
  value,
  onChange,
  help,
  rows = 12,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  help?: string;
  rows?: number;
}) {
  const [tab, setTab] = useState<'edit' | 'preview'>('edit');
  const html = useMemo(() => renderMarkdown(value ?? ''), [value]);
  return (
    <div className="sm:col-span-2">
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-muted">{label}</span>
        <div className="flex rounded-full border border-rule bg-surface p-0.5 text-[11px]">
          <button
            type="button"
            onClick={() => setTab('edit')}
            className={`rounded-full px-2 py-0.5 ${tab === 'edit' ? 'bg-terracotta text-cream' : 'text-muted'}`}
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => setTab('preview')}
            className={`rounded-full px-2 py-0.5 ${tab === 'preview' ? 'bg-terracotta text-cream' : 'text-muted'}`}
          >
            Preview
          </button>
        </div>
      </div>
      {tab === 'edit' ? (
        <textarea
          rows={rows}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Write in markdown. Blank lines = paragraphs. # heading, **bold**, *italic*, > blockquote, - list items."
          className="mt-1 w-full rounded-xl border border-rule bg-cream px-3 py-2 font-mono text-xs leading-relaxed"
        />
      ) : (
        <div
          className="prose-like mt-1 min-h-[200px] rounded-xl border border-rule bg-cream px-4 py-3 text-sm leading-relaxed"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )}
      {help && <span className="mt-1 block text-xs text-muted">{help}</span>}
    </div>
  );
}

/** Tiny, dependency-free markdown renderer. Handles headings, paragraphs,
 *  blockquotes, unordered lists, bold (**), italic (*), and inline code. */
function renderMarkdown(src: string): string {
  if (!src) return '<p class="text-muted italic">Empty.</p>';
  const blocks = src.split(/\n\n+/);
  const out: string[] = [];
  for (const raw of blocks) {
    const b = raw.trim();
    if (!b) continue;
    if (b.startsWith('# ')) {
      out.push(`<h2 style="font-family:Georgia,serif;font-size:1.3em;margin:1em 0 .3em;">${inline(b.slice(2))}</h2>`);
    } else if (b.startsWith('## ')) {
      out.push(`<h3 style="font-family:Georgia,serif;font-size:1.1em;margin:1em 0 .3em;">${inline(b.slice(3))}</h3>`);
    } else if (b.startsWith('> ')) {
      out.push(
        `<blockquote style="border-left:3px solid #A84B2F;padding-left:12px;color:#7A6B5D;font-style:italic;margin:.8em 0;">${inline(
          b.replace(/^> ?/gm, ''),
        )}</blockquote>`,
      );
    } else if (/^[-*] /m.test(b)) {
      const items = b
        .split('\n')
        .filter((l) => /^[-*] /.test(l))
        .map((l) => `<li>${inline(l.replace(/^[-*] /, ''))}</li>`)
        .join('');
      out.push(`<ul style="list-style:disc;padding-left:1.5em;margin:.6em 0;">${items}</ul>`);
    } else {
      out.push(`<p style="margin:.6em 0;line-height:1.65;">${inline(b.replace(/\n/g, '<br>'))}</p>`);
    }
  }
  return out.join('');
}

function inline(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code style="background:#f5eedf;padding:1px 4px;border-radius:4px;">$1</code>');
}

// ---------- Image upload field ----------

export function ImageUploadField({
  label,
  value,
  onChange,
  bucket = 'recipe-images',
  pathPrefix = 'admin/',
  help,
}: {
  label: string;
  value: string | null;
  onChange: (url: string | null) => void;
  bucket?: string;
  pathPrefix?: string;
  help?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    if (!supabase) {
      setErr('Supabase not configured');
      return;
    }
    setBusy(true);
    setErr(null);
    const ext = file.name.split('.').pop() ?? 'jpg';
    const path = `${pathPrefix}${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from(bucket)
      .upload(path, file, { contentType: file.type, upsert: false });
    if (upErr) {
      setErr(upErr.message);
      setBusy(false);
      return;
    }
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    onChange(data.publicUrl);
    setBusy(false);
  }

  return (
    <label className="block text-sm sm:col-span-2">
      <span className="text-muted">{label}</span>
      <div className="mt-1 flex items-start gap-3 rounded-xl border border-rule bg-cream p-3">
        {value ? (
          <div className="flex items-start gap-3">
            <img
              src={value}
              alt=""
              className="h-24 w-24 rounded-lg border border-rule object-cover"
            />
            <div className="flex flex-col gap-2 text-xs">
              <a href={value} target="_blank" rel="noreferrer" className="truncate text-muted hover:text-terracotta">
                {value.replace(/^https?:\/\//, '').slice(0, 40)}&hellip;
              </a>
              <button
                type="button"
                onClick={() => onChange(null)}
                className="self-start text-rose-700 hover:underline"
              >
                Remove
              </button>
            </div>
          </div>
        ) : (
          <div className="flex h-24 w-24 items-center justify-center rounded-lg border border-dashed border-rule text-[10px] uppercase tracking-widest text-muted">
            No image
          </div>
        )}
        <div className="flex flex-1 flex-col gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f);
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="btn w-full justify-center text-xs"
          >
            {busy ? 'Uploadingâ€¦' : value ? 'Replace' : 'Upload image'}
          </button>
          <input
            type="text"
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value || null)}
            placeholder="Or paste a URL directly"
            className="rounded-full border border-rule bg-surface px-3 py-1.5 text-xs"
          />
          {err && <p className="text-xs text-rose-700">{err}</p>}
        </div>
      </div>
      {help && <span className="mt-1 block text-xs text-muted">{help}</span>}
    </label>
  );
}

// ---------- Recipe picker ----------

export function RecipePickerField({
  label,
  value,
  onChange,
  help,
}: {
  label: string;
  value: string[];
  onChange: (v: string[]) => void;
  help?: string;
}) {
  const [all, setAll] = useState<Recipe[]>([]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    void loadRecipes().then(setAll);
  }, []);

  const byId = useMemo(() => {
    const m = new Map<string, Recipe>();
    for (const r of all) m.set(r.id, r);
    return m;
  }, [all]);

  const selected = value ?? [];
  const selectedRecipes = selected.map((id) => byId.get(id)).filter(Boolean) as Recipe[];

  const q = query.trim().toLowerCase();
  const results = q
    ? all
        .filter((r) => !selected.includes(r.id))
        .filter((r) => r.title.toLowerCase().includes(q))
        .slice(0, 12)
    : [];

  function add(id: string) {
    if (selected.includes(id)) return;
    onChange([...selected, id]);
    setQuery('');
  }
  function remove(id: string) {
    onChange(selected.filter((x) => x !== id));
  }
  function move(index: number, dir: -1 | 1) {
    const j = index + dir;
    if (j < 0 || j >= selected.length) return;
    const next = [...selected];
    [next[index], next[j]] = [next[j], next[index]];
    onChange(next);
  }

  return (
    <div className="sm:col-span-2">
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-muted">{label}</span>
        <span className="text-xs text-muted">{selected.length} selected</span>
      </div>
      <div className="relative mt-1">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search the library by title..."
          className="w-full rounded-full border border-rule bg-cream px-4 py-2 text-sm"
        />
        {results.length > 0 && (
          <ul className="absolute left-0 right-0 top-full z-10 mt-1 max-h-60 overflow-y-auto rounded-xl border border-rule bg-surface shadow-card">
            {results.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => add(r.id)}
                  className="flex w-full items-baseline justify-between gap-3 px-3 py-2 text-left text-xs hover:bg-paper"
                >
                  <span className="font-serif">{r.title}</span>
                  <span className="text-muted">
                    {r.source_book} Â· {r.source_year}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <ol className="mt-3 space-y-1">
        {selectedRecipes.length === 0 && (
          <li className="rounded-xl border border-dashed border-rule px-3 py-4 text-center text-xs text-muted">
            No recipes selected yet. Search above.
          </li>
        )}
        {selectedRecipes.map((r, i) => (
          <li
            key={r.id}
            className="flex items-center gap-2 rounded-xl border border-rule bg-surface px-3 py-1.5 text-xs"
          >
            <span className="w-6 text-muted">{i + 1}.</span>
            <span className="flex-1 truncate font-serif">{r.title}</span>
            <span className="hidden text-muted sm:inline">
              {r.source_year}
            </span>
            <button
              type="button"
              onClick={() => move(i, -1)}
              disabled={i === 0}
              className="px-1 text-muted disabled:opacity-30 hover:text-terracotta"
              aria-label="Move up"
            >
              â†‘
            </button>
            <button
              type="button"
              onClick={() => move(i, 1)}
              disabled={i === selectedRecipes.length - 1}
              className="px-1 text-muted disabled:opacity-30 hover:text-terracotta"
              aria-label="Move down"
            >
              â†“
            </button>
            <button
              type="button"
              onClick={() => remove(r.id)}
              className="px-1 text-rose-700"
              aria-label="Remove"
            >
              Ã—
            </button>
          </li>
        ))}
      </ol>
      {help && <span className="mt-2 block text-xs text-muted">{help}</span>}
    </div>
  );
}

// ---------- Lesson picker ----------

export function LessonPickerField({
  label,
  value,
  onChange,
  help,
}: {
  label: string;
  value: string[];
  onChange: (v: string[]) => void;
  help?: string;
}) {
  const [all, setAll] = useState<Lesson[]>([]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    void loadLessons().then(setAll);
  }, []);

  const byId = useMemo(() => {
    const m = new Map<string, Lesson>();
    for (const l of all) m.set(l.id, l);
    return m;
  }, [all]);

  const selected = value ?? [];
  const selectedLessons = selected
    .map((id) => byId.get(id))
    .filter(Boolean) as Lesson[];

  const q = query.trim().toLowerCase();
  const results = q
    ? all
        .filter((l) => !selected.includes(l.id))
        .filter(
          (l) =>
            l.title.toLowerCase().includes(q) || l.topic.toLowerCase().includes(q),
        )
        .slice(0, 12)
    : [];

  function add(id: string) {
    if (selected.includes(id)) return;
    onChange([...selected, id]);
    setQuery('');
  }
  function remove(id: string) {
    onChange(selected.filter((x) => x !== id));
  }
  function move(index: number, dir: -1 | 1) {
    const j = index + dir;
    if (j < 0 || j >= selected.length) return;
    const next = [...selected];
    [next[index], next[j]] = [next[j], next[index]];
    onChange(next);
  }

  return (
    <div className="sm:col-span-2">
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-muted">{label}</span>
        <span className="text-xs text-muted">{selected.length} selected</span>
      </div>
      <div className="relative mt-1">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search lessons by title or topic..."
          className="w-full rounded-full border border-rule bg-cream px-4 py-2 text-sm"
        />
        {results.length > 0 && (
          <ul className="absolute left-0 right-0 top-full z-10 mt-1 max-h-60 overflow-y-auto rounded-xl border border-rule bg-surface shadow-card">
            {results.map((l) => (
              <li key={l.id}>
                <button
                  type="button"
                  onClick={() => add(l.id)}
                  className="flex w-full items-baseline justify-between gap-3 px-3 py-2 text-left text-xs hover:bg-paper"
                >
                  <span className="font-serif">{l.title}</span>
                  <span className="text-muted">
                    {l.topic} Â· {l.source_year}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <ol className="mt-3 space-y-1">
        {selectedLessons.length === 0 && (
          <li className="rounded-xl border border-dashed border-rule px-3 py-4 text-center text-xs text-muted">
            No lessons selected yet. Search above.
          </li>
        )}
        {selectedLessons.map((l, i) => (
          <li
            key={l.id}
            className="flex items-center gap-2 rounded-xl border border-rule bg-surface px-3 py-1.5 text-xs"
          >
            <span className="w-6 text-muted">{i + 1}.</span>
            <span className="flex-1 truncate font-serif">{l.title}</span>
            <span className="hidden text-muted sm:inline">{l.topic}</span>
            <button
              type="button"
              onClick={() => move(i, -1)}
              disabled={i === 0}
              className="px-1 text-muted disabled:opacity-30 hover:text-terracotta"
            >
              â†‘
            </button>
            <button
              type="button"
              onClick={() => move(i, 1)}
              disabled={i === selectedLessons.length - 1}
              className="px-1 text-muted disabled:opacity-30 hover:text-terracotta"
            >
              â†“
            </button>
            <button
              type="button"
              onClick={() => remove(l.id)}
              className="px-1 text-rose-700"
            >
              Ã—
            </button>
          </li>
        ))}
      </ol>
      {help && <span className="mt-2 block text-xs text-muted">{help}</span>}
    </div>
  );
}
