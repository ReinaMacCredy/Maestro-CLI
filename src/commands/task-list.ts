/**
 * maestro task-list -- list tasks for a feature.
 */

import { defineCommand } from 'citty';
import { getServices } from '../services.ts';
import { output, renderTable } from '../lib/output.ts';
import { formatError, formatHint, MaestroError } from '../lib/errors.ts';
import type { TaskStatusType } from '../types.ts';

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
      const { taskPort } = getServices();
      const tasks = await taskPort.list(args.feature, {
        status: args.status as TaskStatusType | undefined,
        includeAll: args.all,
      });

      output(tasks, (list) => {
        if (list.length === 0) return 'No tasks found.';
        const headers = ['Folder', 'Name', 'Status', 'Origin'];
        const rows = list.map((t: any) => [t.folder, t.name, t.status, t.origin]);
        return renderTable(headers, rows);
      });
    } catch (err) {
      if (err instanceof MaestroError || err instanceof Error) {
        console.error(formatError('task-list', err.message));
        if (err instanceof MaestroError) err.hints.forEach(h => console.error(formatHint(h)));
        process.exit(1);
      }
      throw err;
    }
  },
});
