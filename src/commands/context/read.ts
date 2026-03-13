/**
 * maestro context-read -- read a context file.
 */

import { defineCommand } from 'citty';
import { getServices } from '../../services.ts';
import { output } from '../../lib/output.ts';
import { formatError, handleCommandError } from '../../lib/errors.ts';

export default defineCommand({
  meta: { name: 'context-read', description: 'Read a context file' },
  args: {
    feature: {
      type: 'string',
      description: 'Feature name',
      required: true,
    },
    name: {
      type: 'string',
      description: 'Context file name',
      required: true,
    },
  },
  async run({ args }) {
    try {
      const { contextAdapter } = getServices();
      const content = contextAdapter.read(args.feature, args.name);
      if (content === null) {
        console.error(formatError('context-read', `context '${args.name}' not found for feature '${args.feature}'`));
        process.exit(1);
      }
      output(content, (c) => c);
    } catch (err) {
      handleCommandError('context-read', err);
    }
  },
});
