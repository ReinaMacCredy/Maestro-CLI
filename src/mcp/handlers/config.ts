import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ServicesThunk } from '../services-thunk.ts';
import { respond, withErrorHandling } from '../respond.ts';
import { ANNOTATIONS_READONLY } from '../annotations.ts';

const REDACT_PATTERN = /apiKey|token|secret|password/i;

function redactSecrets(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (REDACT_PATTERN.test(key)) {
      result[key] = '[REDACTED]';
    } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = redactSecrets(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result;
}

export function registerConfigTools(server: McpServer, thunk: ServicesThunk): void {
  server.registerTool(
    'maestro_config_get',
    {
      description: 'Read maestro configuration. Optionally return a specific field. Sensitive fields (apiKey, token, secret, password) are redacted.',
      inputSchema: {
        key: z.string().optional().describe('Specific config key to return (e.g. "dcp", "claimExpiresMinutes"). Omit for full config.'),
      },
      annotations: ANNOTATIONS_READONLY,
    },
    withErrorHandling(async (input) => {
      const services = thunk.get();
      const raw = services.configAdapter.get();
      const config = redactSecrets(raw as unknown as Record<string, unknown>);

      if (input.key) {
        const value = config[input.key];
        return respond({ key: input.key, value: value ?? null });
      }
      return respond({ config });
    }),
  );
}
