/**
 * maestro memory-write -- write a memory file for a feature.
 */

import { defineCommand } from 'citty';
import { getServices } from '../../services.ts';
import { output } from '../../lib/output.ts';
import { handleCommandError } from '../../lib/errors.ts';
import { serializeFrontmatter } from '../../utils/frontmatter.ts';

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
    tags: {
      type: 'string',
      description: 'Comma-separated tags for DCP relevance scoring',
    },
    priority: {
      type: 'string',
      description: 'Priority 0 (highest) to 4 (lowest), default 2',
    },
    category: {
      type: 'string',
      description: 'Category: decision, research, architecture, convention, debug',
    },
  },
  async run({ args }) {
    try {
      const { memoryAdapter } = getServices();

      // Prepend frontmatter if metadata args provided
      let finalContent = args.content;
      const meta: Record<string, unknown> = {};
      if (args.tags) meta.tags = args.tags.split(',').map(t => t.trim());
      if (args.priority !== undefined) meta.priority = Number(args.priority);
      if (args.category) meta.category = args.category;
      if (Object.keys(meta).length > 0) {
        finalContent = serializeFrontmatter(meta) + '\n' + args.content;
      }

      const result = args.global
        ? memoryAdapter.writeGlobal(args.name, finalContent)
        : memoryAdapter.write(args.feature, args.name, finalContent);
      output(result, (r) => `[ok] memory written --> ${r}`);
    } catch (err) {
      handleCommandError('memory-write', err);
    }
  },
});
