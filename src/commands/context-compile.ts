/**
 * maestro context-compile -- compile all context into a single string.
 */

import { defineCommand } from 'citty';
import { getServices } from '../services.ts';
import { output } from '../lib/output.ts';
import { formatError, handleCommandError } from '../lib/errors.ts';

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
      handleCommandError('context-compile', err);
    }
  },
});
