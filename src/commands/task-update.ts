/**
 * maestro task-update -- update a task's status or notes.
 */

import { defineCommand } from 'citty';
import { getServices } from '../services.ts';
import { output } from '../lib/output.ts';
import { handleCommandError } from '../lib/errors.ts';
import type { TaskStatusType } from '../types.ts';

export default defineCommand({
  meta: { name: 'task-update', description: 'Update task status or notes' },
  args: {
    feature: {
      type: 'string',
      description: 'Feature name',
      required: true,
    },
    task: {
      type: 'string',
      description: 'Task ID (folder name)',
      required: true,
    },
    status: {
      type: 'string',
      description: 'New status',
    },
    notes: {
      type: 'string',
      description: 'Notes to add',
    },
  },
  async run({ args }) {
    try {
      const { taskPort } = getServices();
      const result = await taskPort.update(args.feature, args.task, {
        status: args.status as TaskStatusType | undefined,
        notes: args.notes,
      });

      output(result, (r) =>
        `[ok] task updated: ${r.folder} --> status=${r.status}`,
      );
    } catch (err) {
      handleCommandError('task-update', err);
    }
  },
});
