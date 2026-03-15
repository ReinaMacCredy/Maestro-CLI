/**
 * Codex skills installer for Symphony.
 * Copies skill files from the built-in reference assets to .codex/skills/.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { RenderedFile } from './context.ts';

const REFERENCE_DIR = 'skills/built-in/maestro:symphony-setup/reference/codex-skills';

/**
 * Resolve the reference assets directory.
 * In dev: relative to project root. In dist: relative to __dirname.
 */
function resolveReferenceDir(): string {
  // Try relative to this file's module root (works in both dev and built mode)
  const candidates = [
    path.resolve(import.meta.dir, '../../../../', REFERENCE_DIR),
    path.resolve(import.meta.dir, '../../../', REFERENCE_DIR),
    path.resolve(process.cwd(), REFERENCE_DIR),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  throw new Error(`Cannot find codex skills reference assets. Searched: ${candidates.join(', ')}`);
}

/**
 * Read all codex skill files from reference assets and produce
 * RenderedFile entries targeting .codex/skills/ in the target repo.
 */
export function collectCodexSkills(): RenderedFile[] {
  const refDir = resolveReferenceDir();
  const files: RenderedFile[] = [];

  const skillDirs = fs.readdirSync(refDir).filter(entry => {
    return fs.statSync(path.join(refDir, entry)).isDirectory();
  });

  for (const skillName of skillDirs) {
    const skillDir = path.join(refDir, skillName);
    const entries = fs.readdirSync(skillDir);

    for (const entry of entries) {
      const srcPath = path.join(skillDir, entry);
      if (!fs.statSync(srcPath).isFile()) continue;

      const content = fs.readFileSync(srcPath, 'utf8');
      const targetPath = `.codex/skills/${skillName}/${entry}`;
      files.push({ path: targetPath, content });
    }
  }

  return files;
}
