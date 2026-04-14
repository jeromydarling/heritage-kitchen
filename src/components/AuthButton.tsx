import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  authAvailable,
  signInWithGoogle,
  signOut,
  useUser,
  signInWithEmail,
  signUpWithEmail,
} from '../lib/auth';

/**
 * Header sign-in/profile widget. Shows a "Sign in" button when signed out,
 * and a small menu with a link to the user's cookbook + a sign-out action
 * when signed in. If Supabase isn't configured in this build, the widget
 * disappears entirely.
 */
export default function AuthButton() {
  const user = useUser();
  const [openMenu, setOpenMenu] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  if (!authAvailable) return null;

  if (!user) {
    return (
      <>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="rounded-full border border-rule bg-surface px-3 py-1.5 text-sm !text-ink hover:!text-terracotta hover:border-terracotta"
        >
          Sign in
        </button>
        {modalOpen && <SignInModal onClose={() => setModalOpen(false)} />}
      </>
    );
  }

  const initial = (user.user_metadata?.full_name ?? user.email ?? '?')[0].toUpperCase();

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpenMenu((v) => !v)}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-terracotta text-sm font-semibold text-cream"
        aria-label="Account menu"
      >
        {initial}
      </button>
      {openMenu && (
        <div
          className="absolute right-0 z-20 mt-2 w-56 rounded-2xl border border-rule bg-surface p-2 shadow-card"
          onMouseLeave={() => setOpenMenu(false)}
        >
          <p className="truncate px-3 py-2 text-xs text-muted">
            {user.email ?? user.user_metadata?.full_name ?? 'Signed in'}
          </p>
          <Link
            to="/cookbook"
            onClick={() => setOpenMenu(false)}
            className="block rounded-xl px-3 py-2 text-sm !text-ink !no-underline hover:bg-paper"
          >
            My Cookbook
          </Link>
          <button
            type="button"
            onClick={() => {
              void signOut();
              setOpenMenu(false);
            }}
            className="block w-full rounded-xl px-3 py-2 text-left text-sm text-ink hover:bg-paper"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

function SignInModal({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      if (mode === 'signin') await signInWithEmail(email, password);
      else await signUpWithEmail(email, password);
      onClose();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-3xl border border-rule bg-surface p-8 shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-terracotta">
              Heritage Kitchen
            </p>
            <h2 className="mt-1 font-serif text-2xl">
              {mode === 'signin' ? 'Welcome back' : 'Make it yours'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-muted hover:text-ink"
          >
            &times;
          </button>
        </div>
        <p className="mt-2 text-sm text-muted">
          Save recipes, keep private notes, and watch a year of your
          cooking build up one feast at a time.
        </p>

        <button
          type="button"
          onClick={() => void signInWithGoogle()}
          className="mt-6 flex w-full items-center justify-center gap-3 rounded-full border border-rule bg-surface px-4 py-2.5 text-sm font-medium text-ink hover:border-terracotta hover:text-terracotta"
        >
          <GoogleGlyph />
          Continue with Google
        </button>

        <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-widest text-muted">
          <span className="h-px flex-1 bg-rule" />
          or
          <span className="h-px flex-1 bg-rule" />
        </div>

        <form onSubmit={onEmailSubmit} className="space-y-3">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-full border border-rule bg-surface px-4 py-2.5 text-sm"
          />
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full rounded-full border border-rule bg-surface px-4 py-2.5 text-sm"
          />
          {err && <p className="text-xs text-terracotta">{err}</p>}
          <button type="submit" disabled={busy} className="btn-primary w-full justify-center">
            {busy ? 'Workingâ€¦' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>
        <p className="mt-4 text-center text-xs text-muted">
          {mode === 'signin' ? (
            <>
              New here?{' '}
              <button
                type="button"
                className="!text-terracotta"
                onClick={() => setMode('signup')}
              >
                Create an account
              </button>
            </>
          ) : (
            <>
              Already have one?{' '}
              <button
                type="button"
                className="!text-terracotta"
                onClick={() => setMode('signin')}
              >
                Sign in
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}

function GoogleGlyph() {
  return (
    <svg viewBox="0 0 48 48" className="h-4 w-4" aria-hidden>
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
      <path fill="none" d="M0 0h48v48H0z" />
    </svg>
  );
}
