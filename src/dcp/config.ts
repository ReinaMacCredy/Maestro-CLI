/**
 * Resolve DCP config with defaults from a single source of truth.
 * Token fields take precedence. If only byte fields are set, derive tokens from bytes/4.
 */

import { DCP_DEFAULTS, type HiveConfig } from '../core/types.ts';

export function resolveDcpConfig(override?: NonNullable<HiveConfig['dcp']>) {
  const merged = { ...DCP_DEFAULTS, ...override };

  // Token precedence: user-set token fields win; otherwise derive from bytes/4
  if (override?.memoryBudgetTokens === undefined && override?.memoryBudgetBytes !== undefined) {
    merged.memoryBudgetTokens = Math.ceil(override.memoryBudgetBytes / 4);
  }
  if (override?.completedTaskBudgetTokens === undefined && override?.completedTaskBudgetBytes !== undefined) {
    merged.completedTaskBudgetTokens = Math.ceil(override.completedTaskBudgetBytes / 4);
  }
  if (override?.handoffDecisionBudgetTokens === undefined && override?.handoffDecisionBudgetBytes !== undefined) {
    merged.handoffDecisionBudgetTokens = Math.ceil(override.handoffDecisionBudgetBytes / 4);
  }

  return merged;
}
