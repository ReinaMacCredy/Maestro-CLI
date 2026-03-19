import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ServicesThunk } from './_utils/services-thunk.ts';
import { respond, withErrorHandling } from './_utils/respond.ts';
import { ANNOTATIONS_READONLY } from './_utils/annotations.ts';
import { ping } from '../usecases/ping.ts';

export function registerPingTools(server: McpServer, thunk: ServicesThunk): void {
  server.registerTool(
    'maestro_ping',
    {
      description:
        'Health check: returns maestro version, project root, task backend, and integration availability. ' +
        'Lightweight probe -- no feature context required.',
      annotations: ANNOTATIONS_READONLY,
    },
    withErrorHandling(async () => {
      const services = thunk.get();
      const result = ping(services);
      return respond({ success: true, ...result });
    }),
  );
}
