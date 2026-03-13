/**
 * maestro plan-revoke -- revoke plan approval.
 */

import { defineCommand } from 'citty';
import { getServices } from '../services.ts';
import { output } from '../lib/output.ts';
import { handleCommandError } from '../lib/errors.ts';

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
      handleCommandError('plan-revoke', err);
    }
  },
});
