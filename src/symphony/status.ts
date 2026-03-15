/**
 * Core status logic for `maestro symphony status`.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { readManifest, manifestExists } from './manifest.ts';
import { hashContent } from './hashing.ts';

export interface FileStatus {
  path: string;
  role: string;
  status: 'ok' | 'drifted' | 'missing';
}

export interface SymphonyStatus {
  installed: boolean;
  partial: boolean;
  linearProjectSlug?: string;
  installedAt?: string;
  lastSyncedAt?: string;
  managedFileCount: number;
  files: FileStatus[];
  driftedCount: number;
  missingCount: number;
}

export function getSymphonyStatus(projectRoot: string): SymphonyStatus {
  if (!manifestExists(projectRoot)) {
    // Check for partial install (files exist without manifest)
    const hasMaestro = fs.existsSync(path.join(projectRoot, '.maestro'));
    const hasSymphonyDir = fs.existsSync(path.join(projectRoot, '.maestro', 'symphony'));
    const partial = hasMaestro && !hasSymphonyDir;

    return {
      installed: false,
      partial,
      managedFileCount: 0,
      files: [],
      driftedCount: 0,
      missingCount: 0,
    };
  }

  const manifest = readManifest(projectRoot);
  if (!manifest) {
    return {
      installed: false,
      partial: true,
      managedFileCount: 0,
      files: [],
      driftedCount: 0,
      missingCount: 0,
    };
  }

  const files: FileStatus[] = [];
  let driftedCount = 0;
  let missingCount = 0;

  for (const mf of manifest.managedFiles) {
    const absPath = path.join(projectRoot, mf.path);
    if (!fs.existsSync(absPath)) {
      files.push({ path: mf.path, role: mf.role, status: 'missing' });
      missingCount++;
      continue;
    }

    const currentHash = hashContent(fs.readFileSync(absPath, 'utf8'));
    if (currentHash === mf.contentHash) {
      files.push({ path: mf.path, role: mf.role, status: 'ok' });
    } else {
      files.push({ path: mf.path, role: mf.role, status: 'drifted' });
      driftedCount++;
    }
  }

  return {
    installed: true,
    partial: false,
    linearProjectSlug: manifest.linearProjectSlug,
    installedAt: manifest.installedAt,
    lastSyncedAt: manifest.lastSyncedAt,
    managedFileCount: manifest.managedFiles.length,
    files,
    driftedCount,
    missingCount,
  };
}
