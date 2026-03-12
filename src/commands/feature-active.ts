/**
 * maestro feature-active -- show or set the active feature.
 */

import { defineCommand } from 'citty';
import { getServices } from '../services.ts';
import { output } from '../lib/output.ts';
import { renderStatusLine } from '../lib/output.ts';
import { formatError, formatHint, MaestroError } from '../lib/errors.ts';

export default defineCommand({
  meta: { name: 'feature-active', description: 'Show or set active feature' },
  args: {
    name: {
      type: 'positional',
      description: 'Feature name (auto-detected, no-op if provided)',
      required: false,
    },
  },
  async run() {
    try {
      const { featureAdapter } = getServices();
      const active = featureAdapter.getActive();

      output(active, (f) => {
        if (!f) return 'No active feature.';
        return [
          renderStatusLine('Active feature', f.name),
          renderStatusLine('Status', f.status),
        ].join('\n');
      });
    } catch (err) {
      if (err instanceof MaestroError || err instanceof Error) {
        console.error(formatError('feature-active', err.message));
        if (err instanceof MaestroError) err.hints.forEach((h) => console.error(formatHint(h)));
        process.exit(1);
      }
      throw err;
    }
  },
});
