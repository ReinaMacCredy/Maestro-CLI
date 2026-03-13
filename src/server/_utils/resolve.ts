/**
 * Shared resolution helpers for MCP tool handlers.
 */

import type { MaestroServices } from '../../services.ts';

/**
 * Resolve feature name from explicit arg or active feature.
 * Returns null if no feature can be resolved.
 */
export function resolveFeature(services: MaestroServices, explicitFeature?: string): string | null {
  if (explicitFeature) return explicitFeature;
  const active = services.featureAdapter.getActive();
  return active?.name ?? null;
}
