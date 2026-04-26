import { useGlobalAnalytics } from '../hooks/useGlobalAnalytics';

interface GlobalEffectsProps {
  /**
   * CROS-family slug for this app. Stamped on every GA event as the
   * `cros_app` custom dimension for per-app drill-down inside the
   * shared GA4 property.
   */
  sourceApp: string;
}

/**
 * Invisible component that activates global side-effects (analytics, etc.)
 * Renders nothing — mount once inside the provider tree.
 */
export function GlobalEffects({ sourceApp }: GlobalEffectsProps) {
  useGlobalAnalytics(sourceApp);
  return null;
}
