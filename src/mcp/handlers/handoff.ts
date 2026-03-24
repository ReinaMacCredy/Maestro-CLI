/**
 * MCP tools for cross-agent handoff via Agent Mail.
 */

import { z } from 'zod';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ServicesThunk } from '../services-thunk.ts';
import { respond, withErrorHandling } from '../respond.ts';
import { ANNOTATIONS_READONLY, ANNOTATIONS_MUTATING } from '../annotations.ts';
import { requireFeature, resolveFeature } from './_resolve.ts';
import { featureParam } from '../params.ts';
import { requireHandoffPort as requireHandoffPortShared } from '../../core/resolve.ts';
import { buildAndSendHandoff } from '../../handoff/usecases.ts';
import { getHandoffsPath, getHandoffPath } from '../../core/paths.ts';
import { readText, fileExists } from '../../core/fs-io.ts';

function requireHandoffPort(thunk: ServicesThunk) {
  return requireHandoffPortShared(thunk.get());
}

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
      const port = requireHandoffPort(thunk);
      const services = thunk.get();
      const feature = requireFeature(services, input.feature);
      const { result } = await buildAndSendHandoff(port, feature, input.task, {
        targetAgent: input.target_agent,
        additionalContext: input.additional_context,
      });
      return respond({ feature, task: input.task, ...result });
    }),
  );

  server.registerTool(
    'maestro_handoff_receive',
    {
      description:
        'Check for pending handoffs addressed to this agent via Agent Mail.',
      inputSchema: {
        feature: featureParam(),
        agent_id: z.string().describe('Your agent name/ID'),
      },
      annotations: ANNOTATIONS_READONLY,
    },
    withErrorHandling(async (input) => {
      const port = requireHandoffPort(thunk);
      const services = thunk.get();
      const feature = resolveFeature(services, input.feature);
      const handoffs = await port.receiveHandoffs(feature ?? undefined, input.agent_id);
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
      const port = requireHandoffPort(thunk);
      await port.acknowledgeHandoff(input.thread_id);
      return respond({ threadId: input.thread_id });
    }),
  );

  server.registerTool(
    'maestro_handoff_read',
    {
      description: 'Read a specific handoff file for a feature.',
      inputSchema: {
        feature: featureParam(),
        id: z.string().describe('Handoff ID (bead/task ID used when sending)'),
      },
      annotations: ANNOTATIONS_READONLY,
    },
    withErrorHandling(async (input) => {
      const services = thunk.get();
      const feature = requireFeature(services, input.feature);
      const filePath = getHandoffPath(services.directory, feature, input.id);
      const content = readText(filePath);
      if (content === null) {
        throw new Error(`Handoff not found: ${input.id} (looked at ${filePath})`);
      }
      return respond({ feature, id: input.id, filePath, content });
    }),
  );

  server.registerTool(
    'maestro_handoff_list',
    {
      description: 'List all handoff files for a feature with names and timestamps.',
      inputSchema: {
        feature: featureParam(),
      },
      annotations: ANNOTATIONS_READONLY,
    },
    withErrorHandling(async (input) => {
      const services = thunk.get();
      const feature = requireFeature(services, input.feature);
      const handoffsDir = getHandoffsPath(services.directory, feature);

      const entries: Array<{ id: string; filePath: string; createdAt: string; acknowledged: boolean }> = [];

      try {
        const files = fs.readdirSync(handoffsDir).filter(f => f.endsWith('.md'));
        for (const file of files) {
          const filePath = path.join(handoffsDir, file);
          const stat = fs.statSync(filePath);
          const id = file.replace(/\.md$/, '');
          const ackPath = `${filePath}.ack`;
          entries.push({
            id,
            filePath,
            createdAt: stat.mtime.toISOString(),
            acknowledged: fileExists(ackPath),
          });
        }
      } catch {
        // No handoffs directory yet
      }

      return respond({ feature, handoffs: entries, count: entries.length });
    }),
  );

  server.registerTool(
    'maestro_handoff_status',
    {
      description: 'Check if a handoff exists and whether it has been acknowledged.',
      inputSchema: {
        feature: featureParam(),
        id: z.string().describe('Handoff ID (bead/task ID used when sending)'),
      },
      annotations: ANNOTATIONS_READONLY,
    },
    withErrorHandling(async (input) => {
      const services = thunk.get();
      const feature = requireFeature(services, input.feature);
      const filePath = getHandoffPath(services.directory, feature, input.id);
      const exists = fileExists(filePath);
      const acknowledged = exists && fileExists(`${filePath}.ack`);

      let createdAt: string | undefined;
      if (exists) {
        try {
          createdAt = fs.statSync(filePath).mtime.toISOString();
        } catch { /* ignore */ }
      }

      return respond({ feature, id: input.id, exists, acknowledged, filePath, createdAt });
    }),
  );
}
