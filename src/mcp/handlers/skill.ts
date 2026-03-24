import { z } from 'zod';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ServicesThunk } from '../services-thunk.ts';
import { respond, textResponse, withErrorHandling } from '../respond.ts';
import { ANNOTATIONS_READONLY, ANNOTATIONS_MUTATING } from '../annotations.ts';
import { loadSkill, loadSkillReference, listSkills } from '../../skills/registry.ts';
import { MaestroError } from '../../core/errors.ts';
import { installSkill } from '../../skills/install.ts';
import { createSkill } from '../../skills/create.ts';
import { syncSkills } from '../../skills/sync.ts';

export function registerSkillTools(server: McpServer, _thunk: ServicesThunk, directory?: string): void {
  server.registerTool(
    'maestro_skill',
    {
      description: 'Load a workflow skill by name. Returns full skill content.',
      inputSchema: {
        name: z.string().describe('Skill name to load (e.g. maestro:design, maestro:implement)'),
        reference: z.string().optional().describe('Optional reference file path to load (e.g. steps/step-01.md)'),
      },
      annotations: ANNOTATIONS_READONLY,
    },
    withErrorHandling(async (input) => {
      const result = input.reference
        ? await loadSkillReference(input.name, input.reference, directory)
        : await loadSkill(input.name, directory);
      if ('error' in result) {
        throw new MaestroError(result.error, ['Run maestro_skill with a valid skill name. Check available skills in maestro status output.']);
      }
      return textResponse(result.content);
    }),
  );

  server.registerTool(
    'maestro_skill_list',
    {
      description: 'List all available skills (builtin and external). Shows name, description, and source.',
      inputSchema: {},
      annotations: ANNOTATIONS_READONLY,
    },
    withErrorHandling(async () => {
      const skills = await listSkills(directory);
      return respond({
        count: skills.length,
        skills: skills.map(s => ({
          name: s.name,
          description: s.description,
          source: s.source,
          ...(s.argumentHint ? { argumentHint: s.argumentHint } : {}),
          ...(s.stage ? { stage: s.stage } : {}),
          ...(s.audience ? { audience: s.audience } : {}),
        })),
      });
    }),
  );

  server.registerTool(
    'maestro_skill_install',
    {
      description: 'Install an external skill from a directory path.',
      inputSchema: {
        source: z.string().describe('Path to skill directory (must contain SKILL.md)'),
      },
      annotations: ANNOTATIONS_MUTATING,
    },
    withErrorHandling(async (input) => {
      const projectRoot = directory ?? process.cwd();
      const result = installSkill(input.source, projectRoot);
      return respond({ installed: result.name, path: result.path });
    }),
  );

  server.registerTool(
    'maestro_skill_create',
    {
      description: 'Scaffold a new skill with a SKILL.md template.',
      inputSchema: {
        name: z.string().describe('Skill name (e.g. my-custom-skill)'),
        stage: z.string().optional().describe('Pipeline stage (discovery, research, planning, approval, execution, done)'),
      },
      annotations: ANNOTATIONS_MUTATING,
    },
    withErrorHandling(async (input) => {
      const projectRoot = directory ?? process.cwd();
      const result = createSkill(input.name, projectRoot, input.stage);
      return respond({ created: result.name, path: result.path });
    }),
  );

  server.registerTool(
    'maestro_skill_remove',
    {
      description: 'Remove an installed external skill.',
      inputSchema: {
        name: z.string().describe('Skill name to remove'),
      },
      annotations: ANNOTATIONS_MUTATING,
    },
    withErrorHandling(async (input) => {
      const projectRoot = directory ?? process.cwd();
      const slug = input.name.toLowerCase().replace(/[^a-z0-9-:]/g, '-').replace(/-+/g, '-');
      const skillDir = path.join(projectRoot, '.maestro', 'skills', slug);
      if (!fs.existsSync(skillDir)) {
        throw new MaestroError(`Skill '${input.name}' not found at ${skillDir}`);
      }
      fs.rmSync(skillDir, { recursive: true });
      return respond({ removed: input.name });
    }),
  );

  server.registerTool(
    'maestro_skill_sync',
    {
      description: 'Re-scan external skills and clean up broken directories.',
      inputSchema: {},
      annotations: ANNOTATIONS_MUTATING,
    },
    withErrorHandling(async () => {
      const projectRoot = directory ?? process.cwd();
      const result = syncSkills(projectRoot);
      return respond(result);
    }),
  );
}
