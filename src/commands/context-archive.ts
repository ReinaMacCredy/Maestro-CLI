/**
 * maestro context-archive -- archive all context files for a feature.
 */

import { defineCommand } from 'citty';
import { getServices } from '../services.ts';
import { output } from '../lib/output.ts';
import { formatError, formatHint, MaestroError } from '../lib/errors.ts';

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
      if (err instanceof MaestroError || err instanceof Error) {
        console.error(formatError('context-archive', err.message));
        if (err instanceof MaestroError) err.hints.forEach(h => console.error(formatHint(h)));
        process.exit(1);
      }
      throw err;
    }
  },
});
