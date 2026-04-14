import { useState } from 'react';
import { useAdminCrud, slugify } from '../../lib/adminCrud';
import { ResourceList, ResourceForm, AdminFieldDef, StatusPill } from './_shared';

interface Course {
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  intro_text: string | null;
  price_usd: number;
  total_days: number;
  start_trigger: 'on_purchase' | 'fixed_date' | 'ash_wednesday' | 'first_sunday_advent';
  start_date: string | null;
  published: boolean;
  featured: boolean;
  sort_order: number;
}

interface CourseLesson {
  course_slug: string;
  day_number: number;
  title: string;
  body_markdown: string;
  recipe_id: string | null;
}

const COURSE_FIELDS: AdminFieldDef<Course>[] = [
  { key: 'slug', label: 'Slug', type: 'text', required: true },
  { key: 'title', label: 'Title', type: 'text', required: true },
  { key: 'subtitle', label: 'Subtitle', type: 'text' },
  { key: 'description', label: 'Description', type: 'textarea' },
  { key: 'intro_text', label: 'Intro text', type: 'textarea' },
  { key: 'price_usd', label: 'Price (USD)', type: 'number', step: '0.01' },
  { key: 'total_days', label: 'Total days', type: 'number' },
  { key: 'start_trigger', label: 'Start trigger', type: 'select', options: [
    { value: 'on_purchase', label: 'On purchase (next day)' },
    { value: 'fixed_date', label: 'Fixed date' },
    { value: 'ash_wednesday', label: 'Next Ash Wednesday' },
    { value: 'first_sunday_advent', label: 'Next First Sunday of Advent' },
  ] },
  { key: 'start_date', label: 'Fixed start date', type: 'date', help: 'Only used if Start trigger is "Fixed date".' },
  { key: 'sort_order', label: 'Sort order', type: 'number' },
  { key: 'published', label: 'Published', type: 'boolean' },
  { key: 'featured', label: 'Featured', type: 'boolean' },
];

export default function CoursesAdminPage() {
  const crud = useAdminCrud<Course>('courses', 'slug', { orderBy: 'sort_order' });
  const [editing, setEditing] = useState<Course | null>(null);
  const [editingLessons, setEditingLessons] = useState<Course | null>(null);

  return (
    <div className="space-y-6">
      <header className="flex items-baseline justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-terracotta">Email courses</p>
          <h1 className="mt-1 font-serif text-3xl">Courses</h1>
        </div>
        <button
          type="button"
          onClick={() =>
            setEditing({
              slug: '',
              title: 'New course',
              subtitle: null,
              description: null,
              intro_text: null,
              price_usd: 39,
              total_days: 40,
              start_trigger: 'on_purchase',
              start_date: null,
              published: false,
              featured: false,
              sort_order: (crud.rows.length ?? 0) + 1,
            })
          }
          className="btn-primary"
        >
          + New course
        </button>
      </header>

      {editing && (
        <ResourceForm<Course>
          title={editing.slug ? `Edit: ${editing.title}` : 'New course'}
          fields={COURSE_FIELDS}
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
                  if (!confirm(`Delete "${editing.title}"? All lessons will be deleted too.`)) return;
                  await crud.remove(editing.slug);
                  setEditing(null);
                }
              : undefined
          }
        />
      )}

      {editingLessons && (
        <CourseLessonsEditor
          course={editingLessons}
          onClose={() => setEditingLessons(null)}
        />
      )}

      <ResourceList<Course>
        loading={crud.loading}
        rows={crud.rows}
        columns={[
          { key: 'title', label: 'Title', render: (r) => (
            <div>
              <div className="font-serif">{r.title}</div>
              {r.subtitle && <div className="text-xs italic text-muted">{r.subtitle}</div>}
            </div>
          ) },
          { key: 'days', label: 'Days', render: (r) => <span className="text-xs">{r.total_days}</span> },
          { key: 'price', label: 'Price', render: (r) => <span className="text-xs">${r.price_usd}</span> },
          { key: 'start', label: 'Starts', render: (r) => <span className="text-xs text-muted">{r.start_trigger}</span> },
          { key: 'status', label: 'Status', render: (r) => (
            <StatusPill color={r.published ? 'green' : 'gray'}>{r.published ? 'Published' : 'Draft'}</StatusPill>
          ) },
          { key: 'lessons', label: 'Lessons', render: (r) => (
            <button
              type="button"
              onClick={() => setEditingLessons(r)}
              className="text-xs text-terracotta hover:underline"
            >
              Edit lessons
            </button>
          ) },
        ]}
        onEdit={(r) => setEditing(r)}
      />
    </div>
  );
}

function CourseLessonsEditor({ course, onClose }: { course: Course; onClose: () => void }) {
  const crud = useAdminCrud<CourseLesson>('course_lessons', 'day_number', {
    orderBy: 'day_number',
    select: '*',
  });
  // Filter to this course only (the hook doesn't know about filters)
  const lessons = crud.rows.filter((l) => l.course_slug === course.slug);
  const [day, setDay] = useState<number>(1);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [recipeId, setRecipeId] = useState('');
  const [busy, setBusy] = useState(false);

  const existing = lessons.find((l) => l.day_number === day);

  // Load field values when switching days
  function load(d: number) {
    setDay(d);
    const row = lessons.find((l) => l.day_number === d);
    setTitle(row?.title ?? '');
    setBody(row?.body_markdown ?? '');
    setRecipeId(row?.recipe_id ?? '');
  }

  async function save() {
    setBusy(true);
    await crud.upsert({
      course_slug: course.slug,
      day_number: day,
      title: title || `Day ${day}`,
      body_markdown: body,
      recipe_id: recipeId || null,
    });
    setBusy(false);
  }

  return (
    <div className="rounded-2xl border border-rule bg-surface p-6 shadow-card">
      <div className="flex items-baseline justify-between">
        <h2 className="font-serif text-xl">
          Lessons: <em>{course.title}</em>
        </h2>
        <button type="button" onClick={onClose} className="text-xs text-muted hover:text-terracotta">
          Close
        </button>
      </div>
      <div className="mt-4 flex flex-wrap gap-1">
        {Array.from({ length: course.total_days }, (_, i) => i + 1).map((d) => {
          const has = lessons.some((l) => l.day_number === d);
          return (
            <button
              key={d}
              type="button"
              onClick={() => load(d)}
              className={`rounded-md px-2 py-1 text-xs ${
                d === day ? 'bg-terracotta text-cream' : has ? 'bg-paper text-ink' : 'bg-cream text-muted'
              }`}
            >
              {d}
            </button>
          );
        })}
      </div>
      <div className="mt-5 space-y-3">
        <label className="block text-sm">
          <span className="text-muted">Day {day} title</span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full rounded-xl border border-rule bg-cream px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="text-muted">Body (markdown)</span>
          <textarea
            rows={10}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write in markdown. Blank lines become paragraphs. Lines starting with '# ' become h2 headings."
            className="mt-1 w-full rounded-xl border border-rule bg-cream px-3 py-2 font-mono text-xs leading-relaxed"
          />
        </label>
        <label className="block text-sm">
          <span className="text-muted">Linked recipe id (optional)</span>
          <input
            type="text"
            value={recipeId}
            onChange={(e) => setRecipeId(e.target.value)}
            placeholder="e.g. bcs-cream-of-tomato-soup"
            className="mt-1 w-full rounded-xl border border-rule bg-cream px-3 py-2 text-sm"
          />
        </label>
      </div>
      <div className="mt-5 flex items-center justify-between">
        <p className="text-xs text-muted">
          {existing ? 'Saving will overwrite this day.' : 'No lesson saved for this day yet.'}
        </p>
        <button
          type="button"
          onClick={() => void save()}
          disabled={busy}
          className="btn-primary"
        >
          {busy ? 'Savingâ€¦' : 'Save day ' + day}
        </button>
      </div>
    </div>
  );
}
