/**
 * maestro context-list -- list context files for a feature.
 */

import { defineCommand } from 'citty';
import { getServices } from '../services.ts';
import { output, renderTable } from '../lib/output.ts';
import { formatError, formatHint, MaestroError } from '../lib/errors.ts';

export default defineCommand({
  meta: { name: 'context-list', description: 'List context files' },
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
      const files = contextAdapter.list(args.feature);
      output(files, (items) => {
        if (items.length === 0) return 'No context files found.';
        const rows = items.map((f: { name: string; updatedAt: string; content: string }) => [
          f.name,
          `${f.content.length} chars`,
          f.updatedAt,
        ]);
        return renderTable(['Name', 'Size', 'Updated'], rows);
      });
    } catch (err) {
      if (err instanceof MaestroError || err instanceof Error) {
        console.error(formatError('context-list', err.message));
        if (err instanceof MaestroError) err.hints.forEach(h => console.error(formatHint(h)));
        process.exit(1);
      }
      throw err;
    }
  },
});
