/**
 * maestro handoff-ack -- acknowledge a handoff.
 */

import { defineCommand } from 'citty';
import { getServices } from '../../services.ts';
import { output } from '../../lib/output.ts';
import { handleCommandError, MaestroError } from '../../lib/errors.ts';

export default defineCommand({
  meta: { name: 'handoff-ack', description: 'Acknowledge a handoff' },
  args: {
    threadId: {
      type: 'string',
      description: 'Agent Mail thread ID to acknowledge',
      required: true,
      alias: 'thread-id',
    },
  },
  async run({ args }) {
    try {
      const services = getServices();
      if (!services.handoffPort) {
        throw new MaestroError('Agent Mail not available', ['Start Agent Mail server or check AGENT_MAIL_URL']);
      }

      await services.handoffPort.acknowledgeHandoff(args.threadId);

      output({ threadId: args.threadId }, () =>
        `[ok] acknowledged thread '${args.threadId}'`,
      );
    } catch (err) {
      handleCommandError('handoff-ack', err);
    }
  },
});
