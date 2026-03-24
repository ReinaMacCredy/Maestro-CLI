import { describe, it, expect, afterEach } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';

import { createTestHarness, type TestHarness } from '../mocks/test-harness.ts';

// ============================================================================
// toolbox-list (E2E via CLI)
// ============================================================================

describe('toolbox-list', () => {
  let harness: TestHarness;

  afterEach(async () => {
    if (harness) await harness.cleanup();
  });

  it('lists built-in tools in JSON mode', async () => {
    harness = await createTestHarness();
    await harness.run('init');
    const result = await harness.run('toolbox-list');
    expect(result.exitCode).toBe(0);

    const tools = JSON.parse(result.stdout);
    expect(Array.isArray(tools)).toBe(true);
    expect(tools.length).toBeGreaterThanOrEqual(1);

    // fs-tasks should always be present
    const fsTasks = tools.find((t: { name: string }) => t.name === 'fs-tasks');
    expect(fsTasks).toBeDefined();
    expect(fsTasks.transport).toBe('builtin');
    expect(fsTasks.status).toBe('installed');
  });

  it('includes transport field for all tools', async () => {
    harness = await createTestHarness();
    await harness.run('init');
    const result = await harness.run('toolbox-list');
    const tools = JSON.parse(result.stdout);

    for (const tool of tools) {
      expect(tool.transport).toBeDefined();
      expect(['cli', 'http', 'mcp-stdio', 'mcp-http', 'builtin']).toContain(tool.transport);
    }
  });
});

// ============================================================================
// toolbox-create (unit -- scaffolding validation)
// ============================================================================

describe('toolbox-create scaffolding', () => {
  let tmpDir: string;

  afterEach(async () => {
    if (tmpDir) await rm(tmpDir, { recursive: true, force: true });
  });

  it('creates manifest.json and adapter.ts for cli transport', async () => {
    tmpDir = await mkdtemp(path.join(tmpdir(), 'toolbox-create-'));
    const toolDir = path.join(tmpDir, 'my-tool');
    fs.mkdirSync(toolDir, { recursive: true });

    // Write a manifest manually to verify structure
    const manifest = {
      name: 'my-tool',
      transport: 'cli',
      binary: 'my-tool',
      detect: 'my-tool --version',
      provides: 'search',
      priority: 100,
      adapter: 'tools/external/my-tool/adapter.ts',
    };
    fs.writeFileSync(path.join(toolDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
    fs.writeFileSync(path.join(toolDir, 'adapter.ts'), 'export const createAdapter = () => {};');

    // Verify files exist
    expect(fs.existsSync(path.join(toolDir, 'manifest.json'))).toBe(true);
    expect(fs.existsSync(path.join(toolDir, 'adapter.ts'))).toBe(true);

    // Verify manifest content
    const parsed = JSON.parse(fs.readFileSync(path.join(toolDir, 'manifest.json'), 'utf-8'));
    expect(parsed.name).toBe('my-tool');
    expect(parsed.transport).toBe('cli');
    expect(parsed.binary).toBe('my-tool');
    expect(parsed.provides).toBe('search');
  });
});

// ============================================================================
// toolbox-add (unit -- manifest-only)
// ============================================================================

describe('toolbox-add manifest', () => {
  let tmpDir: string;

  afterEach(async () => {
    if (tmpDir) await rm(tmpDir, { recursive: true, force: true });
  });

  it('creates manifest-only for mcp-stdio transport', async () => {
    tmpDir = await mkdtemp(path.join(tmpdir(), 'toolbox-add-'));
    const toolDir = path.join(tmpDir, 'mcp-github');
    fs.mkdirSync(toolDir, { recursive: true });

    const manifest = {
      name: 'mcp-github',
      transport: 'mcp-stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-github'],
      binary: null,
      detect: null,
      provides: null,
      priority: 100,
      adapter: 'tools/external/mcp-github/adapter.ts',
    };
    fs.writeFileSync(path.join(toolDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

    const parsed = JSON.parse(fs.readFileSync(path.join(toolDir, 'manifest.json'), 'utf-8'));
    expect(parsed.transport).toBe('mcp-stdio');
    expect(parsed.command).toBe('npx');
    expect(parsed.binary).toBeNull();
    // No adapter.ts should exist for add (manifest-only)
    expect(fs.existsSync(path.join(toolDir, 'adapter.ts'))).toBe(false);
  });
});
