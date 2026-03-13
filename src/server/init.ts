import { z } from 'zod';
import * as path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ServicesThunk } from './_utils/services-thunk.ts';
import { respond, errorResponse } from './_utils/respond.ts';
import { ANNOTATIONS_MUTATING } from './_utils/annotations.ts';
import { getMaestroPath } from '../utils/paths.ts';
import { ensureDir } from '../utils/fs-io.ts';
import { MaestroError } from '../lib/errors.ts';

const execFileAsync = promisify(execFile);

export function registerInitTools(server: McpServer, thunk: ServicesThunk, directory?: string): void {
  server.registerTool(
    'maestro_init',
    {
      description: 'Initialize maestro for a project. Creates .maestro/ directory structure and sets up orchestration.',
      inputSchema: {
        // z.object({}) not needed -- empty schema means no inputs
      },
      annotations: ANNOTATIONS_MUTATING,
    },
    async (_input) => {
      try {
        const dir = directory;
        if (!dir) {
          return errorResponse({
            terminal: true,
            reason: 'no_directory',
            error: 'No project directory configured',
          });
        }

        const maestroPath = getMaestroPath(dir);
        ensureDir(maestroPath);
        ensureDir(path.join(maestroPath, 'features'));

        let brInitialized = false;
        try {
          await execFileAsync('br', ['init'], { cwd: dir });
          brInitialized = true;
        } catch {
          // br not available or init failed -- non-fatal
        }

        thunk.forceInit();

        return respond({
          success: true,
          projectRoot: dir,
          maestroPath,
          brInitialized,
        });
      } catch (err) {
        if (err instanceof MaestroError) {
          return errorResponse({ terminal: false, reason: 'maestro_error', error: err.message, suggestions: err.hints });
        }
        return errorResponse({ terminal: true, reason: 'unexpected_error', error: String(err) });
      }
    },
  );
}
