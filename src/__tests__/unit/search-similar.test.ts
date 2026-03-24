import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { FsSearchAdapter } from '../../search/fs-adapter.ts';

describe('FsSearchAdapter.searchSimilar', () => {
  let tmpDir: string;
  let adapter: FsSearchAdapter;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'maestro-search-'));
    const sessionsDir = join(tmpDir, '.maestro', 'sessions');
    mkdirSync(sessionsDir, { recursive: true });
    adapter = new FsSearchAdapter(tmpDir);
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeEvents(lines: string[]): void {
    const sessionsDir = join(tmpDir, '.maestro', 'sessions');
    writeFileSync(join(sessionsDir, 'events.jsonl'), lines.join('\n'));
  }

  test('returns empty array for empty content', async () => {
    writeEvents(['{"event": "task-done", "summary": "implemented auth flow"}']);
    const results = await adapter.searchSimilar('');
    expect(results).toEqual([]);
  });

  test('returns empty array when no events file exists', async () => {
    const results = await adapter.searchSimilar('authentication security tokens');
    expect(results).toEqual([]);
  });

  test('finds similar content by keyword overlap', async () => {
    writeEvents([
      '{"event": "task-done", "summary": "implemented authentication flow with security tokens"}',
      '{"event": "task-done", "summary": "fixed CSS styling for dashboard buttons"}',
      '{"event": "task-done", "summary": "added token validation for authentication endpoints"}',
    ]);

    const results = await adapter.searchSimilar('authentication security tokens validation');
    expect(results.length).toBeGreaterThan(0);
    // First result should have highest overlap score
    expect(results[0].score).toBeGreaterThan(0);
  });

  test('sorts results by score descending', async () => {
    writeEvents([
      '{"summary": "dashboard styling updates"}',
      '{"summary": "authentication token security validation endpoint"}',
      '{"summary": "authentication security"}',
    ]);

    const results = await adapter.searchSimilar('authentication token security validation');
    if (results.length >= 2) {
      expect(results[0].score).toBeGreaterThanOrEqual(results[1].score);
    }
  });

  test('respects limit option', async () => {
    writeEvents([
      '{"summary": "authentication flow implemented"}',
      '{"summary": "authentication tokens added"}',
      '{"summary": "authentication security review"}',
    ]);

    const results = await adapter.searchSimilar('authentication security tokens', { limit: 1 });
    expect(results.length).toBeLessThanOrEqual(1);
  });

  test('score is between 0 and 1', async () => {
    writeEvents([
      '{"summary": "authentication token security validation"}',
    ]);

    const results = await adapter.searchSimilar('authentication token security validation');
    for (const r of results) {
      expect(r.score).toBeGreaterThan(0);
      expect(r.score).toBeLessThanOrEqual(1);
    }
  });
});
