/**
 * Lazy service initialization for the MCP server.
 * Defers initServices() until a tool is actually called,
 * allowing the server to start even if .maestro/ doesn't exist yet.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { initServices, type MaestroServices } from '../../services.ts';
import { MaestroError } from '../../lib/errors.ts';

export interface ServicesThunk {
  /** Get or initialize services. Throws if .maestro/ is missing. */
  get(): MaestroServices;
  /** Check if services have been initialized. */
  isInitialized(): boolean;
  /** Force initialization (used by maestro_init after creating .maestro/). */
  forceInit(): MaestroServices;
}

export function createServicesThunk(directory: string): ServicesThunk {
  let cached: MaestroServices | null = null;

  return {
    get(): MaestroServices {
      if (cached) return cached;

      const maestroDir = path.join(directory, '.maestro');
      if (!fs.existsSync(maestroDir)) {
        throw new MaestroError(
          'No .maestro/ directory found in this project',
          ['Run maestro_init first to set up this project for maestro orchestration'],
        );
      }

      cached = initServices(directory);
      return cached;
    },

    isInitialized(): boolean {
      return cached !== null;
    },

    forceInit(): MaestroServices {
      cached = initServices(directory);
      return cached;
    },
  };
}
