/**
 * maestro plan-revoke -- revoke plan approval.
 */

import { defineCommand } from 'citty';
import { getServices } from '../services.ts';
import { output } from '../lib/output.ts';
import { formatError, formatHint, MaestroError } from '../lib/errors.ts';

export default defineCommand({
  meta: { name: 'plan-revoke', description: 'Revoke plan approval' },
  args: {
    feature: {
      type: 'string',
      description: 'Feature name',
      required: true,
    },
  },
  async run({ args }) {
    try {
      const { planAdapter } = getServices();
      planAdapter.revokeApproval(args.feature);

      output({ feature: args.feature }, () => `[ok] plan approval revoked`);
    } catch (err) {
      if (err instanceof MaestroError || err instanceof Error) {
        console.error(formatError('plan-revoke', err.message));
        if (err instanceof MaestroError) err.hints.forEach(h => console.error(formatHint(h)));
        process.exit(1);
      }
      throw err;
    }
  },
});
