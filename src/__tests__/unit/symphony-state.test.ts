import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { hashContent } from '../../symphony/hashing.ts';
import { readManifest, writeManifest, manifestExists } from '../../symphony/manifest.ts';
import { buildActionPlan, summarizeActions } from '../../symphony/actions.ts';
import type { SymphonyManifest } from '../../symphony/types.ts';

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'symphony-test-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// -- hashing --

describe('hashContent', () => {
  test('produces consistent SHA-256 hex digest', () => {
    const h1 = hashContent('hello world');
    const h2 = hashContent('hello world');
    expect(h1).toBe(h2);
    expect(h1).toHaveLength(64); // SHA-256 hex = 64 chars
  });

  test('different content produces different hash', () => {
    expect(hashContent('a')).not.toBe(hashContent('b'));
  });

  test('handles empty string', () => {
    const h = hashContent('');
    expect(h).toHaveLength(64);
  });
});

// -- manifest --

describe('manifest', () => {
  test('manifestExists returns false for missing manifest', () => {
    expect(manifestExists(tmpDir)).toBe(false);
  });

  test('writeManifest creates file and readManifest reads it back', () => {
    const manifest: SymphonyManifest = {
      version: 1,
      installedAt: '2026-03-15T00:00:00Z',
      lastSyncedAt: '2026-03-15T00:00:00Z',
      primaryBranch: 'main',
      scanSummary: {
        projectType: 'node',
        languages: ['typescript'],
        frameworks: [],
        tools: [],
        isMonorepo: false,
        sourceRoots: ['src'],
        hasProductGuidelines: false,
      },
      managedFiles: [
        { path: 'AGENTS.md', role: 'agents', contentHash: hashContent('# Agents') },
      ],
    };

    writeManifest(tmpDir, manifest);
    expect(manifestExists(tmpDir)).toBe(true);

    const read = readManifest(tmpDir);
    expect(read).not.toBeNull();
    expect(read!.version).toBe(1);
    expect(read!.managedFiles).toHaveLength(1);
    expect(read!.managedFiles[0].path).toBe('AGENTS.md');
  });

  test('readManifest returns null for invalid JSON', () => {
    const dir = path.join(tmpDir, '.maestro', 'symphony');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'manifest.json'), 'not json', 'utf8');
    expect(readManifest(tmpDir)).toBeNull();
  });

  test('readManifest returns null for wrong version', () => {
    const dir = path.join(tmpDir, '.maestro', 'symphony');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({ version: 99 }), 'utf8');
    expect(readManifest(tmpDir)).toBeNull();
  });
});

// -- actions --

describe('buildActionPlan', () => {
  test('create action for non-existent file', () => {
    const actions = buildActionPlan(tmpDir, [
      { path: 'AGENTS.md', role: 'agents', content: '# Agents' },
    ], null, false);

    expect(actions).toHaveLength(1);
    expect(actions[0].action).toBe('create');
    expect(actions[0].content).toBe('# Agents');
  });

  test('preserve-existing for unmanaged existing file without --force', () => {
    fs.writeFileSync(path.join(tmpDir, 'AGENTS.md'), '# Existing', 'utf8');

    const actions = buildActionPlan(tmpDir, [
      { path: 'AGENTS.md', role: 'agents', content: '# New' },
    ], null, false);

    expect(actions[0].action).toBe('preserve-existing');
  });

  test('update for unmanaged existing file with --force', () => {
    fs.writeFileSync(path.join(tmpDir, 'AGENTS.md'), '# Existing', 'utf8');

    const actions = buildActionPlan(tmpDir, [
      { path: 'AGENTS.md', role: 'agents', content: '# New' },
    ], null, true);

    expect(actions[0].action).toBe('update');
    expect(actions[0].content).toBe('# New');
  });

  test('unchanged when content matches', () => {
    const content = '# Agents\nBuild: bun run build';
    fs.writeFileSync(path.join(tmpDir, 'AGENTS.md'), content, 'utf8');

    const manifest: SymphonyManifest = {
      version: 1,
      installedAt: '2026-03-15T00:00:00Z',
      lastSyncedAt: '2026-03-15T00:00:00Z',
      primaryBranch: 'main',
      scanSummary: { projectType: 'node', languages: [], frameworks: [], tools: [], isMonorepo: false, sourceRoots: [], hasProductGuidelines: false },
      managedFiles: [{ path: 'AGENTS.md', role: 'agents', contentHash: hashContent(content) }],
    };

    const actions = buildActionPlan(tmpDir, [
      { path: 'AGENTS.md', role: 'agents', content },
    ], manifest, false);

    expect(actions[0].action).toBe('unchanged');
  });

  test('update when tracked file unchanged by user but new content differs', () => {
    const oldContent = '# Agents v1';
    fs.writeFileSync(path.join(tmpDir, 'AGENTS.md'), oldContent, 'utf8');

    const manifest: SymphonyManifest = {
      version: 1,
      installedAt: '2026-03-15T00:00:00Z',
      lastSyncedAt: '2026-03-15T00:00:00Z',
      primaryBranch: 'main',
      scanSummary: { projectType: 'node', languages: [], frameworks: [], tools: [], isMonorepo: false, sourceRoots: [], hasProductGuidelines: false },
      managedFiles: [{ path: 'AGENTS.md', role: 'agents', contentHash: hashContent(oldContent) }],
    };

    const actions = buildActionPlan(tmpDir, [
      { path: 'AGENTS.md', role: 'agents', content: '# Agents v2' },
    ], manifest, false);

    expect(actions[0].action).toBe('update');
  });

  test('conflict when tracked file was edited by user', () => {
    fs.writeFileSync(path.join(tmpDir, 'AGENTS.md'), '# User edited', 'utf8');

    const manifest: SymphonyManifest = {
      version: 1,
      installedAt: '2026-03-15T00:00:00Z',
      lastSyncedAt: '2026-03-15T00:00:00Z',
      primaryBranch: 'main',
      scanSummary: { projectType: 'node', languages: [], frameworks: [], tools: [], isMonorepo: false, sourceRoots: [], hasProductGuidelines: false },
      managedFiles: [{ path: 'AGENTS.md', role: 'agents', contentHash: hashContent('# Original') }],
    };

    const actions = buildActionPlan(tmpDir, [
      { path: 'AGENTS.md', role: 'agents', content: '# New generated' },
    ], manifest, false);

    expect(actions[0].action).toBe('conflict');
  });

  test('--force overrides conflict to update', () => {
    fs.writeFileSync(path.join(tmpDir, 'AGENTS.md'), '# User edited', 'utf8');

    const manifest: SymphonyManifest = {
      version: 1,
      installedAt: '2026-03-15T00:00:00Z',
      lastSyncedAt: '2026-03-15T00:00:00Z',
      primaryBranch: 'main',
      scanSummary: { projectType: 'node', languages: [], frameworks: [], tools: [], isMonorepo: false, sourceRoots: [], hasProductGuidelines: false },
      managedFiles: [{ path: 'AGENTS.md', role: 'agents', contentHash: hashContent('# Original') }],
    };

    const actions = buildActionPlan(tmpDir, [
      { path: 'AGENTS.md', role: 'agents', content: '# New generated' },
    ], manifest, true);

    expect(actions[0].action).toBe('update');
  });
});

describe('summarizeActions', () => {
  test('counts actions by type', () => {
    const counts = summarizeActions([
      { path: 'a', role: 'context', action: 'create' },
      { path: 'b', role: 'context', action: 'create' },
      { path: 'c', role: 'agents', action: 'unchanged' },
      { path: 'd', role: 'workflow', action: 'conflict' },
    ]);

    expect(counts.create).toBe(2);
    expect(counts.unchanged).toBe(1);
    expect(counts.conflict).toBe(1);
    expect(counts.update).toBe(0);
    expect(counts['preserve-existing']).toBe(0);
  });
});
