/**
 * maestro context-list -- list context files for a feature.
 */

import { defineCommand } from 'citty';
import { getServices } from '../../services.ts';
import { output, renderTable } from '../../lib/output.ts';
import { handleCommandError } from '../../lib/errors.ts';

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
      handleCommandError('context-list', err);
    }
  },
});
