/**
 * Context detection utilities for maestroCLI.
 */

import * as path from 'path';
import * as fs from 'fs';
import { getFeaturesPath } from './paths.ts';

export interface DetectionResult {
  projectRoot: string;
  feature: string | null;
  task: string | null;
}

export function detectContext(cwd: string): DetectionResult {
  return {
    projectRoot: cwd,
    feature: null,
    task: null,
  };
}

export function listFeatures(projectRoot: string): string[] {
  const featuresPath = getFeaturesPath(projectRoot);
  if (!fs.existsSync(featuresPath)) return [];

  return fs.readdirSync(featuresPath, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);
}

export interface FindProjectRootOptions {
  /** Only match directories containing .maestro/ (skip .git-only). */
  maestroOnly?: boolean;
  /** Check CLAUDE_PROJECT_DIR env var first. */
  envOverride?: boolean;
}

export function findProjectRoot(startDir: string, opts?: FindProjectRootOptions): string | null {
  // Check env override first (used by hooks in plugin context)
  if (opts?.envOverride) {
    const envDir = process.env.CLAUDE_PROJECT_DIR;
    if (envDir && fs.existsSync(path.join(envDir, '.maestro'))) {
      return envDir;
    }
  }

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
    if (!opts?.maestroOnly && fs.existsSync(path.join(current, '.git'))) {
      return current;
    }
    current = path.dirname(current);
  }

  return null;
}
