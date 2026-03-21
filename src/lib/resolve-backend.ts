/**
 * Resolve taskBackend config ('auto' | 'fs' | 'br') to a concrete backend.
 */

import { checkCli } from './cli-detect.ts';
import { existsSync } from 'fs';
import { join } from 'path';

export type ConfigBackend = 'fs' | 'br' | 'auto';
export type ResolvedBackend = 'fs' | 'br';

/**
 * Resolve 'auto' to a concrete backend. Checks both:
 * 1. br binary is on PATH (checkCli, cached)
 * 2. .beads/ directory exists in projectRoot (br is initialized for this project)
 * Falls back to 'fs' if either check fails.
 */
export function resolveTaskBackend(configured: ConfigBackend | undefined, projectRoot?: string): ResolvedBackend {
  if (configured === 'fs' || configured === 'br') return configured;
  if (!checkCli('br')) return 'fs';
  if (!projectRoot) return 'br';
  return existsSync(join(projectRoot, '.beads')) ? 'br' : 'fs';
}
