/**
 * Resolve verification config with defaults from a single source of truth.
 * Follows the same pattern as dcp-config.ts.
 */

import { VERIFICATION_DEFAULTS, type HiveConfig } from '../../core/types.ts';
import type { VerificationSettings } from '../../core/settings.ts';

export interface ResolvedVerificationConfig {
  enabled: boolean;
  autoReject: boolean;
  maxRevisions: number;
  autoAcceptTypes: string[];
  buildTimeoutMs: number;
  scoreThreshold: number;
  buildCommand?: string;
}

export function resolveVerificationConfig(
  override?: VerificationSettings | NonNullable<HiveConfig['verification']>,
): ResolvedVerificationConfig {
  const { buildCommand, ...rest } = override ?? {};
  return {
    ...VERIFICATION_DEFAULTS,
    ...rest,
    ...(buildCommand ? { buildCommand } : {}),
  };
}
