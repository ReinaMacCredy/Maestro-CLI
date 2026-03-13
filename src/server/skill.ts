import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ServicesThunk } from './_utils/services-thunk.ts';
import { textResponse, errorResponse } from './_utils/respond.ts';
import { ANNOTATIONS_READONLY } from './_utils/annotations.ts';
import { loadSkill } from '../skills/registry.ts';
import { MaestroError } from '../lib/errors.ts';

export function registerSkillTools(server: McpServer, _thunk: ServicesThunk, directory?: string): void {
  server.registerTool(
    'maestro_skill',
    {
      description:
        'Load a workflow skill. Returns full skill content (may be large, several KB). ' +
        'Use to get detailed guidance for writing plans, executing tasks, debugging, etc.',
      inputSchema: {
        name: z.string().describe('Skill name to load (e.g. writing-plans, executing-plans)'),
      },
      annotations: ANNOTATIONS_READONLY,
    },
    async (input) => {
      try {
        const result = await loadSkill(input.name, directory);
        if ('error' in result) {
          return errorResponse({
            terminal: false,
            reason: 'skill_not_found',
            error: result.error,
            suggestions: ['Run maestro_skill with a valid skill name. Check available skills in maestro status output.'],
          });
        }
        return textResponse(result.content);
      } catch (err) {
        if (err instanceof MaestroError) {
          return errorResponse({ terminal: false, reason: 'maestro_error', error: err.message, suggestions: err.hints });
        }
        return errorResponse({ terminal: true, reason: 'unexpected_error', error: String(err) });
      }
    },
  );
}
