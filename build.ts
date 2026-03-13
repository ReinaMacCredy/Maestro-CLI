#!/usr/bin/env bun

import { $, type BuildOutput } from 'bun';
import { cpSync } from 'node:fs';

function checkBuild(result: BuildOutput, label: string) {
  if (!result.success) {
    console.error(`[build] ${label} failed:`);
    for (const log of result.logs) console.error(log);
    process.exit(1);
  }
}

async function build() {
  // Step 0: Run generators (MUST run before server bundle -- loadSkill depends on registry.generated.ts)
  console.log('[build] Generating skills registry...');
  await $`bun src/skills/generate.ts`;

  console.log('[build] Generating command registry...');
  await $`bun src/commands/generate.ts`;

  // Step 1: Server bundle (Node target, ESM)
  console.log('[build] Bundling MCP server...');
  checkBuild(await Bun.build({
    entrypoints: ['./src/server.ts'],
    outdir: './dist',
    target: 'node',
    format: 'esm',
    minify: true,
    external: ['simple-git'],
    naming: { entry: 'server.bundle.mjs' },
  }), 'Server bundle');

  // Step 2: Hook scripts (Node target, ESM) -- built in parallel
  console.log('[build] Bundling hooks...');
  const hooks = ['sessionstart', 'pretooluse', 'posttooluse', 'precompact'];
  const hookResults = await Promise.all(hooks.map(hook => Bun.build({
    entrypoints: [`./src/hooks/${hook}.ts`],
    outdir: './dist/hooks',
    target: 'node',
    format: 'esm',
    minify: true,
    external: ['simple-git'],
    naming: { entry: `${hook}.mjs` },
  })));
  hooks.forEach((hook, i) => checkBuild(hookResults[i], `Hook: ${hook}`));

  // Step 3: CLI bundle for npm bin entry (Node target)
  console.log('[build] Bundling CLI for npm...');
  checkBuild(await Bun.build({
    entrypoints: ['./src/cli.ts'],
    outdir: './dist',
    target: 'node',
    format: 'esm',
    external: ['simple-git'],
    naming: { entry: 'cli.js' },
  }), 'CLI bundle');

  // Step 4: Copy static assets
  console.log('[build] Copying static assets...');
  cpSync('.claude-plugin', 'dist/.claude-plugin', { recursive: true });
  cpSync('skills', 'dist/skills', { recursive: true });
  cpSync('start.mjs', 'dist/start.mjs');

  // Step 5: Compile standalone binary (existing behavior)
  console.log('[build] Compiling to standalone binary...');
  await $`bun build --compile --minify ./src/cli.ts --outfile ./dist/maestro`;

  console.log('[build] Done.');
  console.log('  dist/server.bundle.mjs  -- MCP server');
  console.log('  dist/hooks/*.mjs        -- Hook scripts');
  console.log('  dist/cli.js             -- npm CLI entry');
  console.log('  dist/maestro            -- Standalone binary');
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
