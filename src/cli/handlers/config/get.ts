/**
 * maestro config-get -- get a config value by key.
 * Reads from settings (v2) first, falls back to config (legacy).
 */

import { defineCommand } from 'citty';
import { getServices } from '../../../services.ts';
import { output } from '../../../core/output.ts';
import { MaestroError, handleCommandError } from '../../../core/errors.ts';

function getNestedValue(obj: unknown, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

export default defineCommand({
  meta: { name: 'config-get', description: 'Get a config value' },
  args: {
    key: {
      type: 'string',
      description: 'Config key (e.g. dcp.enabled, tasks.backend, toolbox.deny)',
      required: true,
    },
  },
  async run({ args }) {
    try {
      const services = getServices();

      // Try settings (v2) first with dot notation
      const settings = services.settingsPort.get();
      let value = getNestedValue(settings, args.key);

      // Fall back to legacy config for unmigrated fields
      if (value === undefined) {
        const config = services.configAdapter.get();
        value = getNestedValue(config, args.key);
      }

      if (value === undefined) {
        throw new MaestroError(`key '${args.key}' not found`);
      }
      output(value, (v) => typeof v === 'object' ? JSON.stringify(v, null, 2) : String(v));
    } catch (err) {
      handleCommandError('config-get', err);
    }
  },
});
