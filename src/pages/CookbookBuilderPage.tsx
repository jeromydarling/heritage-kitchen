import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authAvailable, useUser } from '../lib/auth';
import { useCookbook } from '../lib/userData';
import { loadAllForIds } from '../lib/recipes';
import type { Recipe } from '../lib/types';
import { supabase } from '../lib/supabase';
import {
  uploadInteriorPdf,
  requestLuluQuote,
  createStripeCheckoutForOrder,
  type ShippingAddress,
  type LuluQuote,
} from '../lib/lulu';

/**
 * Lets a signed-in user turn their saved recipes into a printable cookbook.
 * Flow:
 *   1. Pick recipes, enter title/subtitle/dedication, save as draft.
 *   2. Open the order flow, fill in shipping address.
 *   3. "Get price" generates the PDF, uploads it, calls the quote edge function.
 *   4. "Pay and order" creates a Stripe Checkout session and redirects.
 *   5. Stripe webhook creates the real Lulu print-job on successful payment.
 */
export default function CookbookBuilderPage() {
  const user = useUser();
  const { entries } = useCookbook();
  const navigate = useNavigate();

  const [savedRecipes, setSavedRecipes] = useState<Recipe[]>([]);
  const [title, setTitle] = useState('Our Heritage Kitchen');
  const [subtitle, setSubtitle] = useState('');
  const [dedication, setDedication] = useState('For our family, past and present.');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<'pick' | 'order'>('pick');
  const [projectId, setProjectId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (entries.length === 0) {
        setSavedRecipes([]);
        return;
      }
      const list = await loadAllForIds(entries.map((e) => e.recipe_id));
      setSavedRecipes(list);
      setPicked(new Set(list.map((r) => r.id)));
    }
    void load();
  }, [entries]);

  const pickedList = useMemo(
    () => savedRecipes.filter((r) => picked.has(r.id)),
    [savedRecipes, picked],
  );

  function togglePick(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Lulu rejects hardcover print jobs under 24 pages of interior. With
  // our front matter (title, copyright, foreword, TOC) plus back matter
  // (index, bibliography, about, colophon) we fill ~10 pages without any
  // recipes; a real cookbook needs at least about 6 recipes for the page
  // count to clear that floor reliably. We require 6 here so the buyer
  // sees a friendly message instead of a Lulu rejection after payment.
  const MIN_RECIPES = 6;

  async function saveDraftAndContinueToOrder() {
    if (!user || !supabase || pickedList.length < MIN_RECIPES) return;
    setSaving(true);
    const { data, error } = await supabase
      .from('cookbook_projects')
      .insert({
        user_id: user.id,
        title,
        subtitle: subtitle || null,
        dedication: dedication || null,
        recipe_ids: pickedList.map((r) => r.id),
      })
      .select('id')
      .single();
    setSaving(false);
    if (error || !data) return;
    setProjectId(data.id);
    setStep('order');
  }

  async function previewOnly() {
    if (!user || !supabase || pickedList.length === 0) return;
    // Preview is allowed at any count -- only the print order is gated.
    // Intentionally no MIN_RECIPES check here.

    setSaving(true);
    const { data, error } = await supabase
      .from('cookbook_projects')
      .insert({
        user_id: user.id,
        title,
        subtitle: subtitle || null,
        dedication: dedication || null,
        recipe_ids: pickedList.map((r) => r.id),
      })
      .select('id')
      .single();
    setSaving(false);
    if (error || !data) return;
    navigate(`/print/cookbook/${data.id}`);
  }

  if (!authAvailable || !user) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="font-serif text-3xl">Build a printable cookbook</h1>
        <p className="mt-3 text-muted">
          Sign in to turn your saved recipes into a printable family
          cookbook you can order directly from the site.
        </p>
      </div>
    );
  }

  if (step === 'order' && projectId) {
    return (
      <OrderFlow
        projectId={projectId}
        project={{
          title,
          subtitle: subtitle || null,
          dedication: dedication || null,
          recipes: pickedList,
        }}
        userId={user.id}
        defaultEmail={user.email ?? ''}
        onBack={() => setStep('pick')}
      />
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-terracotta">
          Heirloom in progress
        </p>
        <h1 className="mt-1 font-serif text-4xl">Build a printable cookbook</h1>
        <p className="mt-3 text-lg leading-relaxed text-muted">
          Turn the recipes you've saved into a real cookbook. We'll lay it
          out in our house typography and print it for you with hardcover
          or softcover binding. Shipping anywhere Lulu prints is usually
          about a week.
        </p>
      </header>

      <section className="card space-y-4 p-6">
        <h2 className="font-serif text-xl">Title page</h2>
        <label className="block text-sm">
          <span className="text-muted">Title</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full rounded-full border border-rule bg-cream px-4 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="text-muted">Subtitle (optional)</span>
          <input
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            placeholder="e.g. Recipes for the Darling family"
            className="mt-1 w-full rounded-full border border-rule bg-cream px-4 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="text-muted">Dedication (optional)</span>
          <textarea
            rows={3}
            value={dedication}
            onChange={(e) => setDedication(e.target.value)}
            className="mt-1 w-full rounded-2xl border border-rule bg-cream p-3"
          />
        </label>
      </section>

      <section>
        <h2 className="font-serif text-xl">
          Recipes ({pickedList.length}/{savedRecipes.length})
        </h2>
        {savedRecipes.length === 0 ? (
          <p className="mt-3 text-muted">
            You haven't saved any recipes yet. Find a few you love and{' '}
            <Link to="/">browse the library</Link>.
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {savedRecipes.map((r) => (
              <li key={r.id}>
                <label className="flex cursor-pointer items-start gap-3 rounded-xl px-3 py-2 hover:bg-paper">
                  <input
                    type="checkbox"
                    checked={picked.has(r.id)}
                    onChange={() => togglePick(r.id)}
                    className="mt-1 h-4 w-4 rounded border-rule text-terracotta"
                  />
                  <span className="flex-1">
                    <span className="font-serif text-base">{r.title}</span>
                    <span className="block text-xs text-muted">
                      {r.source_book} Â· {r.source_year}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={pickedList.length < MIN_RECIPES || saving}
          onClick={() => void saveDraftAndContinueToOrder()}
          className="btn-primary"
        >
          {saving ? 'Savingâ€¦' : 'Order a printed copy â†’'}
        </button>
        <button
          type="button"
          disabled={pickedList.length === 0 || saving}
          onClick={() => void previewOnly()}
          className="btn"
        >
          Preview in the browser
        </button>
        {pickedList.length < MIN_RECIPES && (
          <p className="text-xs text-muted">
            Add at least {MIN_RECIPES} recipes to order a printed copy.
            You currently have {pickedList.length}.
          </p>
        )}
      </section>

      <section className="card space-y-3 bg-paper p-6 text-sm leading-relaxed text-muted">
        <h2 className="font-serif text-lg text-ink">About printed copies</h2>
        <p>
          Your cookbook is printed and shipped by{' '}
          <a href="https://www.lulu.com" target="_blank" rel="noreferrer">
            Lulu
          </a>
          's print-on-demand service. Payment is handled securely through
          Stripe; no card information ever touches our site. Orders usually
          ship within about a week.
        </p>
      </section>
    </div>
  );
}

// -------- Order flow --------

interface OrderFlowProps {
  projectId: string;
  project: {
    title: string;
    subtitle: string | null;
    dedication: string | null;
    recipes: Recipe[];
  };
  userId: string;
  defaultEmail: string;
  onBack: () => void;
}

function OrderFlow({ projectId, project, userId, defaultEmail, onBack }: OrderFlowProps) {
  const [addr, setAddr] = useState<ShippingAddress>({
    name: '',
    street1: '',
    street2: '',
    city: '',
    state_code: '',
    postcode: '',
    country_code: 'US',
    phone_number: '',
    email: defaultEmail,
  });
  const [quote, setQuote] = useState<LuluQuote | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [step, setStep] = useState<'address' | 'quote' | 'checkout'>('address');

  async function getQuote() {
    setBusy(true);
    setErr(null);
    try {
      // 1. Generate + upload the PDF
      await uploadInteriorPdf(projectId, userId, project);
      // 2. Ask Lulu for a quote
      const q = await requestLuluQuote(projectId, addr);
      setQuote(q);
      setStep('quote');
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function goToCheckout() {
    if (!quote) return;
    setBusy(true);
    setErr(null);
    try {
      const { url } = await createStripeCheckoutForOrder(projectId, quote, addr);
      window.location.href = url;
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-8">
      <header>
        <button onClick={onBack} className="text-xs text-muted hover:text-terracotta">
          â† Back to builder
        </button>
        <h1 className="mt-2 font-serif text-3xl">Order your printed cookbook</h1>
        <p className="mt-2 text-sm text-muted">
          Ships worldwide via Lulu. Payment is processed by Stripe.
        </p>
      </header>

      <section className="card space-y-3 p-5 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted">Title</span>
          <span className="font-serif">{project.title}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted">Recipes</span>
          <span>{project.recipes.length}</span>
        </div>
      </section>

      {step === 'address' && (
        <section className="card space-y-3 p-5">
          <h2 className="font-serif text-lg">Shipping address</h2>
          <AddressFields addr={addr} setAddr={setAddr} />
          {err && <p className="text-sm text-terracotta">{err}</p>}
          <button
            type="button"
            onClick={() => void getQuote()}
            disabled={busy || !addr.name || !addr.street1 || !addr.city || !addr.postcode}
            className="btn-primary w-full justify-center"
          >
            {busy ? 'Generating your PDF and quotingâ€¦' : 'Get price'}
          </button>
        </section>
      )}

      {step === 'quote' && quote && (
        <section className="card space-y-4 p-5">
          <h2 className="font-serif text-lg">Your quote</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex items-baseline justify-between">
              <dt className="text-muted">Page count</dt>
              <dd>{quote.page_count}</dd>
            </div>
            <div className="flex items-baseline justify-between">
              <dt className="text-muted">Printing &amp; shipping</dt>
              <dd>${quote.lulu_cost}</dd>
            </div>
            <div className="flex items-baseline justify-between">
              <dt className="text-muted">Heritage Kitchen</dt>
              <dd>${quote.markup}</dd>
            </div>
            <div className="mt-3 flex items-baseline justify-between border-t border-rule pt-3 text-lg font-serif">
              <dt>Total</dt>
              <dd>
                ${quote.customer_total} {quote.currency}
              </dd>
            </div>
          </dl>
          {err && <p className="text-sm text-terracotta">{err}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep('address')}
              className="btn flex-1 justify-center"
            >
              Edit address
            </button>
            <button
              type="button"
              onClick={() => void goToCheckout()}
              disabled={busy}
              className="btn-primary flex-1 justify-center"
            >
              {busy ? 'Redirectingâ€¦' : 'Pay and order â†’'}
            </button>
          </div>
          <p className="text-center text-xs text-muted">
            You'll be taken to Stripe to complete payment.
          </p>
        </section>
      )}
    </div>
  );
}

function AddressFields({
  addr,
  setAddr,
}: {
  addr: ShippingAddress;
  setAddr: (a: ShippingAddress) => void;
}) {
  function field<K extends keyof ShippingAddress>(key: K) {
    return (v: string) => setAddr({ ...addr, [key]: v });
  }
  const cls = 'w-full rounded-xl border border-rule bg-cream px-3 py-2 text-sm';
  return (
    <div className="space-y-2">
      <input
        placeholder="Full name"
        value={addr.name}
        onChange={(e) => field('name')(e.target.value)}
        className={cls}
      />
      <input
        placeholder="Email"
        type="email"
        value={addr.email}
        onChange={(e) => field('email')(e.target.value)}
        className={cls}
      />
      <input
        placeholder="Phone"
        value={addr.phone_number}
        onChange={(e) => field('phone_number')(e.target.value)}
        className={cls}
      />
      <input
        placeholder="Street address"
        value={addr.street1}
        onChange={(e) => field('street1')(e.target.value)}
        className={cls}
      />
      <input
        placeholder="Apt, suite, etc. (optional)"
        value={addr.street2 ?? ''}
        onChange={(e) => field('street2')(e.target.value)}
        className={cls}
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          placeholder="City"
          value={addr.city}
          onChange={(e) => field('city')(e.target.value)}
          className={cls}
        />
        <input
          placeholder="State / region"
          value={addr.state_code}
          onChange={(e) => field('state_code')(e.target.value)}
          className={cls}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input
          placeholder="ZIP / postcode"
          value={addr.postcode}
          onChange={(e) => field('postcode')(e.target.value)}
          className={cls}
        />
        <select
          value={addr.country_code}
          onChange={(e) => field('country_code')(e.target.value)}
          className={cls}
        >
          <option value="US">United States</option>
          <option value="CA">Canada</option>
          <option value="GB">United Kingdom</option>
          <option value="AU">Australia</option>
          <option value="DE">Germany</option>
          <option value="FR">France</option>
          <option value="IT">Italy</option>
          <option value="ES">Spain</option>
        </select>
      </div>
    </div>
  );
}
