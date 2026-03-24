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

function getNestedValue(obj: unknown, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

export function registerConfigTools(server: McpServer, thunk: ServicesThunk): void {
  server.registerTool(
    'maestro_config_get',
    {
      description: 'Read maestro configuration. Supports dot notation (e.g. "dcp.enabled", "tasks.backend"). Returns settings (v2) with legacy config fallback.',
      inputSchema: {
        key: z.string().optional().describe('Specific config key (supports dot notation, e.g. "dcp.enabled", "toolbox.deny"). Omit for full settings.'),
      },
      annotations: ANNOTATIONS_READONLY,
    },
    withErrorHandling(async (input) => {
      const services = thunk.get();
      const settings = services.settingsPort.get();
      const redacted = redactSecrets(settings as unknown as Record<string, unknown>);

      if (input.key) {
        let value = getNestedValue(redacted, input.key);
        // Fall back to legacy config for unmigrated keys
        if (value === undefined) {
          const raw = services.configAdapter.get();
          const config = redactSecrets(raw as unknown as Record<string, unknown>);
          value = getNestedValue(config, input.key);
        }
        return respond({ key: input.key, value: value ?? null });
      }
      return respond({ settings: redacted });
    }),
  );
}
