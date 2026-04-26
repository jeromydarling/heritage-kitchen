import { useEffect } from 'react';

/**
 * useGlobalAnalytics — Federated Google Analytics for the CROS family.
 *
 * WHAT: On mount, fetches the canonical GA config from thecros's
 *       `analytics-config` edge function and injects gtag.js with the
 *       returned measurement ID. Every event is stamped with
 *       `cros_app: <sourceApp>` so reports can filter per app even
 *       when all apps share one GA4 property.
 * WHERE: Mounted once at app root (typically inside <GlobalEffects />).
 * WHY: One Measurement ID for the whole family + a `cros_app` custom
 *      dimension lets us run unified analytics with per-app drill-down,
 *      and lets us swap the property server-side without redeploying
 *      every app.
 *
 * Setup checklist for the GA4 property (one-time):
 *   1. Admin → Custom definitions → Create custom dimension
 *      Name: "CROS App"
 *      Scope: Event
 *      Event parameter: cros_app
 *
 * Fallback behavior: if the federation endpoint is unreachable, the hook
 * silently no-ops — analytics is non-essential and must not break the app.
 */

const CONFIG_URL = 'https://thecros.lovable.app/functions/v1/analytics-config';

interface AnalyticsConfig {
  measurementId: string;
  provider: 'ga4';
  debug: boolean;
  customDimensionParams: string[];
}

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

export function useGlobalAnalytics(sourceApp: string) {
  useEffect(() => {
    let cancelled = false;

    async function init() {
      let cfg: AnalyticsConfig;
      try {
        const res = await fetch(`${CONFIG_URL}?app=${encodeURIComponent(sourceApp)}`, {
          method: 'GET',
        });
        if (!res.ok) return;
        cfg = (await res.json()) as AnalyticsConfig;
      } catch {
        return;
      }

      if (cancelled) return;
      if (!cfg?.measurementId) return;

      // Ensure dataLayer + gtag stub exist (idempotent — safe even if
      // an inline gtag snippet in index.html ran first).
      window.dataLayer = window.dataLayer || [];
      if (typeof window.gtag !== 'function') {
        window.gtag = function gtag(...args: unknown[]) {
          window.dataLayer.push(args);
        };
      }

      // Inject gtag.js only if it isn't already on the page.
      // Match either our hook-injected tag or a hardcoded <script src="...gtag/js?id=...">
      // in index.html (theschola pattern).
      const alreadyLoaded =
        document.getElementById('ga-global-script') ||
        document.querySelector('script[src*="googletagmanager.com/gtag/js"]');
      if (!alreadyLoaded) {
        const script = document.createElement('script');
        script.id = 'ga-global-script';
        script.async = true;
        script.src = `https://www.googletagmanager.com/gtag/js?id=${cfg.measurementId}`;
        document.head.appendChild(script);
        window.gtag('js', new Date());
      }

      // Always (re)configure with the cros_app dimension. Calling gtag('config', id)
      // a second time is a no-op for measurement but updates the parameter set,
      // which is exactly what we want when index.html already ran a basic config.
      window.gtag('config', cfg.measurementId, {
        cros_app: sourceApp,
        debug_mode: cfg.debug || undefined,
        send_page_view: true,
      });
    }

    void init();

    return () => {
      cancelled = true;
    };
  }, [sourceApp]);
}
