/**
 * maestro task-unblock -- unblock a blocked task.
 */

import { defineCommand } from 'citty';
import { getServices } from '../../services.ts';
import { output } from '../../lib/output.ts';
import { handleCommandError, MaestroError } from '../../lib/errors.ts';

export default defineCommand({
  meta: { name: 'task-unblock', description: 'Unblock a blocked task' },
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
    decision: {
      type: 'string',
      description: 'Decision or resolution for the blocker',
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

      const task = await services.taskPort.unblock(featureName, args.task, args.decision);
      output(task, () => `[ok] task '${args.task}' unblocked`);
    } catch (err) {
      handleCommandError('task-unblock', err);
    }
  },
});
