import { useState } from 'react';
import { useAdminCrud, slugify } from '../../lib/adminCrud';
import { ResourceList, ResourceForm, AdminFieldDef, StatusPill } from './_shared';
import { MarkdownField, ImageUploadField, RecipePickerField, LessonPickerField } from './_fields';
import { supabase } from '../../lib/supabase';
import { loadAllForIds, loadRecipes } from '../../lib/recipes';
import { loadLessons } from '../../lib/lessons';
import { autoSelectEdition, type EditionSelector } from '../../lib/editionSelector';

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
  lesson_ids: string[];
  selector: EditionSelector | null;
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
              lesson_ids: [],
              selector: null,
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
          previewUrl={
            editing.slug
              ? `#/editions/${editing.slug}${editing.published ? '' : '?preview=1'}`
              : undefined
          }
          extra={
            <>
              <ImageUploadField
                label="Cover image"
                value={editing.cover_image_url}
                onChange={(url) => setEditing({ ...editing, cover_image_url: url })}
                pathPrefix="editions/"
                help="Leave blank for the typeset placeholder cover."
              />
              <MarkdownField
                label="A note from the editors (intro_text)"
                value={editing.intro_text ?? ''}
                onChange={(v) => setEditing({ ...editing, intro_text: v || null })}
                rows={10}
                help="Long-form editor letter shown on the edition detail page. Supports markdown."
              />
              <RecipePickerField
                label="Recipes in this edition"
                value={editing.recipe_ids ?? []}
                onChange={(ids) => setEditing({ ...editing, recipe_ids: ids })}
                help="Drag with the arrow buttons to reorder. Order matters when the book is generated."
              />
              <LessonPickerField
                label="Lessons in this edition"
                value={editing.lesson_ids ?? []}
                onChange={(ids) => setEditing({ ...editing, lesson_ids: ids })}
                help="Leave empty for a recipe-only book. Lesson-only and mixed anthology editions both work."
              />
              <SelectorPanel
                edition={editing}
                onUpdate={(updates) => setEditing({ ...editing, ...updates })}
              />
              <BuildInteriorPdfPanel
                edition={editing}
                onUpdate={(updates) => setEditing({ ...editing, ...updates })}
              />
            </>
          }
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

/**
 * Build-interior-PDF panel. Renders inside the edition edit form as part
 * of the `extra` slot. Client-side generates a PDF from the edition's
 * selected recipes + lessons using pdfGen.ts (lazy-imported), uploads it
 * to the cookbook-pdfs Supabase Storage bucket, and writes the resulting
 * path + public URL + page count back onto the edition row.
 *
 * This is how editorial editions go from "title and recipe ids picked"
 * to "ready to sell as a printed book." No developer involvement once
 * the content is chosen in the admin.
 */
function BuildInteriorPdfPanel({
  edition,
  onUpdate,
}: {
  edition: Edition;
  onUpdate: (updates: Partial<Edition>) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const canBuild =
    !!edition.slug &&
    ((edition.recipe_ids?.length ?? 0) > 0 || (edition.lesson_ids?.length ?? 0) > 0);

  async function build() {
    if (!supabase || !canBuild) return;
    setBusy(true);
    setErr(null);
    setStatus('Loading content\u2026');
    try {
      const [{ generateCookbookPdfWithMeta }, recipes, lessons] = await Promise.all([
        import('../../lib/pdfGen'),
        loadAllForIds(edition.recipe_ids ?? []),
        loadLessons().then((all) =>
          (edition.lesson_ids ?? [])
            .map((id) => all.find((l) => l.id === id))
            .filter((l): l is NonNullable<typeof l> => !!l),
        ),
      ]);

      setStatus('Generating PDF\u2026');
      const { blob, pageCount } = await generateCookbookPdfWithMeta({
        title: edition.title,
        subtitle: edition.subtitle,
        dedication: null,
        recipes,
        lessons,
      });

      setStatus(`Uploading ${pageCount}-page PDF\u2026`);
      const path = `editions/${edition.slug}-interior.pdf`;
      const { error: upErr } = await supabase.storage
        .from('cookbook-pdfs')
        .upload(path, blob, {
          contentType: 'application/pdf',
          upsert: true,
        });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from('cookbook-pdfs').getPublicUrl(path);

      setStatus('Saving to edition\u2026');
      await supabase
        .from('editions')
        .update({
          pdf_storage_path: path,
          interior_pdf_url: data.publicUrl,
          page_count: pageCount,
          updated_at: new Date().toISOString(),
        })
        .eq('slug', edition.slug);

      onUpdate({
        pdf_storage_path: path,
        interior_pdf_url: data.publicUrl,
        page_count: pageCount,
      });
      setStatus(`Done. Uploaded ${pageCount} pages.`);
    } catch (e) {
      setErr((e as Error).message);
      setStatus(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sm:col-span-2">
      <div className="rounded-2xl border border-dashed border-terracotta/40 bg-terracotta/5 p-5">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <p className="font-serif text-base text-ink">
              Build the interior PDF
            </p>
            <p className="mt-1 text-xs text-muted">
              Generates a print-ready PDF from the selected recipes and
              lessons using the same pipeline that powers custom user
              cookbooks. Writes the result into the <code>cookbook-pdfs</code>{' '}
              storage bucket and updates this edition's{' '}
              <code>interior_pdf_url</code>, <code>pdf_storage_path</code>,
              and <code>page_count</code>. Run this whenever you change
              the recipe or lesson selection.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void build()}
            disabled={busy || !canBuild}
            className="btn-primary whitespace-nowrap"
          >
            {busy ? 'Building\u2026' : 'Build PDF'}
          </button>
        </div>
        <dl className="mt-4 grid gap-2 text-xs text-muted sm:grid-cols-3">
          <div>
            <dt className="text-[10px] uppercase tracking-widest">Recipes</dt>
            <dd>{edition.recipe_ids?.length ?? 0}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-widest">Lessons</dt>
            <dd>{edition.lesson_ids?.length ?? 0}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-widest">Page count</dt>
            <dd>{edition.page_count ?? '\u2014'}</dd>
          </div>
        </dl>
        {edition.interior_pdf_url && (
          <p className="mt-3 text-xs">
            <a href={edition.interior_pdf_url} target="_blank" rel="noreferrer">
              Current interior PDF &rarr;
            </a>
          </p>
        )}
        {status && !err && (
          <p className="mt-3 text-xs italic text-muted">{status}</p>
        )}
        {err && (
          <p className="mt-3 text-xs text-rose-700">
            Failed: {err}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Selector panel: shows the current auto-assembly selector as an
 * editable JSON blob, plus a "Rebuild from selector" button that runs
 * autoSelectEdition() against the full library and overwrites the
 * edition's recipe_ids and lesson_ids in-memory. The admin can then
 * hand-tune before saving, and finally click "Build PDF" to produce
 * the printable interior.
 */
function SelectorPanel({
  edition,
  onUpdate,
}: {
  edition: Edition;
  onUpdate: (updates: Partial<Edition>) => void;
}) {
  const [draft, setDraft] = useState<string>(
    JSON.stringify(edition.selector ?? {}, null, 2),
  );
  const [err, setErr] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function rebuild() {
    setBusy(true);
    setErr(null);
    setStatus(null);
    try {
      let parsed: EditionSelector;
      try {
        parsed = JSON.parse(draft || '{}') as EditionSelector;
      } catch (e) {
        setErr('Selector JSON is invalid: ' + (e as Error).message);
        setBusy(false);
        return;
      }
      const [recipes, lessons] = await Promise.all([
        loadRecipes(),
        loadLessons(),
      ]);
      const result = autoSelectEdition(parsed, recipes, lessons);
      onUpdate({
        selector: parsed,
        recipe_ids: result.recipe_ids,
        lesson_ids: result.lesson_ids,
      });
      setStatus(
        `Selected ${result.recipeCount} recipes and ${result.lessonCount} lessons. Remember to Save.`,
      );
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sm:col-span-2">
      <div className="rounded-2xl border border-dashed border-rule bg-surface p-5">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <p className="font-serif text-base text-ink">
              Auto-assembly selector
            </p>
            <p className="mt-1 text-xs text-muted">
              A declarative filter over the recipe and lesson libraries.
              Click Rebuild to regenerate <code>recipe_ids</code> and{' '}
              <code>lesson_ids</code> from the current filter. You can
              hand-tune with the pickers above afterward. See
              src/lib/editionSelector.ts for the schema and available
              keys.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void rebuild()}
            disabled={busy}
            className="btn whitespace-nowrap"
          >
            {busy ? 'Rebuilding\u2026' : 'Rebuild from selector'}
          </button>
        </div>
        <textarea
          rows={10}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="mt-3 w-full rounded-xl border border-rule bg-cream p-3 font-mono text-xs leading-relaxed"
        />
        {status && !err && (
          <p className="mt-2 text-xs italic text-muted">{status}</p>
        )}
        {err && <p className="mt-2 text-xs text-rose-700">{err}</p>}
      </div>
    </div>
  );
}
