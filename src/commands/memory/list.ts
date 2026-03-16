/**
 * maestro memory-list -- list memory files for a feature.
 */

import { defineCommand } from 'citty';
import { getServices } from '../../services.ts';
import { output, renderTable } from '../../lib/output.ts';
import { handleCommandError } from '../../lib/errors.ts';

export default defineCommand({
  meta: { name: 'memory-list', description: 'List memory files' },
  args: {
    feature: {
      type: 'string',
      description: 'Feature name',
      required: true,
    },
  },
  async run({ args }) {
    try {
      const { memoryAdapter } = getServices();
      const files = memoryAdapter.list(args.feature);
      output(files, (items) => {
        if (items.length === 0) return 'No memory files found.';
        const rows = items.map((f: { name: string; updatedAt: string; content: string }) => [
          f.name,
          `${f.content.length} chars`,
          f.updatedAt,
        ]);
        return renderTable(['Name', 'Size', 'Updated'], rows);
      });
    } catch (err) {
      handleCommandError('memory-list', err);
    }
  },
});
