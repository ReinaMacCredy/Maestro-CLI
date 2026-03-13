/**
 * maestro worktree-cleanup -- clean up orphaned worktrees.
 */

import { defineCommand } from 'citty';
import { getServices } from '../../services.ts';
import { output, renderList } from '../../lib/output.ts';
import { handleCommandError } from '../../lib/errors.ts';

export default defineCommand({
  meta: { name: 'worktree-cleanup', description: 'Clean up orphaned worktrees' },
  args: {
    feature: {
      type: 'string',
      description: 'Limit cleanup to a specific feature',
    },
  },
  async run({ args }) {
    try {
      const { worktreeAdapter } = getServices();
      const result = await worktreeAdapter.cleanup(args.feature);

      output(result, (r) => {
        if (r.removed.length === 0) {
          return '[ok] No orphaned worktrees found.';
        }
        return `[ok] Removed ${r.removed.length} orphaned worktree(s):\n${renderList(r.removed)}`;
      });
    } catch (err) {
      handleCommandError('worktree-cleanup', err);
    }
  },
});
