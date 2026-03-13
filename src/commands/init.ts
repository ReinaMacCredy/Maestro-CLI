/**
 * maestro init -- initialize project for maestro.
 */

import { defineCommand } from 'citty';
import { output } from '../lib/output.ts';
import { handleCommandError } from '../lib/errors.ts';
import { getHivePath } from '../utils/paths.ts';
import { ensureDir } from '../utils/fs-io.ts';
import { findProjectRoot } from '../utils/detection.ts';
import * as fs from 'fs';
import * as path from 'path';

export default defineCommand({
  meta: { name: 'init', description: 'Initialize maestro for current project' },
  args: {},
  async run() {
    try {
      const cwd = process.cwd();
      const existing = findProjectRoot(cwd);
      const projectRoot = existing || cwd;

      // Create .hive/ directory
      const hivePath = getHivePath(projectRoot);
      ensureDir(hivePath);
      ensureDir(path.join(hivePath, 'features'));

      // Initialize br if .beads/ doesn't exist
      const beadsPath = path.join(projectRoot, '.beads');
      let brInitialized = false;
      if (!fs.existsSync(beadsPath)) {
        try {
          const proc = Bun.spawn(['br', 'init'], { cwd: projectRoot, stdout: 'pipe', stderr: 'pipe' });
          await proc.exited;
          brInitialized = proc.exitCode === 0;
        } catch {
          // br not installed -- not fatal
        }
      } else {
        brInitialized = true;
      }

      const result = {
        projectRoot,
        hivePath,
        brInitialized,
        existing: !!existing,
      };

      output(result, (r) => {
        const lines = [
          `[ok] maestro initialized at ${r.projectRoot}`,
          `  .hive/ ${r.existing ? 'already existed' : 'created'}`,
          `  br: ${r.brInitialized ? 'ready' : 'not available (install br for task tracking)'}`,
        ];
        return lines.join('\n');
      });
    } catch (err) {
      handleCommandError('init', err);
    }
  },
});
