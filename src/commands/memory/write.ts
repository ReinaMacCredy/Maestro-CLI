/**
 * maestro memory-write -- write a memory file for a feature.
 */

import { defineCommand } from 'citty';
import { getServices } from '../../services.ts';
import { output } from '../../lib/output.ts';
import { handleCommandError } from '../../lib/errors.ts';

export default defineCommand({
  meta: { name: 'memory-write', description: 'Write a memory file' },
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
    content: {
      type: 'string',
      description: 'Content to write',
      required: true,
    },
    global: {
      type: 'boolean',
      description: 'Write to global project memory instead of feature memory',
      default: false,
    },
  },
  async run({ args }) {
    try {
      const { memoryAdapter } = getServices();
      const result = args.global
        ? memoryAdapter.writeGlobal(args.name, args.content)
        : memoryAdapter.write(args.feature, args.name, args.content);
      output(result, (r) => `[ok] memory written --> ${r}`);
    } catch (err) {
      handleCommandError('memory-write', err);
    }
  },
});
