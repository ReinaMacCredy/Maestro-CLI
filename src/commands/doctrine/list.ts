/**
 * maestro doctrine-list -- list doctrine items.
 */

import { defineCommand } from 'citty';
import { getServices } from '../../services.ts';
import { output } from '../../lib/output.ts';
import { handleCommandError } from '../../lib/errors.ts';

export default defineCommand({
  meta: { name: 'doctrine-list', description: 'List doctrine items' },
  args: {
    status: {
      type: 'string',
      description: 'Filter by status (active, deprecated, proposed)',
    },
  },
  async run({ args }) {
    try {
      const { doctrinePort } = getServices();
      if (!doctrinePort) {
        console.error('[!] Doctrine port not available');
        process.exit(1);
      }
      const items = doctrinePort.list(args.status ? { status: args.status as 'active' | 'deprecated' | 'proposed' } : undefined);
      output(items, (list) => {
        if (list.length === 0) return 'No doctrine items found.';
        return list.map(i =>
          `[${i.status}] ${i.name} -- ${i.rule.slice(0, 60)}${i.rule.length > 60 ? '...' : ''} (injections: ${i.effectiveness.injectionCount})`
        ).join('\n');
      });
    } catch (err) {
      handleCommandError('doctrine-list', err);
    }
  },
});
