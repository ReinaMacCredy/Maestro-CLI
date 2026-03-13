#!/usr/bin/env node

/**
 * ESM loader for the maestro MCP server.
 * Resolves paths relative to this file, then delegates to the bundled server.
 */

import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(__dirname);

const bundlePath = join(__dirname, 'dist', 'server.bundle.mjs');

if (!existsSync(bundlePath)) {
  console.error('[maestro] Server bundle not found at', bundlePath);
  console.error('[maestro] Run `bun run build` first.');
  process.exit(1);
}

const server = await import(bundlePath);
server.main();
