/**
 * maestro worktree-list -- list all worktrees.
 */

import { defineCommand } from 'citty';
import { getServices } from '../../services.ts';
import { output, renderTable } from '../../lib/output.ts';
import { handleCommandError } from '../../lib/errors.ts';

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
      handleCommandError('worktree-list', err);
    }
  },
});
