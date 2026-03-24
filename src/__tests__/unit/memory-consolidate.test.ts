import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';

import { FsMemoryAdapter } from '../../memory/adapter.ts';
import { consolidateMemories } from '../../memory/consolidate.ts';

describe('consolidateMemories', () => {
  let tmpDir: string;
  let adapter: FsMemoryAdapter;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(tmpdir(), 'consolidate-'));
    fs.mkdirSync(path.join(tmpDir, '.maestro', 'features', 'feat', 'memory'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.maestro', 'memory'), { recursive: true });
    adapter = new FsMemoryAdapter(tmpDir);
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('returns empty result when no memories', () => {
    const result = consolidateMemories(adapter, 'feat');
    expect(result.stats.total).toBe(0);
  });

  it('detects duplicate memories with high keyword overlap', () => {
    const sharedContent = 'Authentication tokens using JSON Web Tokens provide stateless session management for REST endpoints. The implementation handles refresh tokens, access tokens, token validation middleware, and token expiration policies across the application layer.';
    adapter.write('feat', 'research-auth-v1',
      `---\ncategory: research\npriority: 2\ntags: [auth, jwt]\n---\n${sharedContent}`);
    adapter.write('feat', 'research-auth-v2',
      `---\ncategory: research\npriority: 1\ntags: [auth, jwt]\n---\n${sharedContent} Also covers token rotation.`);

    const result = consolidateMemories(adapter, 'feat');
    expect(result.merged.length).toBe(1);
    expect(result.merged[0].kept).toBe('research-auth-v2'); // priority 1 > priority 2
    expect(result.merged[0].removed).toBe('research-auth-v1');
  });

  it('does not merge memories with different categories', () => {
    adapter.write('feat', 'decision-auth',
      '---\ncategory: decision\npriority: 1\ntags: [auth]\n---\nUse JWT for authentication.');
    adapter.write('feat', 'research-auth',
      '---\ncategory: research\npriority: 1\ntags: [auth]\n---\nUse JWT for authentication.');

    const result = consolidateMemories(adapter, 'feat');
    expect(result.merged.length).toBe(0);
  });

  it('identifies promotion candidates (priority 0-1, decision/arch, 3+ selections)', () => {
    adapter.write('feat', 'decision-hexagonal',
      '---\ncategory: decision\npriority: 0\ntags: [architecture]\nselectionCount: 5\n---\nUse hexagonal architecture.');

    const result = consolidateMemories(adapter, 'feat');
    expect(result.promotionCandidates).toContain('decision-hexagonal');
    expect(result.promoted.length).toBe(0); // no autoPromote
  });

  it('auto-promotes when autoPromote is true', () => {
    adapter.write('feat', 'decision-ports',
      '---\ncategory: decision\npriority: 1\ntags: [architecture]\nselectionCount: 4\n---\nUse port/adapter pattern.');

    const result = consolidateMemories(adapter, 'feat', { autoPromote: true });
    expect(result.promoted).toContain('decision-ports');

    // Verify global memory was written
    const global = adapter.readGlobal('decision-ports');
    expect(global).not.toBeNull();
  });

  it('dry run does not modify files', () => {
    adapter.write('feat', 'dup-a',
      '---\ncategory: research\npriority: 2\ntags: [test]\n---\nExact same content for testing duplicate detection.');
    adapter.write('feat', 'dup-b',
      '---\ncategory: research\npriority: 3\ntags: [test]\n---\nExact same content for testing duplicate detection.');

    const result = consolidateMemories(adapter, 'feat', { dryRun: true });
    expect(result.merged.length).toBe(1);

    // File should still exist (dry run)
    const files = adapter.list('feat');
    expect(files.length).toBe(2);
  });

  it('reports correct afterConsolidation count', () => {
    adapter.write('feat', 'keep-me',
      '---\ncategory: decision\npriority: 1\ntags: [keep]\n---\nImportant decision.');
    const dupContent = 'Research about overlapping topics covering shared keywords patterns, duplicate detection algorithms, keyword extraction methods, and similarity scoring techniques for memory consolidation.';
    adapter.write('feat', 'dup-1',
      `---\ncategory: research\npriority: 2\ntags: [overlap]\n---\n${dupContent}`);
    adapter.write('feat', 'dup-2',
      `---\ncategory: research\npriority: 3\ntags: [overlap]\n---\n${dupContent} Also covers threshold tuning.`);

    const result = consolidateMemories(adapter, 'feat');
    expect(result.stats.total).toBe(3);
    expect(result.stats.afterConsolidation).toBe(2); // 1 removed
  });
});
