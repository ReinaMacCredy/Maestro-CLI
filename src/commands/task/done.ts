/**
 * maestro task-done -- mark a task as complete.
 */

import { defineCommand } from 'citty';
import { getServices } from '../../services.ts';
import { output } from '../../lib/output.ts';
import { handleCommandError } from '../../lib/errors.ts';
import { requireFeature } from '../../lib/resolve.ts';
import { buildExecutionMemory } from '../../utils/execution-memory.ts';
import { getChangedFilesSince } from '../../utils/git.ts';

export default defineCommand({
  meta: { name: 'task-done', description: 'Mark a task as done' },
  args: {
    feature: {
      type: 'string',
      description: 'Feature name (defaults to active feature)',
    },
    task: {
      type: 'string',
      description: 'Task ID (folder name)',
      required: true,
    },
    summary: {
      type: 'string',
      description: 'Summary of work completed',
      required: true,
    },
  },
  async run({ args }) {
    try {
      const services = getServices();
      const featureName = requireFeature(services, args.feature, [
        'Specify --feature <name> or set active: maestro feature-active <name>',
      ]);

      // Write execution memory before done transition (best-effort)
      try {
        const existing = await services.taskPort.get(featureName, args.task);
        if (existing) {
          const sinceISO = existing.claimedAt;
          const changedFiles = await getChangedFilesSince(services.directory, sinceISO);
          const execMem = buildExecutionMemory({
            taskFolder: args.task,
            taskName: existing.name ?? args.task,
            summary: args.summary,
            verificationReport: null,
            claimedAt: existing.claimedAt,
            completedAt: new Date().toISOString(),
            revisionCount: existing.revisionCount,
            changedFiles,
          });
          services.memoryAdapter.write(featureName, execMem.fileName, execMem.content);
        }
      } catch {
        // Best-effort -- never block task completion
      }
      const task = await services.taskPort.done(featureName, args.task, args.summary);
      output(task, () => `[ok] task '${args.task}' marked done`);
    } catch (err) {
      handleCommandError('task-done', err);
    }
  },
});
