import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';

import { FsMemoryAdapter } from '../../memory/adapter.ts';
import { recordSelections } from '../../dcp/selector.ts';

describe('memory selection tracking', () => {
  let tmpDir: string;
  let adapter: FsMemoryAdapter;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(tmpdir(), 'mem-sel-'));
    fs.mkdirSync(path.join(tmpDir, '.maestro', 'features', 'test', 'memory'), { recursive: true });
    adapter = new FsMemoryAdapter(tmpDir);
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('recordSelection increments selectionCount', () => {
    adapter.write('test', 'decision-auth', '---\ntags: [auth]\npriority: 1\ncategory: decision\n---\nUse JWT tokens.');
    adapter.recordSelection('test', 'decision-auth');
    adapter.recordSelection('test', 'decision-auth');

    const memories = adapter.listWithMeta('test');
    const mem = memories.find(m => m.name === 'decision-auth');
    expect(mem).toBeDefined();
    expect(mem!.metadata.selectionCount).toBe(2);
    expect(mem!.metadata.lastSelectedAt).toBeDefined();
  });

  it('recordSelection works on memories without prior frontmatter', () => {
    adapter.write('test', 'plain-note', 'Just a plain note without frontmatter.');
    adapter.recordSelection('test', 'plain-note');

    const memories = adapter.listWithMeta('test');
    const mem = memories.find(m => m.name === 'plain-note');
    expect(mem!.metadata.selectionCount).toBe(1);
  });

  it('recordSelections records multiple selections', () => {
    adapter.write('test', 'mem-a', '---\ncategory: research\n---\nContent A');
    adapter.write('test', 'mem-b', '---\ncategory: debug\n---\nContent B');

    recordSelections(adapter, 'test', ['mem-a', 'mem-b']);

    const memories = adapter.listWithMeta('test');
    expect(memories.find(m => m.name === 'mem-a')!.metadata.selectionCount).toBe(1);
    expect(memories.find(m => m.name === 'mem-b')!.metadata.selectionCount).toBe(1);
  });

  it('recordSelection on nonexistent memory is a no-op', () => {
    // Should not throw
    adapter.recordSelection('test', 'nonexistent');
  });
});
