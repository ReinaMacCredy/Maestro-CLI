/**
 * Feature resolution: explicit --feature > worktree detection > single-feature fallback.
 */

import { detectContext, listFeatures } from '../utils/detection.ts';
import { findProjectRoot } from '../utils/detection.ts';

export function resolveFeature(explicit?: string): string {
  if (explicit) return explicit;

  const cwd = process.cwd();
  const ctx = detectContext(cwd);

  if (ctx.feature) return ctx.feature;

  const projectRoot = findProjectRoot(cwd);
  if (!projectRoot) {
    throw new Error(
      '[error] resolve-feature: no project root found\n[hint] Run maestro init first, or pass --feature explicitly'
    );
  }

  const features = listFeatures(projectRoot);
  if (features.length === 1) return features[0];

  if (features.length === 0) {
    throw new Error(
      '[error] resolve-feature: no features found\n[hint] Create one with: maestro feature-create <name>'
    );
  }

  throw new Error(
    `[error] resolve-feature: ${features.length} features found, cannot auto-resolve\n[hint] Pass --feature explicitly: ${features.join(', ')}`
  );
}
