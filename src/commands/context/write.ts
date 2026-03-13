/**
 * maestro context-write -- write a context file for a feature.
 */

import { defineCommand } from 'citty';
import { getServices } from '../../services.ts';
import { output } from '../../lib/output.ts';
import { handleCommandError } from '../../lib/errors.ts';

export default defineCommand({
  meta: { name: 'context-write', description: 'Write a context file' },
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
    content: {
      type: 'string',
      description: 'Content to write',
      required: true,
    },
  },
  async run({ args }) {
    try {
      const { contextAdapter } = getServices();
      const result = contextAdapter.write(args.feature, args.name, args.content);
      output(result, (r) => `[ok] context written --> ${r}`);
    } catch (err) {
      handleCommandError('context-write', err);
    }
  },
});
