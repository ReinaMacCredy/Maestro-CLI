/**
 * maestro context-archive -- archive all context files for a feature.
 */

import { defineCommand } from 'citty';
import { getServices } from '../services.ts';
import { output } from '../lib/output.ts';
import { handleCommandError } from '../lib/errors.ts';

export default defineCommand({
  meta: { name: 'context-archive', description: 'Archive context files' },
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
      const result = contextAdapter.archive(args.feature);
      output(result, (r) => {
        if (r.archived.length === 0) return 'No context files to archive.';
        return `[ok] archived ${r.archived.length} file(s) --> ${r.archivePath}\n` +
          r.archived.map((name: string) => `  - ${name}`).join('\n');
      });
    } catch (err) {
      handleCommandError('context-archive', err);
    }
  },
});
