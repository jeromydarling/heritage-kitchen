import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useLiturgicalKitchen } from '../lib/preferences';
import { useUser } from '../lib/auth';
import AuthButton from './AuthButton';

export default function Layout() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [calendarOn] = useLiturgicalKitchen();
  const user = useUser();
  const navClass = ({ isActive }: { isActive: boolean }) =>
    `rounded-full px-3 py-1.5 !no-underline ${
      isActive ? 'bg-terracotta !text-cream' : '!text-ink hover:!text-terracotta'
    }`;

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = q.trim();
    if (!trimmed) return;
    navigate(`/search?q=${encodeURIComponent(trimmed)}`);
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-rule bg-cream/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <Link to="/" className="group flex items-baseline gap-3 !text-ink no-underline">
            <span className="font-serif text-2xl font-bold tracking-tight group-hover:text-terracotta">
              Heritage Kitchen
            </span>
            <span className="hidden font-serif text-xs italic text-muted sm:inline">
              Ever ancient, ever new.
            </span>
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `rounded-full px-3 py-1.5 !no-underline ${
                  isActive ? 'bg-terracotta !text-cream' : '!text-ink hover:!text-terracotta'
                }`
              }
            >
              Browse
            </NavLink>
            {calendarOn && (
              <NavLink to="/calendar" className={navClass}>
                Calendar
              </NavLink>
            )}
            {user && (
              <>
                <NavLink to="/plan" className={navClass}>
                  Plan
                </NavLink>
                <NavLink to="/shopping" className={navClass}>
                  List
                </NavLink>
              </>
            )}
            <NavLink
              to="/search"
              className={({ isActive }) =>
                `rounded-full px-3 py-1.5 !no-underline ${
                  isActive ? 'bg-terracotta !text-cream' : '!text-ink hover:!text-terracotta'
                }`
              }
            >
              Search
            </NavLink>
            <NavLink
              to="/about"
              className={({ isActive }) =>
                `rounded-full px-3 py-1.5 !no-underline ${
                  isActive ? 'bg-terracotta !text-cream' : '!text-ink hover:!text-terracotta'
                }`
              }
            >
              About
            </NavLink>
            <div className="ml-2">
              <AuthButton />
            </div>
          </nav>
        </div>
        <div className="mx-auto max-w-6xl px-4 pb-4 sm:pb-5">
          <form onSubmit={onSearch} className="flex items-center gap-2">
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search the library — e.g. gingerbread, tomatoes, Fannie Farmer…"
              className="w-full rounded-full border border-rule bg-surface px-4 py-2.5 text-sm text-ink placeholder:text-muted focus:border-terracotta focus:outline-none"
              aria-label="Search recipes"
            />
            <button type="submit" className="btn-primary">
              Search
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:py-12">
        <Outlet />
      </main>

      <footer className="border-t border-rule bg-surface">
        <div className="mx-auto max-w-6xl space-y-2 px-4 py-8 text-xs text-muted sm:flex sm:items-center sm:justify-between sm:space-y-0">
          <p className="font-serif italic">
            &ldquo;Late have I loved you, Beauty so ancient and so new.&rdquo;
            <span className="ml-2 not-italic">— Augustine, <em>Confessions</em> X.27</span>
          </p>
          <p>
            Source texts via{' '}
            <a href="https://www.gutenberg.org" target="_blank" rel="noreferrer">
              Project Gutenberg
            </a>
            .
          </p>
        </div>
      </footer>
    </div>
  );
}
