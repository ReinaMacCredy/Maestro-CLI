/**
 * maestro symphony status -- show Symphony manifest state and drift.
 */

import { defineCommand } from 'citty';
import { output } from '../../lib/output.ts';
import { handleCommandError } from '../../lib/errors.ts';
import { getSymphonyStatus } from '../../symphony/status.ts';

export default defineCommand({
  meta: { name: 'status', description: 'Show Symphony installation status and file drift' },
  args: {},
  async run() {
    try {
      const status = getSymphonyStatus(process.cwd());

      output(status, (s) => {
        if (!s.installed) {
          if (s.partial) {
            return '[!] Partial install detected. Run `maestro symphony install --force` to complete.';
          }
          return 'Symphony not installed. Run `maestro symphony install` to get started.';
        }

        const lines: string[] = [];
        lines.push('[ok] Symphony installed');
        lines.push(`  Managed files: ${s.managedFileCount}`);
        if (s.linearProjectSlug) lines.push(`  Linear project: ${s.linearProjectSlug}`);
        if (s.lastSyncedAt) lines.push(`  Last synced: ${s.lastSyncedAt}`);

        if (s.driftedCount > 0) {
          lines.push(`\n  [!] ${s.driftedCount} file(s) drifted from manifest:`);
          for (const f of s.files.filter(f => f.status === 'drifted')) {
            lines.push(`    - ${f.path}`);
          }
          lines.push('  Run `maestro symphony sync` to update, or `--force` to overwrite.');
        }

        if (s.missingCount > 0) {
          lines.push(`\n  [!] ${s.missingCount} managed file(s) missing:`);
          for (const f of s.files.filter(f => f.status === 'missing')) {
            lines.push(`    - ${f.path}`);
          }
          lines.push('  Run `maestro symphony sync` to regenerate.');
        }

        if (s.driftedCount === 0 && s.missingCount === 0) {
          lines.push('  All managed files are in sync.');
        }

        return lines.join('\n');
      });
    } catch (err) {
      handleCommandError('symphony status', err);
    }
  },
});
