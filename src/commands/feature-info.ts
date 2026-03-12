/**
 * maestro feature-info -- show feature details.
 */

import { defineCommand } from 'citty';
import { getServices } from '../services.ts';
import { output } from '../lib/output.ts';
import { renderStatusLine } from '../lib/output.ts';
import { formatError, formatHint, MaestroError } from '../lib/errors.ts';

export default defineCommand({
  meta: { name: 'feature-info', description: 'Show feature details' },
  args: {
    feature: {
      type: 'string',
      description: 'Feature name',
      required: true,
    },
  },
  async run({ args }) {
    try {
      const { featureAdapter } = getServices();
      const info = featureAdapter.getInfo(args.feature);

      if (!info) {
        console.error(formatError('feature-info', `Feature '${args.feature}' not found`));
        process.exit(1);
      }

      output(info, (i) =>
        [
          renderStatusLine('Name', i.name),
          renderStatusLine('Status', i.status),
          renderStatusLine('Has plan', String(i.hasPlan)),
          renderStatusLine('Comments', String(i.commentCount)),
        ].join('\n'),
      );
    } catch (err) {
      if (err instanceof MaestroError || err instanceof Error) {
        console.error(formatError('feature-info', err.message));
        if (err instanceof MaestroError) err.hints.forEach((h) => console.error(formatHint(h)));
        process.exit(1);
      }
      throw err;
    }
  },
});
