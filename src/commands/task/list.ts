/**
 * maestro task-list -- list tasks for a feature.
 */

import { defineCommand } from 'citty';
import { getServices } from '../../services.ts';
import { output, renderTaskTable } from '../../lib/output.ts';
import { handleCommandError } from '../../lib/errors.ts';
import { parseStatus } from '../_task-factory.ts';

export default defineCommand({
  meta: { name: 'task-list', description: 'List tasks for a feature' },
  args: {
    feature: {
      type: 'string',
      description: 'Feature name',
      required: true,
    },
    status: {
      type: 'string',
      description: 'Filter by status',
    },
    all: {
      type: 'boolean',
      description: 'Include all tasks (including done/cancelled)',
      default: false,
    },
  },
  async run({ args }) {
    try {
      const statusFilter = args.status ? parseStatus(args.status) : undefined;
      const { taskPort } = getServices();
      const tasks = await taskPort.list(args.feature, {
        status: statusFilter,
        includeAll: args.all,
      });

      output(tasks, (list) => {
        if (list.length === 0) return 'No tasks found.';
        return renderTaskTable(list as { folder: string; name: string; status: string; origin: string }[]);
      });
    } catch (err) {
      handleCommandError('task-list', err);
    }
  },
});
