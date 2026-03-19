/**
 * maestro task-claim -- claim a task for an agent.
 */

import { defineCommand } from 'citty';
import { getServices } from '../../services.ts';
import { output } from '../../lib/output.ts';
import { handleCommandError, MaestroError } from '../../lib/errors.ts';

export default defineCommand({
  meta: { name: 'task-claim', description: 'Claim a task for an agent' },
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
    agentId: {
      type: 'string',
      description: 'Agent identifier claiming this task',
      required: true,
      alias: 'agent-id',
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

      const task = await services.taskPort.claim(featureName, args.task, args.agentId);
      output(task, () => `[ok] claimed '${args.task}' for agent '${args.agentId}'`);
    } catch (err) {
      handleCommandError('task-claim', err);
    }
  },
});
