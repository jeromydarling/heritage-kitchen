import { useState } from 'react';
import { useAdminCrud, slugify } from '../../lib/adminCrud';
import { ResourceList, ResourceForm, AdminFieldDef, StatusPill } from './_shared';
import { MarkdownField, ImageUploadField } from './_fields';
import { TOPIC_META } from '../../lib/lessons';

interface Lesson {
  id: string;
  title: string;
  source_book: string | null;
  source_author: string | null;
  source_year: string | null;
  source_url: string | null;
  topic: string;
  original_text: string;
  modern_explanation: string;
  key_takeaways: string[];
  still_true: string;
  outdated: string;
  related_recipe_tags: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  fun_for_kids: boolean;
  image_prompt: string | null;
  image_url: string | null;
  published: boolean;
  featured: boolean;
  sort_order: number;
}

const TOPIC_OPTIONS = Object.entries(TOPIC_META).map(([value, meta]) => ({
  value,
  label: meta.label,
}));

const FIELDS: AdminFieldDef<Lesson>[] = [
  { key: 'id', label: 'ID / slug', type: 'text', required: true, help: 'URL-safe id, e.g. "shc-leavening-quick-breads"' },
  { key: 'title', label: 'Title', type: 'text', required: true },
  { key: 'topic', label: 'Topic', type: 'select', options: TOPIC_OPTIONS },
  { key: 'difficulty', label: 'Difficulty', type: 'select', options: [
    { value: 'beginner', label: 'Beginner' },
    { value: 'intermediate', label: 'Intermediate' },
    { value: 'advanced', label: 'Advanced' },
  ] },
  { key: 'fun_for_kids', label: 'Fun for kids', type: 'boolean', help: 'Shown in the /how-to-cook/kids track when enabled.' },
  { key: 'source_book', label: 'Source book', type: 'text' },
  { key: 'source_author', label: 'Source author', type: 'text' },
  { key: 'source_year', label: 'Source year', type: 'text' },
  { key: 'source_url', label: 'Gutenberg URL', type: 'text' },
  { key: 'key_takeaways', label: 'Key takeaways (JSON array)', type: 'json', rows: 6, help: 'A list of short bullet strings shown in the takeaway callout at the top of the lesson.' },
  { key: 'related_recipe_tags', label: 'Related recipe tags (JSON array)', type: 'json', rows: 4, help: 'Recipe categories or tags this lesson pairs with. Used to surface related recipes and to cross-link from recipe pages.' },
  { key: 'image_prompt', label: 'Image prompt', type: 'textarea', help: 'Used by the AI illustration generator.' },
  { key: 'sort_order', label: 'Sort order', type: 'number' },
  { key: 'published', label: 'Published', type: 'boolean' },
  { key: 'featured', label: 'Featured', type: 'boolean' },
];

export default function LessonsAdminPage() {
  const crud = useAdminCrud<Lesson>('lessons', 'id', { orderBy: 'sort_order' });
  const [editing, setEditing] = useState<Lesson | null>(null);

  return (
    <div className="space-y-6">
      <header className="flex items-baseline justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-terracotta">
            The kitchen school
          </p>
          <h1 className="mt-1 font-serif text-3xl">Lessons (How to Cook)</h1>
        </div>
        <button
          type="button"
          onClick={() =>
            setEditing({
              id: '',
              title: 'New lesson',
              source_book: null,
              source_author: null,
              source_year: null,
              source_url: null,
              topic: 'food-science',
              original_text: '',
              modern_explanation: '',
              key_takeaways: [],
              still_true: '',
              outdated: '',
              related_recipe_tags: [],
              difficulty: 'beginner',
              fun_for_kids: false,
              image_prompt: null,
              image_url: null,
              published: true,
              featured: false,
              sort_order: (crud.rows.length ?? 0) + 1,
            })
          }
          className="btn-primary"
        >
          + New lesson
        </button>
      </header>

      {editing && (
        <ResourceForm<Lesson>
          title={editing.id ? `Edit: ${editing.title}` : 'New lesson'}
          fields={FIELDS}
          value={editing}
          onChange={setEditing}
          onCancel={() => setEditing(null)}
          previewUrl={
            editing.id
              ? `#/how-to-cook/${editing.id}${editing.published ? '' : '?preview=1'}`
              : undefined
          }
          extra={
            <>
              <ImageUploadField
                label="Lesson image"
                value={editing.image_url}
                onChange={(url) => setEditing({ ...editing, image_url: url })}
                pathPrefix="lessons/"
              />
              <MarkdownField
                label="Original text (from the source book)"
                value={editing.original_text}
                onChange={(v) => setEditing({ ...editing, original_text: v })}
                rows={14}
                help="The verbatim historical text. Shown in the typewriter treatment on the detail page."
              />
              <MarkdownField
                label="Modern explanation"
                value={editing.modern_explanation}
                onChange={(v) => setEditing({ ...editing, modern_explanation: v })}
                rows={14}
                help="The main article body. Blank lines become paragraphs. Supports markdown."
              />
              <MarkdownField
                label="Still true"
                value={editing.still_true}
                onChange={(v) => setEditing({ ...editing, still_true: v })}
                rows={6}
                help="What the historical text got right. Left column of the two-column trust block."
              />
              <MarkdownField
                label="Needs updating"
                value={editing.outdated}
                onChange={(v) => setEditing({ ...editing, outdated: v })}
                rows={6}
                help="What has been superseded. Right column of the two-column trust block."
              />
            </>
          }
          onSave={async (row) => {
            const next = { ...row };
            if (!next.id) next.id = slugify(next.title);
            await crud.upsert(next);
            setEditing(null);
          }}
          onDelete={
            crud.rows.some((r) => r.id === editing.id)
              ? async () => {
                  if (!confirm(`Delete "${editing.title}"?`)) return;
                  await crud.remove(editing.id);
                  setEditing(null);
                }
              : undefined
          }
        />
      )}

      <ResourceList<Lesson>
        loading={crud.loading}
        rows={crud.rows}
        columns={[
          { key: 'title', label: 'Title', render: (r) => (
            <div>
              <div className="font-serif">{r.title}</div>
              <div className="text-xs italic text-muted">
                {r.source_book} Â· {r.source_year}
              </div>
            </div>
          ) },
          { key: 'topic', label: 'Topic', render: (r) => (
            <span className="text-xs text-muted">
              {TOPIC_META[r.topic]?.label ?? r.topic}
            </span>
          ) },
          { key: 'diff', label: 'Difficulty', render: (r) => (
            <span className="text-xs capitalize">{r.difficulty}</span>
          ) },
          { key: 'kids', label: 'Kids', render: (r) => (
            r.fun_for_kids ? (
              <StatusPill color="amber">Kids</StatusPill>
            ) : (
              <span className="text-xs text-muted">&mdash;</span>
            )
          ) },
          { key: 'pub', label: 'Published', render: (r) => (
            <StatusPill color={r.published ? 'green' : 'gray'}>
              {r.published ? 'Yes' : 'Draft'}
            </StatusPill>
          ) },
        ]}
        onEdit={(r) => setEditing(r)}
      />
    </div>
  );
}
