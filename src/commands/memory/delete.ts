/**
 * maestro memory-delete -- delete a memory file.
 */

import { defineCommand } from 'citty';
import { getServices } from '../../services.ts';
import { output } from '../../lib/output.ts';
import { formatError, handleCommandError } from '../../lib/errors.ts';

export default defineCommand({
  meta: { name: 'memory-delete', description: 'Delete a memory file' },
  args: {
    feature: {
      type: 'string',
      description: 'Feature name',
      required: true,
    },
    name: {
      type: 'string',
      description: 'Memory file name',
      required: true,
    },
  },
  async run({ args }) {
    try {
      const { memoryAdapter } = getServices();
      const deleted = memoryAdapter.delete(args.feature, args.name);
      if (!deleted) {
        console.error(formatError('memory-delete', `memory '${args.name}' not found for feature '${args.feature}'`));
        process.exit(1);
      }
      output(deleted, () => `[ok] memory '${args.name}' deleted`);
    } catch (err) {
      handleCommandError('memory-delete', err);
    }
  },
});
