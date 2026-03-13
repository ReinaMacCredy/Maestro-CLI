/**
 * maestro context-delete -- delete a context file.
 */

import { defineCommand } from 'citty';
import { getServices } from '../../services.ts';
import { output } from '../../lib/output.ts';
import { formatError, handleCommandError } from '../../lib/errors.ts';

export default defineCommand({
  meta: { name: 'context-delete', description: 'Delete a context file' },
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
      const deleted = contextAdapter.delete(args.feature, args.name);
      if (!deleted) {
        console.error(formatError('context-delete', `context '${args.name}' not found for feature '${args.feature}'`));
        process.exit(1);
      }
      output(deleted, () => `[ok] context '${args.name}' deleted`);
    } catch (err) {
      handleCommandError('context-delete', err);
    }
  },
});
