/**
 * maestro feature-create -- create a new feature.
 */

import { defineCommand } from 'citty';
import { getServices } from '../services.ts';
import { output } from '../lib/output.ts';
import { formatError, formatHint, MaestroError } from '../lib/errors.ts';

export default defineCommand({
  meta: { name: 'feature-create', description: 'Create a new feature' },
  args: {
    name: {
      type: 'positional',
      description: 'Feature name',
      required: true,
    },
    ticket: {
      type: 'string',
      description: 'Associated ticket ID',
    },
  },
  async run({ args }) {
    try {
      const { featureAdapter } = getServices();
      const feature = featureAdapter.create(args.name, args.ticket);
      output(feature, (f) => `[ok] feature '${f.name}' created [${f.status}]`);
    } catch (err) {
      if (err instanceof MaestroError || err instanceof Error) {
        const isMaestro = err instanceof MaestroError;
        console.error(formatError('feature-create', err.message));
        if (isMaestro) err.hints.forEach(h => console.error(formatHint(h)));
        process.exit(1);
      }
      throw err;
    }
  },
});
