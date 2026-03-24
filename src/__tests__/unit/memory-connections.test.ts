import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { FsMemoryAdapter } from '../../memory/adapter.ts';

describe('memory connections', () => {
  let tmpDir: string;
  let adapter: FsMemoryAdapter;
  const feature = 'test-feature';

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'maestro-connections-'));
    // Create feature directory structure
    const memDir = join(tmpDir, '.maestro', 'features', feature, 'memory');
    mkdirSync(memDir, { recursive: true });
    adapter = new FsMemoryAdapter(tmpDir);
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test('connect adds a connection to memory frontmatter', () => {
    adapter.write(feature, 'auth-decisions', '# Auth decisions\nUse JWT tokens.');
    adapter.connect(feature, 'auth-decisions', 'api-patterns', 'related');

    const connections = adapter.getConnections(feature, 'auth-decisions');
    expect(connections).toHaveLength(1);
    expect(connections[0]).toEqual({ target: 'api-patterns', relation: 'related' });
  });

  test('connect deduplicates identical connections', () => {
    adapter.write(feature, 'auth-decisions', '# Auth decisions\nUse JWT tokens.');
    adapter.connect(feature, 'auth-decisions', 'api-patterns', 'related');
    adapter.connect(feature, 'auth-decisions', 'api-patterns', 'related');

    const connections = adapter.getConnections(feature, 'auth-decisions');
    expect(connections).toHaveLength(1);
  });

  test('connect allows different relations to same target', () => {
    adapter.write(feature, 'auth-decisions', '# Auth decisions');
    adapter.connect(feature, 'auth-decisions', 'api-patterns', 'related');
    adapter.connect(feature, 'auth-decisions', 'api-patterns', 'extends');

    const connections = adapter.getConnections(feature, 'auth-decisions');
    expect(connections).toHaveLength(2);
  });

  test('connect supports all relation types', () => {
    adapter.write(feature, 'source', '# Source');
    adapter.connect(feature, 'source', 'a', 'related');
    adapter.connect(feature, 'source', 'b', 'supersedes');
    adapter.connect(feature, 'source', 'c', 'contradicts');
    adapter.connect(feature, 'source', 'd', 'extends');

    const connections = adapter.getConnections(feature, 'source');
    expect(connections).toHaveLength(4);
    expect(connections.map(c => c.relation)).toEqual(['related', 'supersedes', 'contradicts', 'extends']);
  });

  test('getConnections returns empty array for memory without connections', () => {
    adapter.write(feature, 'plain-memory', '# Plain memory\nNo connections.');
    const connections = adapter.getConnections(feature, 'plain-memory');
    expect(connections).toEqual([]);
  });

  test('getConnections returns empty array for nonexistent memory', () => {
    const connections = adapter.getConnections(feature, 'nonexistent');
    expect(connections).toEqual([]);
  });

  test('connect preserves existing frontmatter fields', () => {
    const content = [
      '---',
      'tags: [auth, security]',
      'priority: 1',
      'category: decision',
      '---',
      '# Auth decisions',
    ].join('\n');
    adapter.write(feature, 'tagged-memory', content);
    adapter.connect(feature, 'tagged-memory', 'other-memory', 'related');

    const full = adapter.readFull(feature, 'tagged-memory');
    expect(full).not.toBeNull();
    expect(full!.metadata.tags).toContain('auth');
    expect(full!.metadata.priority).toBe(1);

    const connections = adapter.getConnections(feature, 'tagged-memory');
    expect(connections).toHaveLength(1);
  });

  test('connections persist through frontmatter round-trip', () => {
    adapter.write(feature, 'roundtrip', '# Roundtrip test');
    adapter.connect(feature, 'roundtrip', 'target-a', 'related');
    adapter.connect(feature, 'roundtrip', 'target-b', 'extends');

    // Read the raw file to verify frontmatter format
    const memDir = join(tmpDir, '.maestro', 'features', feature, 'memory');
    const raw = readFileSync(join(memDir, 'roundtrip.md'), 'utf-8');
    expect(raw).toContain('connections:');
    expect(raw).toContain('target-a:related');
    expect(raw).toContain('target-b:extends');

    // Verify round-trip through getConnections
    const connections = adapter.getConnections(feature, 'roundtrip');
    expect(connections).toHaveLength(2);
    expect(connections[0]).toEqual({ target: 'target-a', relation: 'related' });
    expect(connections[1]).toEqual({ target: 'target-b', relation: 'extends' });
  });

  test('connect is no-op for nonexistent source memory', () => {
    // Should not throw
    adapter.connect(feature, 'nonexistent', 'target', 'related');
  });
});
