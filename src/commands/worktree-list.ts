/**
 * maestro worktree-list -- list all worktrees.
 */

import { defineCommand } from 'citty';
import { getServices } from '../services.ts';
import { output, renderTable } from '../lib/output.ts';
import { formatError, formatHint, MaestroError } from '../lib/errors.ts';

export default defineCommand({
  meta: { name: 'worktree-list', description: 'List all worktrees' },
  args: {
    feature: {
      type: 'string',
      description: 'Filter by feature name',
    },
  },
  async run({ args }) {
    try {
      const { worktreeAdapter } = getServices();
      const worktrees = await worktreeAdapter.list(args.feature);

      output(worktrees, (items) => {
        if (items.length === 0) {
          return 'No active worktrees.';
        }
        const rows = items.map((w: { path: string; branch: string; feature: string; step: string }) => [
          w.path,
          w.branch,
          w.feature,
          w.step,
        ]);
        return renderTable(['Path', 'Branch', 'Feature', 'Step'], rows);
      });
    } catch (err) {
      if (err instanceof MaestroError || err instanceof Error) {
        console.error(formatError('worktree-list', err.message));
        if (err instanceof MaestroError) err.hints.forEach(h => console.error(formatHint(h)));
        process.exit(1);
      }
      throw err;
    }
  },
});
