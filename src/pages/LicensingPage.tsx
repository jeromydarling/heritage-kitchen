import { useState } from 'react';
import { supabase } from '../lib/supabase';

interface Tier {
  name: string;
  price: string;
  audience: string;
  what: string;
  detail: string;
}

const TIERS: Tier[] = [
  {
    name: 'Research access',
    price: 'Free',
    audience: 'Academics, students, non-commercial researchers',
    what:
      'Full, unrestricted access to the structured recipe dataset as a JSON download. Cite Heritage Kitchen and you\u2019re done.',
    detail:
      'Download heritage_kitchen_recipes.json from the repository. We just ask that a footnote credits Heritage Kitchen and the underlying Gutenberg sources.',
  },
  {
    name: 'Editorial license',
    price: '$500 / year',
    audience: 'Newspapers, magazines, newsletters, public media',
    what:
      'Reprint our modernized recipes in your publication with attribution. Use as many as you like, in print or online, for the length of the license.',
    detail:
      'Best for outlets that run regular food coverage and want to quote from the archive with confidence. One email, one invoice, one year.',
  },
  {
    name: 'Commercial license',
    price: '$5,000 / year',
    audience: 'Food-tech platforms, cookbook publishers, consumer apps',
    what:
      'API access, structured data feed, the right to display and adapt our modernized recipes inside a commercial product. Includes a direct channel to us for data questions.',
    detail:
      'We talk to every commercial licensee before signing. Some products we are excited to work with; others we decline. We reserve that judgment.',
  },
];

export default function LicensingPage() {
  const [activeTier, setActiveTier] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatus(null);
    if (!supabase) {
      setStatus(
        "This site isn't configured for enquiries. Please email licensing@heritagekitchen.app directly.",
      );
      setBusy(false);
      return;
    }
    const { error } = await supabase.from('service_enquiries').insert({
      kind: 'licensing',
      name,
      email,
      subject: activeTier ? `Licensing enquiry: ${activeTier}` : 'Licensing enquiry',
      message,
    });
    setBusy(false);
    if (error) {
      setStatus(
        "Couldn't send that. Please email licensing@heritagekitchen.app directly.",
      );
      return;
    }
    setStatus("Thank you. We'll be in touch within a few days.");
    setName('');
    setEmail('');
    setMessage('');
    setActiveTier(null);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-12">
      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-terracotta">
          The dataset
        </p>
        <h1 className="mt-1 font-serif text-4xl sm:text-5xl">
          Licensing &amp; data access
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-muted">
          The heart of Heritage Kitchen is a structured dataset of
          3,485 American cookbook recipes from 1869&ndash;1917, each
          one transcribed from its original and given a modernized
          rewrite we did ourselves. The original texts are public
          domain. The modernizations are ours. Here is how you can
          use them.
        </p>
      </header>

      <ul className="space-y-10">
        {TIERS.map((t) => (
          <li key={t.name} className="border-t border-rule pt-8">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-serif text-2xl leading-tight">{t.name}</h2>
              <p className="font-serif text-lg text-terracotta">{t.price}</p>
            </div>
            <p className="mt-1 text-sm italic text-muted">{t.audience}</p>
            <p className="mt-4 leading-relaxed text-ink/90">{t.what}</p>
            <p className="mt-2 text-sm text-muted">{t.detail}</p>
            {t.price !== 'Free' && (
              <button
                type="button"
                onClick={() => setActiveTier(t.name)}
                className="btn mt-5"
              >
                Enquire about {t.name.toLowerCase()}
              </button>
            )}
          </li>
        ))}
      </ul>

      {activeTier && (
        <section className="card p-6 sm:p-8">
          <h2 className="font-serif text-2xl">{activeTier}</h2>
          <p className="mt-1 text-sm text-muted">
            Tell us a little about your use case and we&rsquo;ll reply
            within a few days.
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
              <span className="text-muted">What are you working on?</span>
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
                onClick={() => setActiveTier(null)}
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
          A note on attribution: the original 19th-century cookbook
          texts in our library are in the public domain via{' '}
          <a href="https://www.gutenberg.org" target="_blank" rel="noreferrer">
            Project Gutenberg
          </a>
          , and you&rsquo;re free to use them under Gutenberg&rsquo;s
          standard terms. The modernized recipes, essay classifications,
          and liturgical pairings are our editorial work, and those are
          what the commercial and editorial licenses cover.
        </p>
      </section>
    </div>
  );
}
