/**
 * maestro handoff-receive -- check for pending handoffs.
 */

import { defineCommand } from 'citty';
import { getServices } from '../../services.ts';
import { output } from '../../lib/output.ts';
import { handleCommandError, MaestroError } from '../../lib/errors.ts';
import { requireFeature } from '../../lib/resolve.ts';

export default defineCommand({
  meta: { name: 'handoff-receive', description: 'Check for pending handoffs' },
  args: {
    feature: {
      type: 'string',
      description: 'Feature name (defaults to active feature)',
    },
    agentId: {
      type: 'string',
      description: 'Agent identifier to check handoffs for',
      required: true,
      alias: 'agent-id',
    },
  },
  async run({ args }) {
    try {
      const services = getServices();
      if (!services.handoffPort) {
        throw new MaestroError('Agent Mail not available', ['Start Agent Mail server or check AGENT_MAIL_URL']);
      }

      const featureName = requireFeature(services, args.feature, [
        'Specify --feature <name> or set active: maestro feature-active <name>',
      ]);

      const handoffs = await services.handoffPort.receiveHandoffs(featureName, args.agentId);

      output({ handoffs }, () => {
        if (handoffs.length === 0) return 'No pending handoffs.';
        return handoffs
          .map((h) => `- ${h.beadId}: ${h.beadState.title} [${h.beadState.status}]`)
          .join('\n');
      });
    } catch (err) {
      handleCommandError('handoff-receive', err);
    }
  },
});
