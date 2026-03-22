/**
 * Resolve doctrine config with defaults from a single source of truth.
 * Token fields take precedence. If only byte fields are set, derive tokens from bytes/4.
 */

import { DOCTRINE_DEFAULTS, type HiveConfig } from '../types.ts';

export function resolveDoctrineConfig(override?: NonNullable<HiveConfig['doctrine']>) {
  const merged = { ...DOCTRINE_DEFAULTS, ...override };

  if (override?.doctrineBudgetTokens === undefined && override?.doctrineBudgetBytes !== undefined) {
    merged.doctrineBudgetTokens = Math.ceil(override.doctrineBudgetBytes / 4);
  }

  return merged;
}
