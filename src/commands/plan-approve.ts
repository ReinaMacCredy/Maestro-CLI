/**
 * maestro plan-approve -- approve feature plan.
 */

import { defineCommand } from 'citty';
import { getServices } from '../services.ts';
import { approvePlan } from '../usecases/approve-plan.ts';
import { output } from '../lib/output.ts';
import { formatError, formatHint, MaestroError } from '../lib/errors.ts';

export default defineCommand({
  meta: { name: 'plan-approve', description: 'Approve feature plan' },
  args: {
    feature: {
      type: 'string',
      description: 'Feature name',
      required: true,
    },
  },
  async run({ args }) {
    try {
      const { planAdapter, featureAdapter } = getServices();
      const result = await approvePlan(planAdapter, featureAdapter, args.feature);
      output(result, () => `[ok] plan approved for '${args.feature}'`);
    } catch (err) {
      if (err instanceof MaestroError) {
        console.error(formatError('plan-approve', err.message));
        err.hints.forEach(h => console.error(formatHint(h)));
        process.exit(1);
      }
      throw err;
    }
  },
});
