/**
 * Shared resolution helpers for MCP tool handlers.
 */

import type { MaestroServices } from '../../services.ts';
import { MaestroError } from '../../lib/errors.ts';

/**
 * Resolve feature name from explicit arg or active feature.
 * Returns null if no feature can be resolved.
 */
export function resolveFeature(services: MaestroServices, explicitFeature?: string): string | null {
  if (explicitFeature) return explicitFeature;
  const active = services.featureAdapter.getActive();
  return active?.name ?? null;
}

/** Resolve feature or throw MaestroError. Use with withErrorHandling. */
export function requireFeature(services: MaestroServices, explicitFeature?: string): string {
  const feature = resolveFeature(services, explicitFeature);
  if (!feature) {
    throw new MaestroError('No active feature found', ['Specify a feature name or create one with maestro_feature_create']);
  }
  return feature;
}
