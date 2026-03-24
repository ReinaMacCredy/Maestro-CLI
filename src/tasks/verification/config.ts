/**
 * Resolve verification config with defaults from a single source of truth.
 */

import { DEFAULT_SETTINGS, type VerificationSettings } from '../../core/settings.ts';

export interface ResolvedVerificationConfig extends VerificationSettings {
  autoAcceptTypes: string[];
}

export function resolveVerificationConfig(
  override?: VerificationSettings,
): ResolvedVerificationConfig {
  return { ...DEFAULT_SETTINGS.verification, ...override };
}
