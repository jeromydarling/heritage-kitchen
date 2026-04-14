import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from './supabase';

/**
 * Thin auth layer on top of Supabase. Exposes:
 *   - `useUser()` â€” React hook returning the current signed-in user (or null)
 *   - `signInWithGoogle()` â€” kicks off the OAuth flow
 *   - `signOut()`
 *
 * When Supabase is not configured at build time (no VITE_SUPABASE_URL), the
 * module silently degrades to a "nobody is ever signed in" state so the
 * read-only fallback mode keeps working without auth-UI crashes.
 *
 * HashRouter note: Supabase's client parses the OAuth token fragment at
 * module load (detectSessionInUrl defaults to true) and then strips it from
 * the URL with history.replaceState, so the React router never sees the
 * tokens. That is why `supabase.ts` creates the client eagerly and this
 * module imports it before React mounts.
 */

const listeners = new Set<(u: User | null) => void>();
let currentUser: User | null = null;
let initialized = false;

async function init() {
  if (initialized || !isSupabaseConfigured || !supabase) {
    initialized = true;
    return;
  }
  initialized = true;
  const { data } = await supabase.auth.getSession();
  currentUser = data.session?.user ?? null;
  for (const cb of listeners) cb(currentUser);

  supabase.auth.onAuthStateChange((_event, session) => {
    currentUser = session?.user ?? null;
    for (const cb of listeners) cb(currentUser);
  });
}

// Fire the init immediately on module load; React components don't need to
// wait on it because the hook re-syncs when listeners fire.
void init();

export function useUser(): User | null {
  const [user, setUser] = useState<User | null>(currentUser);
  useEffect(() => {
    const cb = (u: User | null) => setUser(u);
    listeners.add(cb);
    // If init happened before this component mounted, currentUser is already set.
    cb(currentUser);
    return () => {
      listeners.delete(cb);
    };
  }, []);
  return user;
}

export async function signInWithGoogle(): Promise<void> {
  if (!supabase) return;
  // Redirect back to the exact origin+path the user started from. Supabase
  // will append the OAuth fragment, parse it on return, and clean the URL.
  const redirectTo = window.location.origin + window.location.pathname;
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
    },
  });
}

export async function signInWithEmail(email: string, password: string) {
  if (!supabase) throw new Error('Auth not configured');
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signUpWithEmail(email: string, password: string) {
  if (!supabase) throw new Error('Auth not configured');
  const { error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  if (!supabase) return;
  await supabase.auth.signOut();
}

/** Can the site's auth-dependent features be used at all in this build? */
export const authAvailable = isSupabaseConfigured;
