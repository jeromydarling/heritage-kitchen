import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useUser } from '../lib/auth';
import { useHousehold } from '../lib/household';
import { useKids, AVATAR_COLORS, type AvatarColor, type Kid } from '../lib/kids';

/**
 * Household page — the hub for managing kid profiles. Owners see
 * their household name and invite code; everyone in the household
 * can add, edit, and remove kid profiles.
 *
 * The page is intentionally quiet: no CTA, no marketing language,
 * no conversion goals. It's a place to tell the site about your
 * kids so that Cook-with-kids mode has something to bind to.
 */

const COLOR_SWATCH: Record<AvatarColor, string> = {
  terracotta: 'bg-terracotta',
  sage: 'bg-sage',
  cream: 'bg-cream border border-rule',
  ink: 'bg-ink',
  butter: 'bg-butter',
  plum: 'bg-plum',
  sky: 'bg-sky',
};

export default function HouseholdPage() {
  const user = useUser();
  const { household } = useHousehold();
  const { kids, addKid, updateKid, removeKid } = useKids();

  if (!user) return <Navigate to="/" replace />;

  return (
    <article className="space-y-10">
      <header>
        <p className="text-xs uppercase tracking-widest text-terracotta">
          Your household
        </p>
        <h1 className="mt-1 font-serif text-4xl">
          {household?.name ?? 'Household'}
        </h1>
        {household?.invite_code && (
          <p className="mt-2 text-sm text-muted">
            Invite code{' '}
            <span className="font-mono text-ink">{household.invite_code}</span>{' '}
            — share this with another adult to add them to this household.
          </p>
        )}
      </header>

      <section>
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="font-serif text-2xl">Kids</h2>
          <p className="text-xs text-muted">
            {kids.length === 0
              ? 'No profiles yet'
              : `${kids.length} profile${kids.length === 1 ? '' : 's'}`}
          </p>
        </div>
        <p className="mb-6 max-w-xl text-sm leading-relaxed text-muted">
          Add a profile for each child you cook with. The recipe page will
          show kid / grown-up / together task labels appropriate to the
          age, and every dish you cook together gets saved to a running
          journal on their profile page.
        </p>

        {kids.length > 0 && (
          <ul className="mb-8 space-y-3">
            {kids.map((k) => (
              <KidRow
                key={k.id}
                kid={k}
                onUpdate={(patch) => updateKid(k.id, patch)}
                onRemove={() => {
                  if (confirm(`Remove ${k.name}'s profile?`)) {
                    void removeKid(k.id);
                  }
                }}
              />
            ))}
          </ul>
        )}

        <AddKidForm onAdd={addKid} />
      </section>
    </article>
  );
}

function KidRow({
  kid,
  onUpdate,
  onRemove,
}: {
  kid: Kid;
  onUpdate: (patch: Partial<Pick<Kid, 'name' | 'age' | 'avatar_color'>>) => void;
  onRemove: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(kid.name);
  const [age, setAge] = useState(kid.age);
  const [color, setColor] = useState<AvatarColor>(kid.avatar_color);

  if (editing) {
    return (
      <li className="card p-5">
        <div className="space-y-3">
          <div className="flex gap-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="flex-1 rounded-full border border-rule bg-surface px-4 py-2 text-sm"
              placeholder="Name"
            />
            <input
              type="number"
              min={2}
              max={17}
              value={age}
              onChange={(e) => setAge(Math.max(2, Math.min(17, Number(e.target.value))))}
              className="w-20 rounded-full border border-rule bg-surface px-4 py-2 text-sm"
            />
          </div>
          <ColorPicker value={color} onChange={setColor} />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                onUpdate({ name: name.trim(), age, avatar_color: color });
                setEditing(false);
              }}
              className="btn-primary text-sm"
              disabled={!name.trim()}
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                setName(kid.name);
                setAge(kid.age);
                setColor(kid.avatar_color);
                setEditing(false);
              }}
              className="rounded-full border border-rule px-4 py-2 text-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onRemove}
              className="ml-auto rounded-full border border-rule px-4 py-2 text-sm text-muted hover:text-terracotta"
            >
              Remove
            </button>
          </div>
        </div>
      </li>
    );
  }

  return (
    <li className="card flex items-center gap-4 p-5">
      <span className={`h-8 w-8 rounded-full ${COLOR_SWATCH[kid.avatar_color]}`} />
      <div className="flex-1">
        <p className="font-serif text-lg">{kid.name}</p>
        <p className="text-xs text-muted">age {kid.age}</p>
      </div>
      <Link
        to={`/household/kids/${kid.id}`}
        className="rounded-full border border-rule px-4 py-2 text-sm !no-underline hover:border-terracotta/40"
      >
        Journal
      </Link>
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="rounded-full border border-rule px-4 py-2 text-sm hover:border-terracotta/40"
      >
        Edit
      </button>
    </li>
  );
}

function AddKidForm({
  onAdd,
}: {
  onAdd: (input: { name: string; age: number; avatar_color: AvatarColor }) => Promise<Kid | null>;
}) {
  const [name, setName] = useState('');
  const [age, setAge] = useState(7);
  const [color, setColor] = useState<AvatarColor>('sage');
  const [submitting, setSubmitting] = useState(false);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!name.trim()) return;
        setSubmitting(true);
        await onAdd({ name: name.trim(), age, avatar_color: color });
        setName('');
        setAge(7);
        setColor('sage');
        setSubmitting(false);
      }}
      className="card space-y-4 p-5"
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-terracotta">
        Add a kid
      </p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
          className="flex-1 rounded-full border border-rule bg-surface px-4 py-2.5 text-sm"
          aria-label="Kid's name"
        />
        <label className="flex items-center gap-2 text-sm text-muted">
          Age
          <input
            type="number"
            min={2}
            max={17}
            value={age}
            onChange={(e) => setAge(Math.max(2, Math.min(17, Number(e.target.value))))}
            className="w-20 rounded-full border border-rule bg-surface px-4 py-2.5 text-sm text-ink"
          />
        </label>
      </div>
      <ColorPicker value={color} onChange={setColor} />
      <button type="submit" className="btn-primary text-sm" disabled={submitting || !name.trim()}>
        Add profile
      </button>
    </form>
  );
}

function ColorPicker({
  value,
  onChange,
}: {
  value: AvatarColor;
  onChange: (c: AvatarColor) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted">Color</span>
      {AVATAR_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          aria-label={c}
          className={`h-6 w-6 rounded-full ${COLOR_SWATCH[c]} ${
            value === c ? 'ring-2 ring-offset-2 ring-terracotta' : ''
          }`}
        />
      ))}
    </div>
  );
}
