import { SOURCE_BOOKS } from '../lib/types';

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-10">
      <header>
        <h1 className="font-serif text-4xl">About Heritage Kitchen</h1>
        <p className="mt-3 text-lg text-muted">
          A small recipe blog for families who want to cook the old food, together.
        </p>
      </header>

      <section className="space-y-4 text-base leading-relaxed">
        <p>
          Heritage Kitchen draws from five classic American cookbooks published between 1869 and
          1917 — 3,485 recipes in all, every one of them in the public domain. For each recipe we
          show two things side by side: the cook's original words, preserved as written, and a
          modern adaptation you can actually follow in a present-day kitchen.
        </p>
        <p>
          The original text is there so you can hear the voice of the person who wrote it — Fannie
          Farmer, Miss Parloa, Mrs. Lincoln — and see how much (and how little) has changed about
          home cooking in a hundred and thirty years. The modern version is there so dinner
          actually happens.
        </p>
      </section>

      <section>
        <h2 className="font-serif text-2xl">The books</h2>
        <ul className="mt-4 space-y-4">
          {SOURCE_BOOKS.map((b) => (
            <li key={b.title} className="card p-5">
              <p className="font-serif text-lg">{b.title}</p>
              <p className="text-sm text-muted">
                {b.author} · {b.year}
              </p>
              <a
                href={b.gutenberg}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block text-sm"
              >
                Read the original on Project Gutenberg ↗
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3 text-sm text-muted">
        <h2 className="font-serif text-2xl text-ink">A note on the public domain</h2>
        <p>
          Every recipe on this site is drawn from a book whose copyright has expired in the United
          States. We owe an enormous debt to{' '}
          <a href="https://www.gutenberg.org" target="_blank" rel="noreferrer">
            Project Gutenberg
          </a>
          , the volunteer effort that digitized these texts and keeps them free for anyone to
          read, remix, and cook from.
        </p>
        <p>
          The modern adaptations, the illustrations, and the history notes are our own
          contribution, created specifically for this project.
        </p>
      </section>
    </div>
  );
}
