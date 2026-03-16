/**
 * maestro memory-compile -- compile all memory into a single string.
 */

import { defineCommand } from 'citty';
import { getServices } from '../../services.ts';
import { output } from '../../lib/output.ts';
import { formatError, handleCommandError } from '../../lib/errors.ts';

export default defineCommand({
  meta: { name: 'memory-compile', description: 'Compile all memory into single string' },
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
      const compiled = memoryAdapter.compile(args.feature);
      if (!compiled) {
        console.error(formatError('memory-compile', `no memory files for feature '${args.feature}'`));
        process.exit(1);
      }
      output(compiled, (c) => c);
    } catch (err) {
      handleCommandError('memory-compile', err);
    }
  },
});
