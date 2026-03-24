/**
 * Resolve DCP config with defaults from a single source of truth.
 */

import { DCP_DEFAULTS } from '../core/types.ts';
import type { DcpSettings } from '../core/settings.ts';

export function resolveDcpConfig(override?: DcpSettings) {
  return { ...DCP_DEFAULTS, ...override };
}
