/**
 * maestro ask-cleanup -- cleanup a resolved ask.
 */

import { defineCommand } from 'citty';
import { getServices } from '../services.ts';
import { output } from '../lib/output.ts';
import { resolveFeature } from '../lib/resolve-feature.ts';
import { handleCommandError } from '../lib/errors.ts';

export default defineCommand({
  meta: { name: 'ask-cleanup', description: 'Cleanup a resolved ask' },
  args: {
    id: {
      type: 'string',
      description: 'Ask ID to cleanup',
      required: true,
    },
    feature: {
      type: 'string',
      description: 'Feature name (auto-resolved if omitted)',
    },
  },
  async run({ args }) {
    try {
      const feature = resolveFeature(args.feature);
      const { askAdapter } = getServices();
      askAdapter.cleanup(feature, args.id);
      output({ id: args.id, cleaned: true }, () => `[ok] ask '${args.id}' cleaned up`);
    } catch (err) {
      handleCommandError('ask-cleanup', err);
    }
  },
});
