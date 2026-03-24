/**
 * maestro toolbox-list -- list all registered tools with status.
 * This is the default/parent toolbox command.
 */

import { defineCommand } from 'citty';
import { getServices } from '../../../services.ts';
import { output } from '../../../core/output.ts';
import { handleCommandError } from '../../../core/errors.ts';

export default defineCommand({
  meta: { name: 'toolbox-list', description: 'List all registered tools with status and transport' },
  args: {},
  async run() {
    try {
      const { toolbox } = getServices();
      const statuses = toolbox.getStatus();

      const data = statuses.map((s) => ({
        name: s.manifest.name,
        transport: s.transport,
        status: s.settingsState === 'denied'
          ? 'denied'
          : s.installed ? 'installed' : 'missing',
        version: s.version ?? null,
        provides: s.manifest.provides,
        priority: s.manifest.priority,
        description: s.manifest.description ?? null,
      }));

      output(data, (tools) => {
        const lines = ['[toolbox] Registered tools:\n'];
        for (const t of tools) {
          const status = t.status === 'installed' ? '[ok]' : t.status === 'denied' ? '[x]' : '[!]';
          const ver = t.version ? ` (${t.version})` : '';
          const port = t.provides ? ` --> ${t.provides}` : '';
          lines.push(`  ${status} ${t.name}  [${t.transport}]${ver}${port}`);
          if (t.description) lines.push(`      ${t.description}`);
        }
        return lines.join('\n');
      });
    } catch (err) {
      handleCommandError('toolbox-list', err);
    }
  },
});
