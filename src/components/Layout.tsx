import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useLiturgicalKitchen } from '../lib/preferences';
import { useUser } from '../lib/auth';
import AuthButton from './AuthButton';
import KidModeToggle from './KidModeToggle';
import OnboardingTour from './OnboardingTour';

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [q, setQ] = useState('');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [calendarOn] = useLiturgicalKitchen();
  const user = useUser();

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `rounded-full px-3 py-1.5 !no-underline ${
      isActive ? 'bg-terracotta !text-cream' : '!text-ink hover:!text-terracotta'
    }`;
  const mobileNavClass = ({ isActive }: { isActive: boolean }) =>
    `block rounded-xl px-4 py-3 text-base font-serif !no-underline ${
      isActive ? 'bg-terracotta !text-cream' : '!text-ink hover:bg-paper'
    }`;

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = q.trim();
    if (!trimmed) return;
    navigate(`/search?q=${encodeURIComponent(trimmed)}`);
    setMobileOpen(false);
  }

  const navLinks = (
    className: ({ isActive }: { isActive: boolean }) => string,
  ) => (
    <>
      <NavLink to="/" end className={className}>
        Browse
      </NavLink>
      <NavLink to="/how-to-cook" className={className}>
        How to Cook
      </NavLink>
      {calendarOn && (
        <NavLink to="/calendar" className={className}>
          Calendar
        </NavLink>
      )}
      {user && (
        <>
          <NavLink to="/plan" className={className}>
            Plan
          </NavLink>
          <NavLink to="/shopping" className={className}>
            List
          </NavLink>
          <NavLink to="/cookbook" className={className}>
            Cookbook
          </NavLink>
          <NavLink to="/household" className={className}>
            Household
          </NavLink>
        </>
      )}
      <NavLink to="/editions" className={className}>
        Editions
      </NavLink>
      <NavLink to="/courses" className={className}>
        Courses
      </NavLink>
      <NavLink to="/store" className={className}>
        Store
      </NavLink>
      <NavLink to="/search" className={className}>
        Search
      </NavLink>
      <NavLink to="/about" className={className}>
        About
      </NavLink>
    </>
  );

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-30 border-b border-rule bg-cream/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4">
          <Link to="/" className="group flex items-baseline gap-3 !text-ink no-underline">
            <span className="font-serif text-xl font-bold tracking-tight group-hover:text-terracotta sm:text-2xl">
              Heritage Kitchen
            </span>
            <span className="hidden font-serif text-xs italic text-muted md:inline">
              Ever ancient, ever new.
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-1 text-sm lg:flex">
            {navLinks(navClass)}
            <div className="ml-2 flex items-center gap-2">
              <KidModeToggle />
              <AuthButton />
            </div>
          </nav>

          {/* Mobile auth + hamburger */}
          <div className="flex items-center gap-2 lg:hidden">
            <div className="hidden sm:flex sm:items-center sm:gap-2">
              <KidModeToggle />
              <AuthButton />
            </div>
            <button
              type="button"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label="Open menu"
              aria-expanded={mobileOpen}
              className="rounded-full border border-rule bg-surface p-2"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 text-ink"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="2"
                stroke="currentColor"
              >
                {mobileOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                )}
              </svg>
            </button>
          </div>
        </div>

        <div className="mx-auto max-w-6xl px-4 pb-4">
          <form onSubmit={onSearch} className="flex items-center gap-2">
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search the library…"
              className="w-full rounded-full border border-rule bg-surface px-4 py-2.5 text-sm text-ink placeholder:text-muted focus:border-terracotta focus:outline-none"
              aria-label="Search recipes"
            />
            <button type="submit" className="btn-primary shrink-0">
              Search
            </button>
          </form>
        </div>

        {/* Mobile drawer */}
        {mobileOpen && (
          <nav className="border-t border-rule bg-surface px-4 py-4 lg:hidden">
            <div className="space-y-1">{navLinks(mobileNavClass)}</div>
            <div className="mt-4 flex items-center gap-2 border-t border-rule pt-4 sm:hidden">
              <KidModeToggle />
              <AuthButton />
            </div>
          </nav>
        )}
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:py-10">
        <Outlet />
      </main>

      <footer className="border-t border-rule bg-surface">
        <div className="mx-auto max-w-6xl space-y-4 px-4 py-8 text-xs text-muted">
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-[0.25em] text-terracotta">
              The Heritage project
            </p>
            <p className="max-w-xl leading-relaxed">
              Heritage Kitchen is one of three sites about restoring
              heritage to the next generation. <em>Heritage Skills</em>{' '}
              (coming soon) is for the hands. <em>Heritage Stories</em>{' '}
              (coming soon) is for the voice. This one is for the table.
              All three are free, on the conviction that a generation
              handed nothing but debt needs at least this much back.
            </p>
          </div>
          <p className="font-serif italic">
            &ldquo;Late have I loved you, Beauty so ancient and so new.&rdquo;
            <span className="ml-2 not-italic">
              — Augustine, <em>Confessions</em> X.27
            </span>
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            <NavLink to="/about" className="!no-underline hover:text-terracotta">
              About
            </NavLink>
            <NavLink to="/services" className="!no-underline hover:text-terracotta">
              Commissions
            </NavLink>
            <NavLink to="/friends" className="!no-underline hover:text-terracotta">
              Friends of Heritage Kitchen
            </NavLink>
            <NavLink to="/monasteries" className="!no-underline hover:text-terracotta">
              Monasteries
            </NavLink>
            <NavLink to="/store" className="!no-underline hover:text-terracotta">
              Store
            </NavLink>
            <NavLink to="/almanac" className="!no-underline hover:text-terracotta">
              Almanac
            </NavLink>
            <NavLink to="/licensing" className="!no-underline hover:text-terracotta">
              Licensing
            </NavLink>
            <a href="https://www.gutenberg.org" target="_blank" rel="noreferrer">
              Source texts via Project Gutenberg
            </a>
          </div>
        </div>
      </footer>

      <OnboardingTour />
    </div>
  );
}
