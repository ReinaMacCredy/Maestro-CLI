/**
 * maestro context-stats -- show context stats for a feature.
 */

import { defineCommand } from 'citty';
import { getServices } from '../services.ts';
import { output } from '../lib/output.ts';
import { formatError, formatHint, MaestroError } from '../lib/errors.ts';

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
          `chars:  ${s.totalChars}`,
        ];
        if (s.oldest) lines.push(`oldest: ${s.oldest}`);
        if (s.newest) lines.push(`newest: ${s.newest}`);
        return lines.join('\n');
      });
    } catch (err) {
      if (err instanceof MaestroError || err instanceof Error) {
        console.error(formatError('context-stats', err.message));
        if (err instanceof MaestroError) err.hints.forEach(h => console.error(formatHint(h)));
        process.exit(1);
      }
      throw err;
    }
  },
});
