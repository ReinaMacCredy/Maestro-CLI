/**
 * maestro config-get -- get a config value by key.
 */

import { defineCommand } from 'citty';
import { getServices } from '../../services.ts';
import { output } from '../../lib/output.ts';
import { MaestroError, handleCommandError } from '../../lib/errors.ts';

export default defineCommand({
  meta: { name: 'config-get', description: 'Get a config value' },
  args: {
    key: {
      type: 'string',
      description: 'Config key (e.g. sandbox, dockerImage)',
      required: true,
    },
  },
  async run({ args }) {
    try {
      const { configAdapter } = getServices();
      const config = configAdapter.get();
      const value = (config as unknown as Record<string, unknown>)[args.key];
      if (value === undefined) {
        throw new MaestroError(`key '${args.key}' not found`);
      }
      output(value, (v) => typeof v === 'object' ? JSON.stringify(v, null, 2) : String(v));
    } catch (err) {
      handleCommandError('config-get', err);
    }
  },
});
