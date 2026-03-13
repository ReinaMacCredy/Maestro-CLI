/**
 * Context detection utilities for maestroCLI.
 * Forked from hive-core/src/utils/detection.ts.
 */

import * as path from 'path';
import * as fs from 'fs';
import { getFeaturesPath, normalizePath } from './paths.ts';

export interface DetectionResult {
  projectRoot: string;
  feature: string | null;
  task: string | null;
  isWorktree: boolean;
  mainProjectRoot: string | null;
}

export function detectContext(cwd: string): DetectionResult {
  const result: DetectionResult = {
    projectRoot: cwd,
    feature: null,
    task: null,
    isWorktree: false,
    mainProjectRoot: null,
  };

  const normalizedCwd = normalizePath(cwd);
  const worktreeMatch = normalizedCwd.match(/(.+)\/\.maestro\/\.worktrees\/([^/]+)\/([^/]+)/);
  if (worktreeMatch) {
    result.mainProjectRoot = worktreeMatch[1];
    result.feature = worktreeMatch[2];
    result.task = worktreeMatch[3];
    result.isWorktree = true;
    result.projectRoot = worktreeMatch[1];
    return result;
  }

  const gitPath = path.join(cwd, '.git');
  if (fs.existsSync(gitPath)) {
    const stat = fs.statSync(gitPath);
    if (stat.isFile()) {
      const gitContent = fs.readFileSync(gitPath, 'utf-8').trim();
      const gitdirMatch = gitContent.match(/gitdir:\s*(.+)/);
      if (gitdirMatch) {
        const gitdir = gitdirMatch[1];
        const normalizedGitdir = normalizePath(gitdir);
        const worktreePathMatch = normalizedGitdir.match(/(.+)\/\.git\/worktrees\/(.+)/);
        if (worktreePathMatch) {
          const mainRepo = worktreePathMatch[1];
          const cwdWorktreeMatch = normalizedCwd.match(/\.maestro\/\.worktrees\/([^/]+)\/([^/]+)/);
          if (cwdWorktreeMatch) {
            result.mainProjectRoot = mainRepo;
            result.feature = cwdWorktreeMatch[1];
            result.task = cwdWorktreeMatch[2];
            result.isWorktree = true;
            result.projectRoot = mainRepo;
            return result;
          }
        }
      }
    }
  }

  return result;
}

export function listFeatures(projectRoot: string): string[] {
  const featuresPath = getFeaturesPath(projectRoot);
  if (!fs.existsSync(featuresPath)) return [];

  return fs.readdirSync(featuresPath, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);
}

export function findProjectRoot(startDir: string): string | null {
  // Resolve symlinks to ensure consistent canonical paths across processes
  let current: string;
  try {
    current = fs.realpathSync(startDir);
  } catch {
    current = startDir;
  }
  const root = path.parse(current).root;

  while (current !== root) {
    if (fs.existsSync(path.join(current, '.maestro'))) {
      return current;
    }
    if (fs.existsSync(path.join(current, '.git'))) {
      return current;
    }
    current = path.dirname(current);
  }

  return null;
}
