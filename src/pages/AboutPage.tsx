import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { SOURCE_BOOKS, type Recipe } from '../lib/types';
import { loadEssays } from '../lib/recipes';

export default function AboutPage() {
  const [essays, setEssays] = useState<Recipe[]>([]);

  useEffect(() => {
    loadEssays().then((all) =>
      setEssays([...all].sort((a, b) => a.title.localeCompare(b.title))),
    );
  }, []);

  return (
    <div className="mx-auto max-w-2xl space-y-10">
      <header>
        <h1 className="font-serif text-4xl">About Heritage Kitchen</h1>
        <p className="mt-3 font-serif text-lg italic text-muted">
          &ldquo;Late have I loved you, Beauty so ancient and so new.&rdquo;
          <span className="ml-2 not-italic">— Augustine, <em>Confessions</em> X.27</span>
        </p>
      </header>

      <section className="space-y-4 text-base leading-relaxed">
        <p>
          Modernity carries a quiet assumption into every room of the house: that
          whatever is new is an improvement, and whatever is old is, at best,
          charmingly outdated. In most rooms this is just a nuisance. In the
          kitchen it has cost us something real &mdash; a whole inheritance of
          technique, patience, and unfussy confidence with food, handed down for
          centuries and largely dropped in a single generation.
        </p>
        <p>
          Heritage Kitchen is a small protest against that amnesia. We take
          American cookbooks from 1869&ndash;1917 &mdash; plain, working books written
          by women who were feeding houses full of people without microwaves,
          air fryers, or Google &mdash; and present them the way they were
          written, with a modern adaptation beside each one so you can
          actually cook from them. The project sides with Augustine: the old
          is not stale, because real beauty is <em>ever ancient and ever
          new</em>. Every generation meets it again for the first time.
        </p>
        <p>
          The site is also a liturgical kitchen. The Christian year has always
          shaped how Catholic and Orthodox families cook &mdash; fasting in Lent,
          feasting at Easter, quiet Advent suppers before the Christmas table
          bursts open. We surface recipes from the library that match the
          mood of the day, so you can cook with the Church year the way your
          great-grandmother did, without having to know the whole calendar
          by heart.
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

      {essays.length > 0 && (
        <section>
          <h2 className="font-serif text-2xl">Historical essays</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Not every entry in these cookbooks is a recipe. Some are short essays on an
            ingredient, a technique, or the science of the kitchen — little detours from the main
            business of dinner. We surface these alongside related recipes, and here they all are
            in one list.
          </p>
          <ul className="mt-5 grid gap-x-6 gap-y-2 sm:grid-cols-2">
            {essays.map((e) => (
              <li key={e.id} className="text-sm">
                <Link to={`/essay/${e.id}`}>{e.title}</Link>
                <span className="ml-2 text-xs text-muted">· {e.source_year}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

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
