/**
 * maestro task-done -- mark a task as complete.
 */

import { defineCommand } from 'citty';
import { getServices } from '../../services.ts';
import { output } from '../../lib/output.ts';
import { handleCommandError, MaestroError } from '../../lib/errors.ts';

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
      let featureName: string | undefined = args.feature;
      if (!featureName) {
        const active = services.featureAdapter.getActive();
        featureName = active?.name;
      }
      if (!featureName) {
        throw new MaestroError('No feature specified and no active feature set', [
          'Specify --feature <name> or set active: maestro feature-active <name>',
        ]);
      }

      const task = await services.taskPort.done(featureName, args.task, args.summary);
      output(task, () => `[ok] task '${args.task}' marked done`);
    } catch (err) {
      handleCommandError('task-done', err);
    }
  },
});
