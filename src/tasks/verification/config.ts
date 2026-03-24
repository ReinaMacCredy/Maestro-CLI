/**
 * Resolve verification config with defaults from a single source of truth.
 */

import { VERIFICATION_DEFAULTS } from '../../core/types.ts';
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
  override?: VerificationSettings,
): ResolvedVerificationConfig {
  const { buildCommand, ...rest } = override ?? {};
  return {
    ...VERIFICATION_DEFAULTS,
    ...rest,
    ...(buildCommand ? { buildCommand } : {}),
  };
}
