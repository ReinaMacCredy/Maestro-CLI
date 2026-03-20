/**
 * MCP tools for cross-agent handoff via Agent Mail.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ServicesThunk } from './_utils/services-thunk.ts';
import { respond, withErrorHandling } from './_utils/respond.ts';
import { ANNOTATIONS_READONLY, ANNOTATIONS_MUTATING } from './_utils/annotations.ts';
import { requireFeature } from './_utils/resolve.ts';
import { featureParam } from './_utils/params.ts';
import { MaestroError } from '../lib/errors.ts';

export function registerHandoffTools(server: McpServer, thunk: ServicesThunk): void {
  server.registerTool(
    'maestro_handoff_send',
    {
      description: 'Send handoff document to another agent via Agent Mail.',
      inputSchema: {
        feature: featureParam(),
        task: z.string().describe('Task/bead ID or folder name'),
        target_agent: z.string().optional().describe('Target agent name (omit for broadcast)'),
        additional_context: z.string().optional().describe('Extra context to include'),
      },
      annotations: ANNOTATIONS_MUTATING,
    },
    withErrorHandling(async (input) => {
      const services = thunk.get();
      if (!services.handoffPort) {
        throw new MaestroError('Agent Mail not available', ['Start Agent Mail server or check AGENT_MAIL_URL']);
      }
      const feature = requireFeature(services, input.feature);
      const handoff = await services.handoffPort.buildHandoff(feature, input.task);
      if (input.additional_context) {
        handoff.criticalContext = input.additional_context;
      }
      const result = await services.handoffPort.sendHandoff(feature, handoff, input.target_agent);
      return respond({ feature, task: input.task, ...result });
    }),
  );

  server.registerTool(
    'maestro_handoff_receive',
    {
      description:
        'Check for pending handoffs addressed to this agent via Agent Mail.',
      inputSchema: {
        agent_id: z.string().describe('Your agent name/ID'),
      },
      annotations: ANNOTATIONS_READONLY,
    },
    withErrorHandling(async (input) => {
      const services = thunk.get();
      if (!services.handoffPort) {
        throw new MaestroError('Agent Mail not available', ['Start Agent Mail server or check AGENT_MAIL_URL']);
      }
      const feature = requireFeature(services, undefined);
      const handoffs = await services.handoffPort.receiveHandoffs(feature, input.agent_id);
      return respond({ handoffs });
    }),
  );

  server.registerTool(
    'maestro_handoff_ack',
    {
      description: 'Acknowledge receipt of a handoff message.',
      inputSchema: {
        thread_id: z.string().describe('Thread ID of the handoff to acknowledge'),
      },
      annotations: ANNOTATIONS_MUTATING,
    },
    withErrorHandling(async (input) => {
      const services = thunk.get();
      if (!services.handoffPort) {
        throw new MaestroError('Agent Mail not available', ['Start Agent Mail server or check AGENT_MAIL_URL']);
      }
      await services.handoffPort.acknowledgeHandoff(input.thread_id);
      return respond({ threadId: input.thread_id });
    }),
  );
}
