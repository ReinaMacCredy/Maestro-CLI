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
      description: 'Feature name (required unless --global)',
    },
    name: {
      type: 'string',
      description: 'Memory file name',
      required: true,
    },
    global: {
      type: 'boolean',
      description: 'Delete from global project memory',
      default: false,
    },
  },
  async run({ args }) {
    try {
      const { memoryAdapter } = getServices();

      let deleted: boolean;
      if (args.global) {
        deleted = memoryAdapter.deleteGlobal(args.name);
      } else {
        if (!args.feature) {
          console.error(formatError('memory-delete', 'Missing --feature (required unless --global)'));
          process.exit(1);
        }
        deleted = memoryAdapter.delete(args.feature, args.name);
      }

      if (!deleted) {
        const scope = args.global ? 'global memory' : `feature '${args.feature}'`;
        console.error(formatError('memory-delete', `memory '${args.name}' not found in ${scope}`));
        process.exit(1);
      }
      output(deleted, () => `[ok] memory '${args.name}' deleted`);
    } catch (err) {
      handleCommandError('memory-delete', err);
    }
  },
});
