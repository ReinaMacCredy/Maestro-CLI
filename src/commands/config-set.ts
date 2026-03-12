/**
 * maestro config-set -- set a config value by key.
 */

import { defineCommand } from 'citty';
import { getServices } from '../services.ts';
import { output } from '../lib/output.ts';
import { formatError, formatHint, MaestroError } from '../lib/errors.ts';

export default defineCommand({
  meta: { name: 'config-set', description: 'Set a config value' },
  args: {
    key: {
      type: 'string',
      description: 'Config key (e.g. sandbox, dockerImage)',
      required: true,
    },
    value: {
      type: 'string',
      description: 'Value to set (JSON for objects/arrays, plain string otherwise)',
      required: true,
    },
  },
  async run({ args }) {
    try {
      const { configAdapter } = getServices();

      // Try to parse as JSON for objects/arrays/booleans/numbers
      let parsed: unknown;
      try {
        parsed = JSON.parse(args.value);
      } catch {
        parsed = args.value;
      }

      const updated = configAdapter.set({ [args.key]: parsed });
      output(updated, () => `[ok] config '${args.key}' set`);
    } catch (err) {
      if (err instanceof MaestroError || err instanceof Error) {
        console.error(formatError('config-set', err.message));
        if (err instanceof MaestroError) err.hints.forEach(h => console.error(formatHint(h)));
        process.exit(1);
      }
      throw err;
    }
  },
});
