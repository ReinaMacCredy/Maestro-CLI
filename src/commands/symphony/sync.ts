/**
 * maestro symphony sync -- re-sync managed files from current repo state.
 */

import { defineCommand } from 'citty';
import { output, renderTable } from '../../lib/output.ts';
import { handleCommandError } from '../../lib/errors.ts';
import { executeSync } from '../../symphony/sync.ts';
import type { SymphonyPlannedAction } from '../../symphony/types.ts';

function formatActionTable(actions: SymphonyPlannedAction[]): string {
  const rows = actions.map(a => [a.path, a.action]);
  return renderTable(['file', 'action'], rows);
}

export default defineCommand({
  meta: { name: 'sync', description: 'Re-sync Symphony managed files from current repo state' },
  args: {
    'dry-run': {
      type: 'boolean',
      description: 'Show planned actions without writing files',
      default: false,
    },
    yes: {
      type: 'boolean',
      alias: 'y',
      description: 'Skip confirmation prompt',
      default: false,
    },
    force: {
      type: 'boolean',
      description: 'Overwrite drifted managed files',
      default: false,
    },
  },
  async run({ args }) {
    try {
      const dryRun = args['dry-run'] as boolean;
      const force = args.force as boolean;

      const result = executeSync({
        projectRoot: process.cwd(),
        dryRun,
        force,
      });

      output(result, (r) => {
        const lines: string[] = [];
        lines.push(formatActionTable(r.actions));
        lines.push('');

        const s = r.actionSummary;
        const parts: string[] = [];
        if (s.create) parts.push(`${s.create} created`);
        if (s.update) parts.push(`${s.update} updated`);
        if (s.unchanged) parts.push(`${s.unchanged} unchanged`);
        if (s.conflict) parts.push(`${s.conflict} conflicts (use --force to overwrite)`);
        lines.push(parts.join(', '));

        if (dryRun) {
          lines.push('\n[dry-run] No files written.');
        } else if (r.applied) {
          lines.push('\n[ok] Sync complete.');
        }

        return lines.join('\n');
      });
    } catch (err) {
      handleCommandError('symphony sync', err);
    }
  },
});
