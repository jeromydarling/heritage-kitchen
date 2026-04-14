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
        <p className="text-[10px] uppercase tracking-[0.25em] text-terracotta">
          Part of the Heritage project
        </p>
        <h1 className="mt-1 font-serif text-4xl">About Heritage Kitchen</h1>
        <p className="mt-3 font-serif text-lg italic text-muted">
          &ldquo;Late have I loved you, Beauty so ancient and so new.&rdquo;
          <span className="ml-2 not-italic">— Augustine, <em>Confessions</em> X.27</span>
        </p>
      </header>

      <section className="space-y-4 text-base leading-relaxed">
        <h2 className="font-serif text-2xl">Why Heritage</h2>
        <p>
          There is a widespread malaise in the generation coming up, and
          most of us are at least privately honest about it: they were
          handed almost nothing. Their parents, well-meaning or otherwise,
          passed down debt &mdash; financial debt in some cases, cultural
          debt in almost every case. No skills. No stories. No legends.
          No rituals. No traditions. No heritage. The one thing every
          human society before ours knew how to do &mdash; hand the useful
          and beautiful parts of itself to its children &mdash; we largely
          stopped doing, in perhaps two generations.
        </p>
        <p>
          Heritage Kitchen is a small act against that. It is one of three
          sites in a project we&rsquo;re building around a single idea:
          that restoring heritage to the next generation is not
          nostalgia, it is the most practical thing you can do in a life.
          The other two, <em>Heritage Skills</em> and <em>Heritage
          Stories</em>, will pick up the hands and the voice the way this
          one picks up the table. All three are free. All three are
          serious. All three assume that old things can be good and new
          things can be good and that the job of a grown-up is to tell the
          difference and pass the good ones down.
        </p>
        <p>
          In this particular kitchen: American cookbooks from 1869&ndash;1917,
          plain working books written by women who were feeding houses
          full of people without microwaves, air fryers, or Google,
          presented the way they were written with a modern adaptation
          beside each one so you can actually cook from them. One hundred
          and fifty-eight lessons on <Link to="/how-to-cook">how to cook</Link>{' '}
          drawn from the home-economics textbooks of the same era, each
          with an explicit split between what the 1900s got right and what
          we know better now. A liturgical calendar to cook them by. And a
          small <Link to="/editions">bookshelf</Link> of editorial
          cookbooks assembled from the library, printed to order and
          shipped worldwide.
        </p>
        <p>
          The project sides with Augustine: the old is not stale, because
          real beauty is <em>ever ancient and ever new</em>. Every
          generation meets it again for the first time. The kitchen is
          where we start.
        </p>
      </section>

      <section className="space-y-4 text-base leading-relaxed">
        <h2 className="font-serif text-2xl">And it&rsquo;s a liturgical kitchen</h2>
        <p>
          The Christian year has always shaped how Catholic and Orthodox
          families cook &mdash; fasting in Lent, feasting at Easter, quiet
          Advent suppers before the Christmas table bursts open. Our{' '}
          <Link to="/calendar">calendar</Link> surfaces recipes and
          lessons from the library that match the mood of the day, so you
          can cook with the Church year the way your great-grandmother
          did, without having to know the whole calendar by heart. If
          you&rsquo;re not religious, it is still the oldest farming
          calendar most of us have access to, and cooking by it is what
          every &ldquo;eat the seasons&rdquo; argument is trying to
          rediscover.
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
