/**
 * maestro worktree-patch-apply -- apply worktree changes to the main branch.
 */

import { defineCommand } from 'citty';
import { getServices } from '../services.ts';
import { output } from '../lib/output.ts';
import { resolveFeature } from '../utils/resolve-feature.ts';
import { handleCommandError } from '../lib/errors.ts';

export default defineCommand({
  meta: { name: 'worktree-patch-apply', description: 'Apply worktree changes to main branch' },
  args: {
    task: {
      type: 'string',
      description: 'Task folder name',
      required: true,
    },
    feature: {
      type: 'string',
      description: 'Feature name (auto-resolved if omitted)',
    },
    base: {
      type: 'string',
      description: 'Base branch or commit for diff (default: HEAD~1)',
    },
  },
  async run({ args }) {
    try {
      const feature = resolveFeature(args.feature);
      const { worktreeAdapter } = getServices();
      const result = await worktreeAdapter.applyDiff(feature, args.task, args.base);

      output(result, (r) => {
        if (!r.success) {
          return `[error] worktree-patch-apply: ${r.error ?? 'unknown error'}\n[hint] Run worktree-conflicts to inspect conflicting files`;
        }
        const files = r.filesAffected ?? [];
        if (files.length === 0) {
          return '[ok] No changes to apply.';
        }
        return `[ok] Applied ${files.length} file(s):\n${files.map((f: string) => `  ${f}`).join('\n')}`;
      });
    } catch (err) {
      handleCommandError('worktree-patch-apply', err);
    }
  },
});
