/**
 * maestro worktree-commit -- commit task changes and update status.
 */

import { defineCommand } from 'citty';
import { getServices } from '../services.ts';
import { commitTask } from '../usecases/commit-task.ts';
import { output } from '../lib/output.ts';
import { handleCommandError, MaestroError } from '../lib/errors.ts';

export default defineCommand({
  meta: { name: 'worktree-commit', description: 'Commit task changes and update status' },
  args: {
    feature: {
      type: 'string',
      description: 'Feature name',
      required: true,
    },
    task: {
      type: 'string',
      description: 'Task folder name',
      required: true,
    },
    status: {
      type: 'string',
      description: 'Task completion status: completed, blocked, failed, partial',
      required: true,
    },
    summary: {
      type: 'string',
      description: 'Summary of work done',
      required: true,
    },
    blockerReason: {
      type: 'string',
      description: 'Why the task is blocked (when status=blocked)',
    },
    blockerRecommendation: {
      type: 'string',
      description: 'Recommended resolution for blocker',
    },
  },
  async run({ args }) {
    try {
      const services = getServices();
      const validStatuses = ['completed', 'blocked', 'failed', 'partial'] as const;
      if (!validStatuses.includes(args.status as any)) {
        throw new MaestroError(
          `Invalid status '${args.status}'`,
          [`Valid values: ${validStatuses.join(', ')}`],
        );
      }

      const result = await commitTask(services, {
        feature: args.feature,
        task: args.task,
        status: args.status as 'completed' | 'blocked' | 'failed' | 'partial',
        summary: args.summary,
        blockerReason: args.blockerReason,
        blockerRecommendation: args.blockerRecommendation,
      });

      output(result, (r) => {
        const lines = [`[ok] task '${args.task}' --> ${args.status}`];
        if (r.sha) lines.push(`  commit: ${r.sha}`);
        if (r.nextAction) lines.push(`  next: ${r.nextAction}`);
        return lines.join('\n');
      });
    } catch (err) {
      handleCommandError('worktree-commit', err);
    }
  },
});
