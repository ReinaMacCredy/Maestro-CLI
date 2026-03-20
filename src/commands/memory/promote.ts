/**
 * maestro memory-promote -- promote feature memory to global.
 */

import { defineCommand } from 'citty';
import { getServices } from '../../services.ts';
import { output } from '../../lib/output.ts';
import { formatError, handleCommandError } from '../../lib/errors.ts';
import { requireFeature } from '../../lib/resolve.ts';

export default defineCommand({
  meta: { name: 'memory-promote', description: 'Promote feature memory to global' },
  args: {
    feature: {
      type: 'string',
      description: 'Feature name (defaults to active feature)',
    },
    name: {
      type: 'string',
      description: 'Memory file name to promote',
      required: true,
    },
  },
  async run({ args }) {
    try {
      const services = getServices();
      const featureName = requireFeature(services, args.feature, [
        'Specify --feature <name> or set active: maestro feature-active <name>',
      ]);

      const content = services.memoryAdapter.read(featureName, args.name);
      if (!content) {
        console.error(formatError('memory-promote', `memory '${args.name}' not found in feature '${featureName}'`));
        process.exit(1);
      }

      const promotedTo = services.memoryAdapter.writeGlobal(args.name, content);

      output({ feature: featureName, name: args.name, promotedTo }, () =>
        `[ok] promoted '${args.name}' to global memory`,
      );
    } catch (err) {
      handleCommandError('memory-promote', err);
    }
  },
});
