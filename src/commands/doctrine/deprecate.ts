/**
 * maestro doctrine-deprecate -- deprecate a doctrine item.
 */

import { defineCommand } from 'citty';
import { getServices } from '../../services.ts';
import { output } from '../../lib/output.ts';
import { handleCommandError } from '../../lib/errors.ts';

export default defineCommand({
  meta: { name: 'doctrine-deprecate', description: 'Deprecate a doctrine item' },
  args: {
    name: {
      type: 'string',
      description: 'Doctrine item name',
      required: true,
    },
  },
  async run({ args }) {
    try {
      const { doctrinePort } = getServices();
      if (!doctrinePort) {
        console.error('[!] Doctrine port not available');
        process.exit(1);
      }
      const item = doctrinePort.deprecate(args.name);
      output({ name: item.name, status: item.status }, () =>
        `[ok] doctrine '${item.name}' deprecated`,
      );
    } catch (err) {
      handleCommandError('doctrine-deprecate', err);
    }
  },
});
