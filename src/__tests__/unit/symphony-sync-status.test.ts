import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { executeInstall } from '../../symphony/install.ts';
import { executeSync } from '../../symphony/sync.ts';
import { getSymphonyStatus } from '../../symphony/status.ts';
import { readManifest } from '../../symphony/manifest.ts';

let tmpDir: string;

function setupTestRepo() {
  fs.mkdirSync(path.join(tmpDir, '.git'));
  fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
    name: 'sync-test',
    scripts: { build: 'tsc', test: 'vitest' },
    devDependencies: { typescript: '^5' },
  }));
  fs.writeFileSync(path.join(tmpDir, 'tsconfig.json'), '{}');
  fs.writeFileSync(path.join(tmpDir, 'bun.lockb'), '');
  fs.mkdirSync(path.join(tmpDir, 'src'));
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-test-'));
  setupTestRepo();
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('executeSync', () => {
  test('throws when no manifest exists', () => {
    expect(() => executeSync({ projectRoot: tmpDir, dryRun: false, force: false }))
      .toThrow('No Symphony manifest found');
  });

  test('sync after install shows all unchanged', async () => {
    await executeInstall({ projectRoot: tmpDir, dryRun: false, force: false, yes: true });

    const result = executeSync({ projectRoot: tmpDir, dryRun: false, force: false });
    expect(result.applied).toBe(true);
    expect(result.actionSummary.unchanged).toBeGreaterThan(0);
    expect(result.actionSummary.update).toBe(0);
    expect(result.actionSummary.conflict).toBe(0);
  });

  test('sync detects drifted file as conflict', async () => {
    await executeInstall({ projectRoot: tmpDir, dryRun: false, force: false, yes: true });

    // Edit a managed file
    fs.writeFileSync(path.join(tmpDir, 'AGENTS.md'), '# User edited this\n', 'utf8');

    const result = executeSync({ projectRoot: tmpDir, dryRun: false, force: false });
    const agentsAction = result.actions.find(a => a.path === 'AGENTS.md');
    expect(agentsAction!.action).toBe('conflict');
  });

  test('sync --force overwrites drifted file', async () => {
    await executeInstall({ projectRoot: tmpDir, dryRun: false, force: false, yes: true });

    fs.writeFileSync(path.join(tmpDir, 'AGENTS.md'), '# User edited\n', 'utf8');

    const result = executeSync({ projectRoot: tmpDir, dryRun: false, force: true });
    const agentsAction = result.actions.find(a => a.path === 'AGENTS.md');
    expect(agentsAction!.action).toBe('update');

    // File should be regenerated
    const content = fs.readFileSync(path.join(tmpDir, 'AGENTS.md'), 'utf8');
    expect(content).toContain('sync-test');
  });

  test('sync updates lastSyncedAt', async () => {
    await executeInstall({ projectRoot: tmpDir, dryRun: false, force: false, yes: true });
    const m1 = readManifest(tmpDir)!;

    // Small delay to ensure different timestamp
    await new Promise(r => setTimeout(r, 10));
    executeSync({ projectRoot: tmpDir, dryRun: false, force: false });
    const m2 = readManifest(tmpDir)!;

    expect(m2.lastSyncedAt).not.toBe(m1.lastSyncedAt);
  });

  test('sync --dry-run does not modify files', async () => {
    await executeInstall({ projectRoot: tmpDir, dryRun: false, force: false, yes: true });
    const m1 = readManifest(tmpDir)!;

    const result = executeSync({ projectRoot: tmpDir, dryRun: true, force: false });
    expect(result.applied).toBe(false);

    const m2 = readManifest(tmpDir)!;
    expect(m2.lastSyncedAt).toBe(m1.lastSyncedAt);
  });
});

describe('getSymphonyStatus', () => {
  test('not installed on fresh repo', () => {
    const status = getSymphonyStatus(tmpDir);
    expect(status.installed).toBe(false);
    expect(status.partial).toBe(false);
    expect(status.managedFileCount).toBe(0);
  });

  test('reports installed state correctly', async () => {
    await executeInstall({ projectRoot: tmpDir, dryRun: false, force: false, yes: true });

    const status = getSymphonyStatus(tmpDir);
    expect(status.installed).toBe(true);
    expect(status.managedFileCount).toBeGreaterThan(0);
    expect(status.driftedCount).toBe(0);
    expect(status.missingCount).toBe(0);
  });

  test('detects drifted files', async () => {
    await executeInstall({ projectRoot: tmpDir, dryRun: false, force: false, yes: true });

    fs.writeFileSync(path.join(tmpDir, 'AGENTS.md'), '# Changed\n', 'utf8');

    const status = getSymphonyStatus(tmpDir);
    expect(status.driftedCount).toBe(1);
    const drifted = status.files.find(f => f.path === 'AGENTS.md');
    expect(drifted!.status).toBe('drifted');
  });

  test('detects missing files', async () => {
    await executeInstall({ projectRoot: tmpDir, dryRun: false, force: false, yes: true });

    fs.unlinkSync(path.join(tmpDir, 'AGENTS.md'));

    const status = getSymphonyStatus(tmpDir);
    expect(status.missingCount).toBe(1);
    const missing = status.files.find(f => f.path === 'AGENTS.md');
    expect(missing!.status).toBe('missing');
  });
});
