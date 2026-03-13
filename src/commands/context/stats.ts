/**
 * maestro context-stats -- show context stats for a feature.
 */

import { defineCommand } from 'citty';
import { getServices } from '../../services.ts';
import { output } from '../../lib/output.ts';
import { handleCommandError } from '../../lib/errors.ts';

export default defineCommand({
  meta: { name: 'context-stats', description: 'Show context stats' },
  args: {
    feature: {
      type: 'string',
      description: 'Feature name',
      required: true,
    },
  },
  async run({ args }) {
    try {
      const { contextAdapter } = getServices();
      const stats = contextAdapter.stats(args.feature);
      output(stats, (s) => {
        const lines = [
          `files:  ${s.count}`,
          `bytes:  ${s.totalBytes}`,
        ];
        if (s.oldest) lines.push(`oldest: ${s.oldest}`);
        if (s.newest) lines.push(`newest: ${s.newest}`);
        return lines.join('\n');
      });
    } catch (err) {
      handleCommandError('context-stats', err);
    }
  },
});
