import * as fs from 'node:fs';
import * as path from 'node:path';

/** Parse JSON from stdin. Returns {} on parse failure. */
export async function readStdin(): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => {
      try {
        resolve(JSON.parse(data));
      } catch {
        resolve({});
      }
    });
    // Handle case where stdin is already closed
    process.stdin.on('error', () => resolve({}));
    process.stdin.resume();
  });
}

/** Write JSON output to stdout. */
export function writeOutput(data: object): void {
  console.log(JSON.stringify(data));
}

/**
 * Walk cwd upward looking for .maestro/ directory.
 * Uses CLAUDE_PROJECT_DIR first if set.
 * Returns the parent directory containing .maestro/, or null.
 */
export function resolveProjectDir(): string | null {
  const envDir = process.env.CLAUDE_PROJECT_DIR;
  if (envDir) {
    const maestroPath = path.join(envDir, '.maestro');
    if (fs.existsSync(maestroPath)) return envDir;
  }

  let current = process.cwd();
  while (true) {
    const maestroPath = path.join(current, '.maestro');
    if (fs.existsSync(maestroPath)) return current;
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

/** Log error to hook error log (best-effort). */
export function logHookError(projectDir: string | null, hookName: string, error: unknown): void {
  try {
    const logDir = projectDir
      ? path.join(projectDir, '.maestro', 'sessions')
      : null;
    if (!logDir) return;
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    const logPath = path.join(logDir, 'hook-errors.log');
    const entry = `[${new Date().toISOString()}] ${hookName}: ${error instanceof Error ? error.message : String(error)}\n`;
    fs.appendFileSync(logPath, entry);
  } catch {
    // Best effort -- never throw from error logging
  }
}
