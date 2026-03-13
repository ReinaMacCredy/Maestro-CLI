/**
 * maestro task-sync -- sync tasks from approved plan.
 */

import { defineCommand } from 'citty';
import { getServices } from '../services.ts';
import { syncPlan } from '../usecases/sync-plan.ts';
import { output } from '../lib/output.ts';
import { handleCommandError } from '../lib/errors.ts';

export default defineCommand({
  meta: { name: 'task-sync', description: 'Sync tasks from approved plan' },
  args: {
    feature: {
      type: 'string',
      description: 'Feature name',
      required: true,
    },
  },
  async run({ args }) {
    try {
      const services = getServices();
      const result = await syncPlan(services, args.feature);

      output(result, (r) => {
        const lines = [`[ok] tasks synced for '${args.feature}'`];
        if (r.created.length > 0) lines.push(`  created: ${r.created.join(', ')}`);
        if (r.removed.length > 0) lines.push(`  removed: ${r.removed.join(', ')}`);
        if (r.kept.length > 0) lines.push(`  kept: ${r.kept.join(', ')}`);
        if (r.manual.length > 0) lines.push(`  manual (untouched): ${r.manual.join(', ')}`);
        return lines.join('\n');
      });
    } catch (err) {
      handleCommandError('task-sync', err);
    }
  },
});
