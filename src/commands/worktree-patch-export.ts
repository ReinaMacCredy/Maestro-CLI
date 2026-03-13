/**
 * maestro worktree-patch-export -- export worktree changes as a patch file.
 */

import { defineCommand } from 'citty';
import { getServices } from '../services.ts';
import { output } from '../lib/output.ts';
import { resolveFeature } from '../lib/resolve-feature.ts';
import { handleCommandError } from '../lib/errors.ts';

export default defineCommand({
  meta: { name: 'worktree-patch-export', description: 'Export worktree changes as a patch file' },
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
      const patchPath = await worktreeAdapter.exportPatch(feature, args.task, args.base);

      output({ patchPath }, (r) => {
        return `[ok] Patch exported to ${r.patchPath}`;
      });
    } catch (err) {
      handleCommandError('worktree-patch-export', err);
    }
  },
});
