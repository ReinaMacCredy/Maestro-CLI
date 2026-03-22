import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ServicesThunk } from './_utils/services-thunk.ts';
import { respond, withErrorHandling } from './_utils/respond.ts';
import { ANNOTATIONS_MUTATING, ANNOTATIONS_DESTRUCTIVE, ANNOTATIONS_READONLY } from './_utils/annotations.ts';
import { requireFeature } from './_utils/resolve.ts';
import { featureParam } from './_utils/params.ts';
import { MaestroError } from '../lib/errors.ts';
import { prependMetadataFrontmatter } from '../utils/frontmatter.ts';
import { validateName } from '../utils/validate-name.ts';
import { selectMemories } from '../utils/context-selector.ts';
import { resolveDcpConfig } from '../utils/dcp-config.ts';
import { MEMORY_CATEGORIES } from '../types.ts';

export function registerMemoryTools(server: McpServer, thunk: ServicesThunk): void {
  server.registerTool(
    'maestro_memory_write',
    {
      description: 'Save a memory file. Per-feature by default; set global=true for project-scoped.',
      inputSchema: {
        feature: z.string().optional().describe('Feature name (defaults to active feature; ignored when global=true)'),
        name: z.string().describe('Memory file name'),
        content: z.string().describe('Memory content to save'),
        global: z.boolean().optional().default(false).describe('Write to global project memory instead of feature memory'),
        tags: z.array(z.string()).optional().describe('Optional tags for DCP relevance scoring'),
        priority: z.number().min(0).max(4).optional().describe('Priority 0 (highest) to 4 (lowest), default 2'),
        category: z.enum(MEMORY_CATEGORIES).optional().describe('Memory category for DCP scoring'),
      },
      annotations: ANNOTATIONS_MUTATING,
    },
    withErrorHandling(async (input) => {
      const services = thunk.get();
      const finalContent = prependMetadataFrontmatter(input.content, {
        tags: input.tags, priority: input.priority, category: input.category,
      });

      if (input.global) {
        const path = services.memoryAdapter.writeGlobal(input.name, finalContent);
        return respond({ scope: 'global', name: input.name, path });
      }
      const feature = requireFeature(services, input.feature);
      const path = services.memoryAdapter.write(feature, input.name, finalContent);
      return respond({ feature, name: input.name, path });
    }),
  );

  server.registerTool(
    'maestro_memory_read',
    {
      description: 'Read a memory file by name. Reads from feature memory by default, or global memory if feature is omitted and the file exists globally.',
      inputSchema: {
        name: z.string().describe('Memory file name'),
        feature: z.string().optional().describe('Feature name (defaults to active feature; omit for global memory)'),
      },
      annotations: ANNOTATIONS_READONLY,
    },
    withErrorHandling(async (input) => {
      const services = thunk.get();
      // Try feature-scoped first (resolves active feature when param omitted)
      try {
        const feature = requireFeature(services, input.feature);
        const content = services.memoryAdapter.read(feature, input.name);
        if (content !== null) {
          return respond({ feature, name: input.name, content });
        }
      } catch (err) {
        if (!(err instanceof MaestroError)) throw err;
        // No active feature -- fall through to global
      }
      const content = services.memoryAdapter.readGlobal(input.name);
      return respond({ scope: 'global', name: input.name, content });
    }),
  );

  server.registerTool(
    'maestro_memory_list',
    {
      description: 'List memory files. Lists feature memory by default, or global memory if feature is omitted. Pass task for DCP-scored filtering.',
      inputSchema: {
        feature: z.string().optional().describe('Feature name (defaults to active feature; omit for global memory)'),
        brief: z.boolean().optional().default(false).describe('Return metadata only (omit content)'),
        task: z.string().optional().describe('Task folder for DCP-scored filtering'),
        budget: z.number().optional().describe('Memory budget in bytes (default from config)'),
      },
      annotations: ANNOTATIONS_READONLY,
    },
    withErrorHandling(async (input) => {
      const services = thunk.get();
      // Try feature-scoped first (resolves active feature when param omitted)
      let feature: string;
      try {
        feature = requireFeature(services, input.feature);
      } catch (err) {
        if (!(err instanceof MaestroError)) throw err;
        // No active feature -- fall through to global (no metadata for global)
        const globalFiles = services.memoryAdapter.listGlobal();
        const files = input.brief
          ? globalFiles.map(({ name, updatedAt, sizeBytes }) => ({ name, updatedAt, sizeBytes }))
          : globalFiles;
        return respond({ scope: 'global', files });
      }

      const richFiles = services.memoryAdapter.listWithMeta(feature);

      if (input.task) {
        // DCP-scored filtering
        const task = await services.taskPort.get(feature, input.task);
        if (!task) {
          return respond({ error: `Task '${input.task}' not found in feature '${feature}'` });
        }
        const cfg = resolveDcpConfig(services.configAdapter.get().dcp);
        const budget = input.budget ?? cfg.memoryBudgetTokens;
        const featureCreatedAt = services.featureAdapter.get(feature)?.createdAt;
        const selected = selectMemories(
          richFiles, task, task.planTitle ?? null, budget,
          cfg.relevanceThreshold, featureCreatedAt,
        );
        const scoreMap = new Map(selected.scores.map(s => [s.name, s.score]));
        const files = selected.memories.map(m => ({
          name: m.name,
          ...(input.brief ? {} : { content: m.bodyContent }),
          score: scoreMap.get(m.name) ?? 0,
        }));
        return respond({ feature, files, dcp: {
          included: selected.includedCount,
          dropped: selected.droppedCount,
          budgetBytes: budget,
        }});
      }

      const files = input.brief
        ? richFiles.map(({ name, updatedAt, sizeBytes, metadata }) => ({ name, updatedAt, sizeBytes, ...metadata }))
        : richFiles.map(({ name, content, updatedAt, sizeBytes, metadata }) => ({ name, content, updatedAt, sizeBytes, ...metadata }));
      return respond({ feature, files });
    }),
  );

  server.registerTool(
    'maestro_memory_promote',
    {
      description: 'Promote a feature memory to global project memory.',
      inputSchema: {
        feature: featureParam(),
        name: z.string().describe('Memory file name to promote'),
      },
      annotations: ANNOTATIONS_MUTATING,
    },
    withErrorHandling(async (input) => {
      const services = thunk.get();
      const feature = requireFeature(services, input.feature);

      const content = services.memoryAdapter.read(feature, input.name);
      if (!content) {
        return respond({ success: false, error: `Memory '${input.name}' not found in feature '${feature}'` });
      }

      const path = services.memoryAdapter.writeGlobal(input.name, content);
      return respond({ feature, name: input.name, promotedTo: path });
    }),
  );

  server.registerTool(
    'maestro_memory_delete',
    {
      description: 'Delete a memory file. Per-feature by default; set global=true for project-scoped. Validates name to prevent path traversal.',
      inputSchema: {
        feature: z.string().optional().describe('Feature name (defaults to active feature; ignored when global=true)'),
        name: z.string().describe('Memory file name to delete'),
        global: z.boolean().optional().default(false).describe('Delete from global project memory instead of feature memory'),
      },
      annotations: ANNOTATIONS_DESTRUCTIVE,
    },
    withErrorHandling(async (input) => {
      const services = thunk.get();
      const validation = validateName(input.name, 'memory name');
      if (!validation.ok) {
        throw new MaestroError(validation.error, ['Provide a valid memory file name']);
      }

      if (input.global) {
        const deleted = services.memoryAdapter.deleteGlobal(validation.name);
        if (!deleted) {
          throw new MaestroError(`Memory '${validation.name}' not found in global memory`, [
            'Use maestro_memory_list to see available memories',
          ]);
        }
        return respond({ scope: 'global', name: validation.name, deleted: true });
      }

      const feature = requireFeature(services, input.feature);
      const deleted = services.memoryAdapter.delete(feature, validation.name);
      if (!deleted) {
        throw new MaestroError(`Memory '${validation.name}' not found in feature '${feature}'`, [
          'Use maestro_memory_list to see available memories',
        ]);
      }
      return respond({ feature, name: validation.name, deleted: true });
    }),
  );

  server.registerTool(
    'maestro_memory_stats',
    {
      description: 'Show memory statistics for a feature: file count, total bytes, oldest/newest timestamps.',
      inputSchema: {
        feature: featureParam(),
      },
      annotations: ANNOTATIONS_READONLY,
    },
    withErrorHandling(async (input) => {
      const services = thunk.get();
      const feature = requireFeature(services, input.feature);
      const stats = services.memoryAdapter.stats(feature);
      return respond({ feature, ...stats });
    }),
  );

  server.registerTool(
    'maestro_memory_compile',
    {
      description: 'Compile all feature memories into a single concatenated string. Useful for bulk review or export.',
      inputSchema: {
        feature: featureParam(),
      },
      annotations: ANNOTATIONS_READONLY,
    },
    withErrorHandling(async (input) => {
      const services = thunk.get();
      const feature = requireFeature(services, input.feature);
      const compiled = services.memoryAdapter.compile(feature);
      return respond({ feature, compiled });
    }),
  );
}
