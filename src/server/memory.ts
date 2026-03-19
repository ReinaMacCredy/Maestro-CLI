import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ServicesThunk } from './_utils/services-thunk.ts';
import { respond, withErrorHandling } from './_utils/respond.ts';
import { ANNOTATIONS_MUTATING, ANNOTATIONS_READONLY } from './_utils/annotations.ts';
import { requireFeature } from './_utils/resolve.ts';

export function registerMemoryTools(server: McpServer, thunk: ServicesThunk): void {
  server.registerTool(
    'maestro_memory_write',
    {
      description:
        'Save memory, decisions, or research findings. ' +
        'Per-feature (default): writes to .maestro/features/<name>/memory/. ' +
        'Global (global=true): writes to .maestro/memory/.',
      inputSchema: {
        feature: z.string().optional().describe('Feature name (defaults to active feature; ignored when global=true)'),
        name: z.string().describe('Memory file name'),
        content: z.string().describe('Memory content to save'),
        global: z.boolean().optional().default(false).describe('Write to global project memory instead of feature memory'),
      },
      annotations: ANNOTATIONS_MUTATING,
    },
    withErrorHandling(async (input) => {
      const services = thunk.get();
      if (input.global) {
        const path = services.memoryAdapter.writeGlobal(input.name, input.content);
        return respond({ scope: 'global', name: input.name, path });
      }
      const feature = requireFeature(services, input.feature);
      const path = services.memoryAdapter.write(feature, input.name, input.content);
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
      } catch {
        // No active feature -- fall through to global
      }
      const content = services.memoryAdapter.readGlobal(input.name);
      return respond({ scope: 'global', name: input.name, content });
    }),
  );

  server.registerTool(
    'maestro_memory_list',
    {
      description: 'List memory files. Lists feature memory by default, or global memory if feature is omitted.',
      inputSchema: {
        feature: z.string().optional().describe('Feature name (defaults to active feature; omit for global memory)'),
      },
      annotations: ANNOTATIONS_READONLY,
    },
    withErrorHandling(async (input) => {
      const services = thunk.get();
      // Try feature-scoped first (resolves active feature when param omitted)
      try {
        const feature = requireFeature(services, input.feature);
        const files = services.memoryAdapter.list(feature);
        return respond({ feature, files });
      } catch {
        // No active feature -- fall through to global
      }
      const files = services.memoryAdapter.listGlobal();
      return respond({ scope: 'global', files });
    }),
  );

  server.registerTool(
    'maestro_memory_promote',
    {
      description:
        'Promote a feature memory to global project memory. Copies from .maestro/features/<name>/memory/ to .maestro/memory/.',
      inputSchema: {
        feature: z.string().optional().describe('Feature name (defaults to active feature)'),
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
}
