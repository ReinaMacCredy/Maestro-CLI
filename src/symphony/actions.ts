/**
 * Symphony action planning -- diff current state against planned state.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { hashContent } from './hashing.ts';
import type {
  SymphonyManifest,
  SymphonyManagedFile,
  SymphonyPlannedAction,
  ManagedFileRole,
  FileActionType,
} from './types.ts';

interface PlannedFile {
  path: string;
  role: ManagedFileRole;
  content: string;
}

/**
 * Build an action plan by comparing planned files against current disk state
 * and an optional existing manifest.
 */
export function buildActionPlan(
  projectRoot: string,
  plannedFiles: PlannedFile[],
  manifest: SymphonyManifest | null,
  force: boolean,
): SymphonyPlannedAction[] {
  const managedMap = new Map<string, SymphonyManagedFile>();
  if (manifest) {
    for (const mf of manifest.managedFiles) {
      managedMap.set(mf.path, mf);
    }
  }

  return plannedFiles.map((pf): SymphonyPlannedAction => {
    const absPath = path.join(projectRoot, pf.path);
    const fileExists = fs.existsSync(absPath);
    const tracked = managedMap.get(pf.path);
    const newHash = hashContent(pf.content);

    if (!fileExists) {
      return { path: pf.path, role: pf.role, action: 'create', content: pf.content };
    }

    const currentContent = fs.readFileSync(absPath, 'utf8');
    const currentHash = hashContent(currentContent);

    if (tracked) {
      // File is manifest-tracked
      if (currentHash === newHash) {
        return { path: pf.path, role: pf.role, action: 'unchanged', currentHash, manifestHash: tracked.contentHash };
      }
      if (currentHash === tracked.contentHash) {
        // User hasn't touched it -- safe to update
        return { path: pf.path, role: pf.role, action: 'update', content: pf.content, currentHash, manifestHash: tracked.contentHash };
      }
      // User edited the file (drift)
      if (force) {
        return { path: pf.path, role: pf.role, action: 'update', content: pf.content, currentHash, manifestHash: tracked.contentHash };
      }
      return { path: pf.path, role: pf.role, action: 'conflict', currentHash, manifestHash: tracked.contentHash };
    }

    // File exists but is NOT manifest-tracked (unmanaged)
    if (force) {
      return { path: pf.path, role: pf.role, action: 'update', content: pf.content, currentHash };
    }
    return { path: pf.path, role: pf.role, action: 'preserve-existing', currentHash };
  });
}

/** Count actions by type for summary display. */
export function summarizeActions(actions: SymphonyPlannedAction[]): Record<FileActionType, number> {
  const counts: Record<FileActionType, number> = {
    create: 0,
    update: 0,
    unchanged: 0,
    'preserve-existing': 0,
    conflict: 0,
  };
  for (const a of actions) {
    counts[a.action]++;
  }
  return counts;
}
