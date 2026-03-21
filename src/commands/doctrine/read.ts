/**
 * maestro doctrine-read -- read a doctrine item.
 */

import { defineCommand } from 'citty';
import { getServices } from '../../services.ts';
import { output } from '../../lib/output.ts';
import { formatError, handleCommandError } from '../../lib/errors.ts';

export default defineCommand({
  meta: { name: 'doctrine-read', description: 'Read a doctrine item' },
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
      const item = doctrinePort.read(args.name);
      if (!item) {
        console.error(formatError('doctrine-read', `doctrine '${args.name}' not found`));
        process.exit(1);
      }
      output(item, (i) => [
        `Name: ${i.name}`,
        `Status: ${i.status}`,
        `Rule: ${i.rule}`,
        `Rationale: ${i.rationale}`,
        `Tags: ${i.tags.join(', ') || '(none)'}`,
        `Injections: ${i.effectiveness.injectionCount}`,
        `Success rate: ${(i.effectiveness.associatedSuccessRate * 100).toFixed(0)}%`,
      ].join('\n'));
    } catch (err) {
      handleCommandError('doctrine-read', err);
    }
  },
});
