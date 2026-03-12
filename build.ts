#!/usr/bin/env bun

import { $ } from 'bun';

async function build() {
  console.log('[build] Generating skills registry...');
  // Skills generation will be added in WU8

  console.log('[build] Compiling...');
  const result = await Bun.build({
    entrypoints: ['./src/cli.ts'],
    outdir: './dist',
    target: 'bun',
    minify: true,
    bytecode: true,
  });

  if (!result.success) {
    console.error('[build] Failed:');
    for (const log of result.logs) {
      console.error(log);
    }
    process.exit(1);
  }

  console.log('[build] Compiling to standalone binary...');
  await $`bun build --compile --minify --bytecode ./src/cli.ts --outfile ./dist/maestro`;

  console.log('[build] Done: ./dist/maestro');
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
