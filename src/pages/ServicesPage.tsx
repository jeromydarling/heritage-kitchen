import { useState } from 'react';
import { supabase } from '../lib/supabase';

type EnquiryKind = 'custom_cookbook' | 'parish_cookbook' | 'research' | 'other';

const SERVICES: Array<{
  kind: EnquiryKind;
  title: string;
  pitch: string;
  deliverable: string;
  range: string;
  cta: string;
}> = [
  {
    kind: 'custom_cookbook',
    title: 'Custom heirloom cookbook',
    pitch:
      "Send us a shoebox of your grandmother's recipe cards, or a stack of loose-leaf pages from your mother's kitchen, or even a spiral notebook of things you have pieced together over the years from phone calls to your aunts. We transcribe, modernize, and typeset the lot in the Heritage Kitchen house style, and we ship you a bound printed book via Lulu that your children can read.",
    deliverable:
      'Hardcover, 60 \u2013 200 pages, typeset in serif and printed on acid-free paper. Two copies in the base package; additional copies at cost.',
    range: '$300 \u2013 $800',
    cta: 'Enquire about a custom cookbook',
  },
  {
    kind: 'parish_cookbook',
    title: 'Parish cookbook',
    pitch:
      "Same service, scaled for a parish fundraiser. We collect community recipes through a simple submission form, lay them out alongside a handful of historical recipes from our library (wherever they make thematic sense), and manage the entire print run through Lulu. The parish sells the finished book as a fundraiser; we charge for layout and print management, not the books themselves.",
    deliverable:
      'A finished PDF plus bulk-print fulfillment. Runs from 50 to several hundred copies. Spiral or perfect-bound. Color or black & white.',
    range: '$500 \u2013 $2,000',
    cta: 'Enquire about a parish cookbook',
  },
  {
    kind: 'research',
    title: 'Historical recipe research',
    pitch:
      'For historical fiction writers, film and TV productions, food magazines, and the occasional museum exhibit: "what would a Brooklyn Irish family eat for Sunday dinner in 1892?" is a question we enjoy answering. We deliver a short brief with primary sources from the cookbook library and whatever contextual notes we can add. Quick turnaround.',
    deliverable:
      'A research brief, 1 \u2013 5 pages, with primary-source citations, optional modernized recipes, and cultural context. Delivered in 3 \u2013 10 business days.',
    range: '$75 \u2013 $300 per query',
    cta: 'Enquire about a research project',
  },
];

/**
 * The Tier 4 services page. Long-form pitch, three services, one
 * contact form that posts into service_enquiries. No self-serve
 * checkout â€” these are all relationship sales.
 */
export default function ServicesPage() {
  const [activeKind, setActiveKind] = useState<EnquiryKind | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [budget, setBudget] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!activeKind) return;
    setBusy(true);
    setStatus(null);
    if (!supabase) {
      setStatus(
        "This site isn't configured to accept enquiries. Please email friends@heritagekitchen.app directly.",
      );
      setBusy(false);
      return;
    }
    const { error } = await supabase.from('service_enquiries').insert({
      kind: activeKind,
      name,
      email,
      subject: SERVICES.find((s) => s.kind === activeKind)?.title ?? null,
      message,
      budget_range: budget || null,
    });
    setBusy(false);
    if (error) {
      setStatus(
        "Couldn't send that. Please email friends@heritagekitchen.app directly.",
      );
      return;
    }
    setStatus(
      "Thank you. We'll get back to you within a few days â€” usually sooner.",
    );
    setName('');
    setEmail('');
    setMessage('');
    setBudget('');
    setActiveKind(null);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-12">
      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-terracotta">
          By commission
        </p>
        <h1 className="mt-1 font-serif text-4xl sm:text-5xl">Services</h1>
        <p className="mt-4 text-lg leading-relaxed text-muted">
          Alongside the free library, we take on a small number of
          commissioned projects each year: custom cookbooks assembled
          from a family's own recipes, parish cookbook fundraisers, and
          historical recipe research for writers and filmmakers. These
          are slow, careful, and booked one at a time.
        </p>
      </header>

      <ul className="space-y-10">
        {SERVICES.map((s) => (
          <li key={s.kind} className="border-t border-rule pt-8">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-serif text-2xl leading-tight">{s.title}</h2>
              <p className="font-serif text-lg text-terracotta">{s.range}</p>
            </div>
            <p className="mt-4 leading-relaxed text-ink/90">{s.pitch}</p>
            <p className="mt-3 text-sm text-muted">
              <strong className="font-serif text-ink">Deliverable:</strong>{' '}
              {s.deliverable}
            </p>
            <button
              type="button"
              onClick={() => setActiveKind(s.kind)}
              className="btn mt-5"
            >
              {s.cta}
            </button>
          </li>
        ))}
      </ul>

      {activeKind && (
        <section className="card p-6 sm:p-8">
          <h2 className="font-serif text-2xl">
            {SERVICES.find((s) => s.kind === activeKind)?.title}
          </h2>
          <p className="mt-1 text-sm text-muted">
            Tell us a little about what you have in mind. We read every
            enquiry and reply within a few days.
          </p>
          <form onSubmit={submit} className="mt-5 space-y-3">
            <label className="block text-sm">
              <span className="text-muted">Your name</span>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-full border border-rule bg-cream px-4 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="text-muted">Email</span>
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-full border border-rule bg-cream px-4 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="text-muted">Budget (optional)</span>
              <input
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder="e.g. $500, or just 'flexible'"
                className="mt-1 w-full rounded-full border border-rule bg-cream px-4 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="text-muted">What are you thinking about?</span>
              <textarea
                required
                rows={6}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="mt-1 w-full rounded-2xl border border-rule bg-cream p-3"
              />
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setActiveKind(null)}
                className="btn flex-1 justify-center"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="btn-primary flex-1 justify-center"
              >
                {busy ? 'Sendingâ€¦' : 'Send enquiry'}
              </button>
            </div>
          </form>
          {status && (
            <p className="mt-4 rounded-xl bg-paper px-4 py-2 text-sm text-muted">
              {status}
            </p>
          )}
        </section>
      )}

      <section className="card bg-paper p-6 text-sm leading-relaxed text-muted">
        <p>
          Prefer to write direct?{' '}
          <a href="mailto:commissions@heritagekitchen.app">
            commissions@heritagekitchen.app
          </a>
          . We answer every note.
        </p>
      </section>
    </div>
  );
}
