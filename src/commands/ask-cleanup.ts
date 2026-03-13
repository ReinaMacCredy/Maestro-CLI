/**
 * maestro ask-cleanup -- cleanup a resolved ask.
 */

import { defineCommand } from 'citty';
import { getServices } from '../services.ts';
import { output } from '../lib/output.ts';
import { handleCommandError } from '../lib/errors.ts';

export default defineCommand({
  meta: { name: 'ask-cleanup', description: 'Cleanup a resolved ask' },
  args: {
    feature: {
      type: 'string',
      description: 'Feature name',
      required: true,
    },
    id: {
      type: 'string',
      description: 'Ask ID to cleanup',
      required: true,
    },
  },
  async run({ args }) {
    try {
      const { askAdapter } = getServices();
      askAdapter.cleanup(args.feature, args.id);
      output({ id: args.id, cleaned: true }, () => `[ok] ask '${args.id}' cleaned up`);
    } catch (err) {
      handleCommandError('ask-cleanup', err);
    }
  },
});
