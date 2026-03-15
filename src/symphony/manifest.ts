/**
 * Symphony manifest read/write/validate.
 * Stored at .maestro/symphony/manifest.json.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { ensureDir } from '../utils/fs-io.ts';
import type { SymphonyManifest } from './types.ts';

const MANIFEST_DIR = '.maestro/symphony';
const MANIFEST_FILE = 'manifest.json';

function manifestPath(projectRoot: string): string {
  return path.join(projectRoot, MANIFEST_DIR, MANIFEST_FILE);
}

/** Read manifest from disk. Returns null if not found or invalid. */
export function readManifest(projectRoot: string): SymphonyManifest | null {
  const p = manifestPath(projectRoot);
  if (!fs.existsSync(p)) return null;
  try {
    const raw = fs.readFileSync(p, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed?.version !== 1 || !Array.isArray(parsed?.managedFiles)) return null;
    return parsed as SymphonyManifest;
  } catch {
    return null;
  }
}

/** Write manifest to disk. Creates directory if needed. */
export function writeManifest(projectRoot: string, manifest: SymphonyManifest): void {
  const dir = path.join(projectRoot, MANIFEST_DIR);
  ensureDir(dir);
  const p = manifestPath(projectRoot);
  fs.writeFileSync(p, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
}

/** Check if a manifest file exists at all (for state detection). */
export function manifestExists(projectRoot: string): boolean {
  return fs.existsSync(manifestPath(projectRoot));
}
