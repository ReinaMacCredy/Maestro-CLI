/**
 * Resolve doctrine config with defaults from a single source of truth.
 */

import { DOCTRINE_DEFAULTS, type HiveConfig } from '../types.ts';

export function resolveDoctrineConfig(override?: NonNullable<HiveConfig['doctrine']>) {
  return { ...DOCTRINE_DEFAULTS, ...override };
}
