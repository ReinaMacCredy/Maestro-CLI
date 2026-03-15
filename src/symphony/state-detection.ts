/**
 * Install-time state detection for Symphony.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { readManifest, manifestExists } from './manifest.ts';
import type { InstallState } from './types.ts';

export function detectInstallState(projectRoot: string): InstallState {
  const maestroDir = path.join(projectRoot, '.maestro');
  const hasMaestro = fs.existsSync(maestroDir);

  if (!hasMaestro) {
    // Also check for any standalone config files
    const hasAgents = fs.existsSync(path.join(projectRoot, 'AGENTS.md'));
    const hasCodex = fs.existsSync(path.join(projectRoot, '.codex'));
    if (!hasAgents && !hasCodex) return 'fresh';
    // Has some files but no .maestro/ -- treat as fresh (install will create .maestro/)
    return 'fresh';
  }

  if (!manifestExists(projectRoot)) {
    return 'foreign-config';
  }

  const manifest = readManifest(projectRoot);
  if (!manifest) {
    return 'partial-symphony';
  }

  return 'complete-symphony';
}

/**
 * Detect the project name from package.json or directory name.
 */
export function detectProjectName(projectRoot: string): string {
  try {
    const pkgPath = path.join(projectRoot, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    if (pkg.name) return pkg.name;
  } catch { /* ignore */ }

  return path.basename(projectRoot);
}

/**
 * Detect the git remote URL.
 */
export function detectRepoUrl(projectRoot: string): string | undefined {
  try {
    const result = Bun.spawnSync(['git', 'remote', 'get-url', 'origin'], { cwd: projectRoot });
    if (result.exitCode === 0) {
      return new TextDecoder().decode(result.stdout).trim();
    }
  } catch { /* ignore */ }
  return undefined;
}

/**
 * Detect the primary branch name.
 */
export function detectPrimaryBranch(projectRoot: string): string {
  try {
    const result = Bun.spawnSync(
      ['git', 'symbolic-ref', 'refs/remotes/origin/HEAD'],
      { cwd: projectRoot },
    );
    if (result.exitCode === 0) {
      const ref = new TextDecoder().decode(result.stdout).trim();
      return ref.replace('refs/remotes/origin/', '');
    }
  } catch { /* ignore */ }
  return 'main';
}
