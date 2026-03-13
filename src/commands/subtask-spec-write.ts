/**
 * maestro subtask-spec-write -- write a subtask's spec.
 */

import { defineCommand } from 'citty';
import { getServices } from '../services.ts';
import { output } from '../lib/output.ts';
import { handleCommandError } from '../lib/errors.ts';

export default defineCommand({
  meta: { name: 'subtask-spec-write', description: 'Write subtask spec' },
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
    content: {
      type: 'string',
      description: 'Spec content',
      required: true,
    },
  },
  async run({ args }) {
    try {
      const { taskPort } = getServices();
      await taskPort.writeSpec(args.feature, args.task, args.content);

      output({ task: args.task }, () =>
        `[ok] spec written for subtask '${args.task}'`,
      );
    } catch (err) {
      handleCommandError('subtask-spec-write', err);
    }
  },
});
