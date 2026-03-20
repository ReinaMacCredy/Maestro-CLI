/**
 * Resolve DCP config with defaults from a single source of truth.
 */

import { DCP_DEFAULTS, type HiveConfig } from '../types.ts';

export function resolveDcpConfig(override?: NonNullable<HiveConfig['dcp']>) {
  return { ...DCP_DEFAULTS, ...override };
}
