/**
 * Process utility helpers for maestroCLI.
 */

/**
 * Check whether a process with the given PID is still alive.
 * Returns true if alive or if we lack permission to signal it (EPERM).
 * Returns false if the process does not exist (ESRCH).
 */
export function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ESRCH') return false;
    if (code === 'EPERM') return true;
    throw error;
  }
}
