/**
 * maestro context-compile -- compile all context into a single string.
 */

import { defineCommand } from 'citty';
import { getServices } from '../services.ts';
import { output } from '../lib/output.ts';
import { formatError, formatHint, MaestroError } from '../lib/errors.ts';

export default defineCommand({
  meta: { name: 'context-compile', description: 'Compile all context into single string' },
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
      const compiled = contextAdapter.compile(args.feature);
      if (!compiled) {
        console.error(formatError('context-compile', `no context files for feature '${args.feature}'`));
        process.exit(1);
      }
      output(compiled, (c) => c);
    } catch (err) {
      if (err instanceof MaestroError || err instanceof Error) {
        console.error(formatError('context-compile', err.message));
        if (err instanceof MaestroError) err.hints.forEach(h => console.error(formatHint(h)));
        process.exit(1);
      }
      throw err;
    }
  },
});
