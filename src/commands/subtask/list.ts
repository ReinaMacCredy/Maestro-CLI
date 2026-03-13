/**
 * maestro subtask-list -- list subtasks for a parent task.
 */

import { defineCommand } from 'citty';
import { getServices } from '../../services.ts';
import { output, renderTable } from '../../lib/output.ts';
import { handleCommandError } from '../../lib/errors.ts';

export default defineCommand({
  meta: { name: 'subtask-list', description: 'List subtasks for a parent task' },
  args: {
    feature: {
      type: 'string',
      description: 'Feature name',
      required: true,
    },
    parent: {
      type: 'string',
      description: 'Parent task folder',
      required: true,
    },
  },
  async run({ args }) {
    try {
      const { taskPort } = getServices();
      const all = await taskPort.list(args.feature, { includeAll: true });
      const subtasks = all.filter(t => t.folder.startsWith(args.parent + '/') || t.folder.startsWith(args.parent + '-'));

      output(subtasks, (list) => {
        if (list.length === 0) return `No subtasks found for parent '${args.parent}'.`;
        const headers = ['Folder', 'Name', 'Status', 'Origin'];
        const rows = list.map((t: any) => [t.folder, t.name, t.status, t.origin]);
        return renderTable(headers, rows);
      });
    } catch (err) {
      handleCommandError('subtask-list', err);
    }
  },
});
