/**
 * maestro task-create -- create a new task.
 */

import { defineCommand } from 'citty';
import { getServices } from '../services.ts';
import { output } from '../lib/output.ts';
import { handleCommandError } from '../lib/errors.ts';

export default defineCommand({
  meta: { name: 'task-create', description: 'Create a new task' },
  args: {
    feature: {
      type: 'string',
      description: 'Feature name',
      required: true,
    },
    name: {
      type: 'string',
      description: 'Task name',
      required: true,
    },
    description: {
      type: 'string',
      description: 'Task description',
    },
    deps: {
      type: 'string',
      description: 'Comma-separated dependency task IDs',
    },
  },
  async run({ args }) {
    try {
      const { taskPort } = getServices();
      const result = await taskPort.create(args.feature, args.name, {
        description: args.description,
        deps: args.deps?.split(','),
      });

      output(result, (r) =>
        `[ok] task created: ${r.folder} (${r.name})`,
      );
    } catch (err) {
      handleCommandError('task-create', err);
    }
  },
});
