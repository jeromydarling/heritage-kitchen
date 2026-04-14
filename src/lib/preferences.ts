import { useEffect, useState } from 'react';

/**
 * Tiny preferences store backed by localStorage with a subscription
 * mechanism so React components can react to changes without a page
 * reload. Currently holds a single flag â€” whether the liturgical kitchen
 * features are surfaced â€” but designed so more can be added as siblings.
 */

const KEY_LITURGICAL = 'hk.liturgicalKitchen';

const listeners = new Set<() => void>();

function notify(): void {
  for (const cb of listeners) cb();
}

function readLiturgical(): boolean {
  if (typeof localStorage === 'undefined') return true;
  // Default is on â€” the feature is central to the site. Users opt out, not in.
  return localStorage.getItem(KEY_LITURGICAL) !== 'off';
}

function writeLiturgical(enabled: boolean): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(KEY_LITURGICAL, enabled ? 'on' : 'off');
  notify();
}

/**
 * Hook: returns `[enabled, setEnabled]` for the liturgical kitchen toggle,
 * re-rendering any component that uses it when the preference changes.
 */
export function useLiturgicalKitchen(): readonly [boolean, (v: boolean) => void] {
  const [enabled, setEnabled] = useState<boolean>(readLiturgical);
  useEffect(() => {
    const cb = () => setEnabled(readLiturgical());
    listeners.add(cb);
    // Also keep in sync across tabs
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY_LITURGICAL) cb();
    };
    window.addEventListener('storage', onStorage);
    return () => {
      listeners.delete(cb);
      window.removeEventListener('storage', onStorage);
    };
  }, []);
  return [enabled, writeLiturgical] as const;
}

export function getLiturgicalKitchen(): boolean {
  return readLiturgical();
}
