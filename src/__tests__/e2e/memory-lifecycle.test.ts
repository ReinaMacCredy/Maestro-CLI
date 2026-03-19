/**
 * E2E tests for memory lifecycle.
 * write --> read --> list --> compile --> stats --> delete
 *
 * Covers: memory-write, memory-read, memory-list, memory-delete,
 *         memory-compile, memory-stats. Both feature-scoped and global.
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { createTestHarness, type TestHarness } from '../mocks/test-harness.ts';

let harness: TestHarness;

afterEach(async () => {
  if (harness) await harness.cleanup();
});

/** Helper: init + feature-create */
async function setupFeature(h: TestHarness, name = 'test-feature') {
  await h.run('init');
  await h.run('feature-create', name);
}

describe('memory CRUD', () => {
  test('write and read round-trip', async () => {
    harness = await createTestHarness();
    await setupFeature(harness);

    const writeResult = await harness.run(
      'memory-write', '--feature', 'test-feature',
      '--name', 'api-notes.md',
      '--content', 'The API uses REST with JSON payloads.',
    );
    expect(writeResult.exitCode).toBe(0);

    const readResult = await harness.run('memory-read', '--feature', 'test-feature', '--name', 'api-notes.md');
    expect(readResult.exitCode).toBe(0);
    const content = JSON.parse(readResult.stdout);
    // Content may be returned as string or as { content: string }
    const text = typeof content === 'string' ? content : content.content;
    expect(text).toContain('REST with JSON');
  });

  test('overwrite existing memory', async () => {
    harness = await createTestHarness();
    await setupFeature(harness);

    await harness.run('memory-write', '--feature', 'test-feature', '--name', 'notes.md', '--content', 'Version 1');
    await harness.run('memory-write', '--feature', 'test-feature', '--name', 'notes.md', '--content', 'Version 2');

    const read = await harness.run('memory-read', '--feature', 'test-feature', '--name', 'notes.md');
    const content = JSON.parse(read.stdout);
    const text = typeof content === 'string' ? content : content.content;
    expect(text).toContain('Version 2');
    expect(text).not.toContain('Version 1');
  });

  test('read nonexistent memory fails', async () => {
    harness = await createTestHarness();
    await setupFeature(harness);

    const result = await harness.run('memory-read', '--feature', 'test-feature', '--name', 'nonexistent.md');
    expect(result.exitCode).toBe(1);
  });
});

describe('memory list', () => {
  test('lists all feature memories', async () => {
    harness = await createTestHarness();
    await setupFeature(harness);

    await harness.run('memory-write', '--feature', 'test-feature', '--name', 'alpha.md', '--content', 'Alpha content');
    await harness.run('memory-write', '--feature', 'test-feature', '--name', 'beta.md', '--content', 'Beta content');

    const result = await harness.run('memory-list', '--feature', 'test-feature');
    expect(result.exitCode).toBe(0);
    const items = JSON.parse(result.stdout);
    expect(items).toHaveLength(2);
    const names = items.map((i: { name: string }) => i.name);
    expect(names.some((n: string) => n.includes('alpha'))).toBe(true);
    expect(names.some((n: string) => n.includes('beta'))).toBe(true);
  });

  test('empty list for new feature', async () => {
    harness = await createTestHarness();
    await setupFeature(harness);

    const result = await harness.run('memory-list', '--feature', 'test-feature');
    expect(result.exitCode).toBe(0);
    const items = JSON.parse(result.stdout);
    expect(items).toHaveLength(0);
  });
});

describe('memory delete', () => {
  test('deletes existing memory', async () => {
    harness = await createTestHarness();
    await setupFeature(harness);

    await harness.run('memory-write', '--feature', 'test-feature', '--name', 'to-delete.md', '--content', 'Temporary');

    const deleteResult = await harness.run('memory-delete', '--feature', 'test-feature', '--name', 'to-delete.md');
    expect(deleteResult.exitCode).toBe(0);

    // Verify it's gone
    const readResult = await harness.run('memory-read', '--feature', 'test-feature', '--name', 'to-delete.md');
    expect(readResult.exitCode).toBe(1);
  });

  test('delete nonexistent memory fails', async () => {
    harness = await createTestHarness();
    await setupFeature(harness);

    const result = await harness.run('memory-delete', '--feature', 'test-feature', '--name', 'nonexistent.md');
    expect(result.exitCode).toBe(1);
  });
});

describe('memory compile', () => {
  test('compiles all memories into single string', async () => {
    harness = await createTestHarness();
    await setupFeature(harness);

    await harness.run('memory-write', '--feature', 'test-feature', '--name', 'arch.md', '--content', 'Uses hexagonal architecture');
    await harness.run('memory-write', '--feature', 'test-feature', '--name', 'deps.md', '--content', 'Depends on bun and zod');

    const result = await harness.run('memory-compile', '--feature', 'test-feature');
    expect(result.exitCode).toBe(0);
    const compiled = JSON.parse(result.stdout);
    const text = typeof compiled === 'string' ? compiled : String(compiled);
    expect(text).toContain('hexagonal architecture');
    expect(text).toContain('bun and zod');
  });

  test('compile with no memories fails', async () => {
    harness = await createTestHarness();
    await setupFeature(harness);

    const result = await harness.run('memory-compile', '--feature', 'test-feature');
    expect(result.exitCode).toBe(1);
  });
});

describe('memory stats', () => {
  test('shows count and bytes', async () => {
    harness = await createTestHarness();
    await setupFeature(harness);

    await harness.run('memory-write', '--feature', 'test-feature', '--name', 'a.md', '--content', 'Hello world');
    await harness.run('memory-write', '--feature', 'test-feature', '--name', 'b.md', '--content', 'Another note with more content');

    const result = await harness.run('memory-stats', '--feature', 'test-feature');
    expect(result.exitCode).toBe(0);
    const stats = JSON.parse(result.stdout);
    expect(stats.count).toBe(2);
    expect(stats.totalBytes).toBeGreaterThan(0);
  });

  test('stats for empty feature', async () => {
    harness = await createTestHarness();
    await setupFeature(harness);

    const result = await harness.run('memory-stats', '--feature', 'test-feature');
    expect(result.exitCode).toBe(0);
    const stats = JSON.parse(result.stdout);
    expect(stats.count).toBe(0);
    expect(stats.totalBytes).toBe(0);
  });
});
