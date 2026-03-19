/**
 * maestro task-block -- mark a task as blocked.
 */

import { defineCommand } from 'citty';
import { getServices } from '../../services.ts';
import { output } from '../../lib/output.ts';
import { handleCommandError, MaestroError } from '../../lib/errors.ts';

export default defineCommand({
  meta: { name: 'task-block', description: 'Mark a task as blocked' },
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
    reason: {
      type: 'string',
      description: 'Why the task is blocked',
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

      const task = await services.taskPort.block(featureName, args.task, args.reason);
      output(task, () => `[ok] task '${args.task}' blocked: ${args.reason}`);
    } catch (err) {
      handleCommandError('task-block', err);
    }
  },
});
