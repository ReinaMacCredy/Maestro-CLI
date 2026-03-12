/**
 * maestro subtask-update -- update a subtask's status or notes.
 */

import { defineCommand } from 'citty';
import { getServices } from '../services.ts';
import { output } from '../lib/output.ts';
import { formatError, formatHint, MaestroError } from '../lib/errors.ts';
import type { TaskStatusType } from '../types.ts';

export default defineCommand({
  meta: { name: 'subtask-update', description: 'Update subtask status or notes' },
  args: {
    feature: {
      type: 'string',
      description: 'Feature name',
      required: true,
    },
    task: {
      type: 'string',
      description: 'Subtask ID (folder name)',
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
        `[ok] subtask updated: ${r.folder} --> status=${r.status}`,
      );
    } catch (err) {
      if (err instanceof MaestroError || err instanceof Error) {
        console.error(formatError('subtask-update', err.message));
        if (err instanceof MaestroError) err.hints.forEach(h => console.error(formatHint(h)));
        process.exit(1);
      }
      throw err;
    }
  },
});
