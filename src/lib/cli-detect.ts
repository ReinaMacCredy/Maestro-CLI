/**
 * CLI availability detection.
 * Extracted from services.ts for reuse in conditional tool registration.
 */

import { execFileSync } from 'node:child_process';

/**
 * Check whether a CLI tool is available on PATH.
 * Returns true if the command exists, false otherwise.
 */
export function checkCli(name: string): boolean {
  try {
    execFileSync('command', ['-v', name], { stdio: 'pipe', shell: true });
    return true;
  } catch {
    return false;
  }
}
