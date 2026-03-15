/**
 * MCP tools for Symphony onboarding.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ServicesThunk } from './_utils/services-thunk.ts';
import { respond, withErrorHandling } from './_utils/respond.ts';
import { ANNOTATIONS_READONLY, ANNOTATIONS_MUTATING } from './_utils/annotations.ts';

export function registerSymphonyTools(server: McpServer, _thunk: ServicesThunk, _directory: string): void {
  server.registerTool(
    'maestro_symphony_install',
    {
      description: 'Install Symphony onboarding for a project. Scans the repo, generates context files, AGENTS.md, Codex skills, and WORKFLOW.md. Bootstrap-safe: creates .maestro/ if needed.',
      inputSchema: {
        dryRun: z.boolean().optional().describe('Show planned actions without writing files'),
        force: z.boolean().optional().describe('Overwrite existing unmanaged files'),
        linearProject: z.string().optional().describe('Linear project slug for integration'),
        repoUrl: z.string().optional().describe('Git remote URL (auto-detected if omitted)'),
      },
      annotations: ANNOTATIONS_MUTATING,
    },
    withErrorHandling(async (_input) => {
      // TODO: full install flow (Slice 5)
      return respond({ status: 'not-implemented', message: 'Symphony install not yet implemented' });
    }),
  );

  server.registerTool(
    'maestro_symphony_sync',
    {
      description: 'Re-sync Symphony managed files from current repo state. Requires an existing Symphony manifest.',
      inputSchema: {
        dryRun: z.boolean().optional().describe('Show planned actions without writing files'),
        force: z.boolean().optional().describe('Overwrite drifted managed files'),
      },
      annotations: ANNOTATIONS_MUTATING,
    },
    withErrorHandling(async (_input) => {
      // TODO: full sync flow (Slice 6)
      return respond({ status: 'not-implemented', message: 'Symphony sync not yet implemented' });
    }),
  );

  server.registerTool(
    'maestro_symphony_status',
    {
      description: 'Show Symphony installation status, managed files, and drift detection.',
      inputSchema: {},
      annotations: ANNOTATIONS_READONLY,
    },
    withErrorHandling(async (_input) => {
      // TODO: full status flow (Slice 7)
      return respond({ status: 'not-implemented', message: 'Symphony status not yet implemented' });
    }),
  );
}
