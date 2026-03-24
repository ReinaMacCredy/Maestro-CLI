/**
 * Resolve doctrine config with defaults from a single source of truth.
 */

import { DOCTRINE_DEFAULTS } from '../core/types.ts';
import type { DoctrineSettings } from '../core/settings.ts';

export function resolveDoctrineConfig(override?: DoctrineSettings) {
  return { ...DOCTRINE_DEFAULTS, ...override };
}
