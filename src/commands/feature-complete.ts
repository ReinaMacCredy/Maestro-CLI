/**
 * maestro feature-complete -- mark feature as completed.
 */

import { defineCommand } from 'citty';
import { getServices } from '../services.ts';
import { completeFeature } from '../usecases/complete-feature.ts';
import { output } from '../lib/output.ts';
import { handleCommandError } from '../lib/errors.ts';

export default defineCommand({
  meta: { name: 'feature-complete', description: 'Mark feature as completed' },
  args: {
    feature: {
      type: 'string',
      description: 'Feature name',
      required: true,
    },
  },
  async run({ args }) {
    try {
      const { taskPort, featureAdapter } = getServices();
      const result = await completeFeature(taskPort, featureAdapter, args.feature);

      output(result, (r) => {
        const { total, done, cancelled } = r.tasksSummary;
        return `[ok] feature '${args.feature}' completed (${done} done, ${cancelled} cancelled, ${total} total)`;
      });
    } catch (err) {
      handleCommandError('feature-complete', err);
    }
  },
});
