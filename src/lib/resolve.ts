/**
 * Shared feature resolution helpers.
 * Used by both CLI commands and MCP server tools.
 */

import type { MaestroServices } from '../services.ts';
import { MaestroError } from './errors.ts';

/**
 * Resolve feature name from explicit arg or active feature.
 * Returns null if no feature can be resolved.
 */
export function resolveFeature(services: MaestroServices, explicitFeature?: string): string | null {
  if (explicitFeature) return explicitFeature;
  const active = services.featureAdapter.getActive();
  return active?.name ?? null;
}

/**
 * Resolve feature or throw MaestroError.
 * Accepts optional hints for context-appropriate error messages.
 */
export function requireFeature(
  services: MaestroServices,
  explicitFeature?: string,
  hints?: string[],
): string {
  const feature = resolveFeature(services, explicitFeature);
  if (!feature) {
    throw new MaestroError(
      'No feature specified and no active feature set',
      hints ?? ['Specify a feature name or create one with maestro_feature_create'],
    );
  }
  return feature;
}
