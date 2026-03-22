import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ServicesThunk } from './_utils/services-thunk.ts';
import { respond, withErrorHandling } from './_utils/respond.ts';
import { ANNOTATIONS_READONLY, ANNOTATIONS_MUTATING } from './_utils/annotations.ts';
import { requireDoctrinePort as requireDoctrinePortShared } from '../lib/resolve.ts';
import type { DoctrineItem } from '../ports/doctrine.ts';
import { CURRENT_SCHEMA_VERSION } from '../adapters/fs/doctrine.ts';
import { MaestroError } from '../lib/errors.ts';
import { suggestDoctrine } from '../usecases/suggest-doctrine.ts';

function requireDoctrinePort(thunk: ServicesThunk) {
  return requireDoctrinePortShared(thunk.get());
}

export function registerDoctrineTools(server: McpServer, thunk: ServicesThunk): void {
  server.registerTool(
    'maestro_doctrine_list',
    {
      description: 'List all doctrine items, optionally filtered by status (active, deprecated, proposed).',
      inputSchema: {
        status: z.enum(['active', 'deprecated', 'proposed']).optional().describe('Filter by status'),
      },
      annotations: ANNOTATIONS_READONLY,
    },
    withErrorHandling(async (input) => {
      const port = requireDoctrinePort(thunk);
      const items = port.list(input.status ? { status: input.status } : undefined);
      return respond({
        count: items.length,
        items: items.map(i => ({
          name: i.name,
          rule: i.rule,
          status: i.status,
          tags: i.tags,
          effectiveness: i.effectiveness,
        })),
      });
    }),
  );

  server.registerTool(
    'maestro_doctrine_read',
    {
      description: 'Read a single doctrine item by name.',
      inputSchema: {
        name: z.string().describe('Doctrine item name'),
      },
      annotations: ANNOTATIONS_READONLY,
    },
    withErrorHandling(async (input) => {
      const port = requireDoctrinePort(thunk);
      const item = port.read(input.name);
      if (!item) {
        throw new MaestroError(`Doctrine item '${input.name}' not found`, ['Use maestro_doctrine_list to see available items']);
      }
      return respond(item);
    }),
  );

  server.registerTool(
    'maestro_doctrine_write',
    {
      description: 'Create or update a doctrine item. Provide a name, rule, rationale, and optional conditions/tags.',
      inputSchema: {
        name: z.string().describe('Doctrine item name (kebab-case)'),
        rule: z.string().describe('The operating rule (what to do)'),
        rationale: z.string().describe('Why this rule exists'),
        tags: z.array(z.string()).optional().describe('Tags for relevance matching'),
        conditionTags: z.array(z.string()).optional().describe('Tags that trigger this doctrine'),
        conditionFilePatterns: z.array(z.string()).optional().describe('File glob patterns that trigger this doctrine'),
        sourceFeatures: z.array(z.string()).optional().describe('Features that informed this doctrine'),
        sourceMemories: z.array(z.string()).optional().describe('Execution memories that informed this doctrine'),
        status: z.enum(['active', 'deprecated', 'proposed']).optional().default('active').describe('Doctrine status'),
      },
      annotations: ANNOTATIONS_MUTATING,
    },
    withErrorHandling(async (input) => {
      const port = requireDoctrinePort(thunk);
      const existing = port.read(input.name);
      const now = new Date().toISOString();

      const item: DoctrineItem = {
        name: input.name,
        rule: input.rule,
        rationale: input.rationale,
        conditions: {
          tags: input.conditionTags,
          filePatterns: input.conditionFilePatterns,
        },
        tags: input.tags ?? [],
        source: {
          features: input.sourceFeatures ?? [],
          memories: input.sourceMemories ?? [],
        },
        effectiveness: existing?.effectiveness ?? { injectionCount: 0, associatedSuccessRate: 0, overrideCount: 0 },
        status: input.status ?? 'active',
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        schemaVersion: CURRENT_SCHEMA_VERSION,
      };

      const path = port.write(item);
      return respond({ name: item.name, path, created: !existing });
    }),
  );

  server.registerTool(
    'maestro_doctrine_deprecate',
    {
      description: 'Deprecate a doctrine item. Deprecated items are excluded from injection.',
      inputSchema: {
        name: z.string().describe('Doctrine item name'),
      },
      annotations: ANNOTATIONS_MUTATING,
    },
    withErrorHandling(async (input) => {
      const port = requireDoctrinePort(thunk);
      const item = port.deprecate(input.name);
      return respond({ name: item.name, status: item.status });
    }),
  );

  server.registerTool(
    'maestro_doctrine_approve',
    {
      description: 'Approve a doctrine suggestion, writing it as an active doctrine item.',
      inputSchema: {
        name: z.string().describe('Doctrine item name (kebab-case)'),
        rule: z.string().describe('The operating rule (optionally edited from suggestion)'),
        rationale: z.string().describe('Why this rule exists'),
        tags: z.array(z.string()).optional().describe('Tags for relevance matching'),
        conditionTags: z.array(z.string()).optional().describe('Tags that trigger this doctrine'),
        sourceFeatures: z.array(z.string()).optional().describe('Features that informed this doctrine'),
        sourceMemories: z.array(z.string()).optional().describe('Execution memories that informed this doctrine'),
      },
      annotations: ANNOTATIONS_MUTATING,
    },
    withErrorHandling(async (input) => {
      const port = requireDoctrinePort(thunk);
      const now = new Date().toISOString();

      const item: DoctrineItem = {
        name: input.name,
        rule: input.rule,
        rationale: input.rationale,
        conditions: { tags: input.conditionTags },
        tags: input.tags ?? [],
        source: {
          features: input.sourceFeatures ?? [],
          memories: input.sourceMemories ?? [],
        },
        effectiveness: { injectionCount: 0, associatedSuccessRate: 0, overrideCount: 0 },
        status: 'active',
        createdAt: now,
        updatedAt: now,
        schemaVersion: CURRENT_SCHEMA_VERSION,
      };

      const path = port.write(item);
      return respond({ name: item.name, path, approved: true });
    }),
  );

  server.registerTool(
    'maestro_doctrine_suggest',
    {
      description: 'Suggest doctrine candidates from cross-feature execution patterns. Analyzes execution memories across features to find recurring patterns worth codifying.',
      inputSchema: {},
      annotations: ANNOTATIONS_READONLY,
    },
    withErrorHandling(async () => {
      const services = thunk.get();
      const port = requireDoctrinePort(thunk);
      const existing = port.list({ status: 'active' });
      const config = services.configAdapter.get().doctrine;
      const result = suggestDoctrine(services.featureAdapter, services.memoryAdapter, existing, config);
      return respond(result);
    }),
  );
}
