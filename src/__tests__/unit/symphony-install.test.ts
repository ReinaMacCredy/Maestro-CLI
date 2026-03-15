import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { executeInstall } from '../../symphony/install.ts';
import { readManifest } from '../../symphony/manifest.ts';
import { detectInstallState, detectProjectName } from '../../symphony/state-detection.ts';

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'install-test-'));
  fs.mkdirSync(path.join(tmpDir, '.git'));
  // Minimal package.json
  fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
    name: 'test-project',
    scripts: { build: 'tsc', test: 'vitest' },
    devDependencies: { typescript: '^5' },
  }));
  fs.writeFileSync(path.join(tmpDir, 'tsconfig.json'), '{}');
  fs.writeFileSync(path.join(tmpDir, 'bun.lockb'), '');
  fs.mkdirSync(path.join(tmpDir, 'src'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('detectInstallState', () => {
  test('fresh repo', () => {
    expect(detectInstallState(tmpDir)).toBe('fresh');
  });

  test('foreign-config when .maestro/ exists without manifest', () => {
    fs.mkdirSync(path.join(tmpDir, '.maestro'));
    expect(detectInstallState(tmpDir)).toBe('foreign-config');
  });

  test('complete-symphony when valid manifest exists', () => {
    const manifestDir = path.join(tmpDir, '.maestro', 'symphony');
    fs.mkdirSync(manifestDir, { recursive: true });
    fs.writeFileSync(path.join(manifestDir, 'manifest.json'), JSON.stringify({
      version: 1,
      installedAt: '2026-01-01T00:00:00Z',
      lastSyncedAt: '2026-01-01T00:00:00Z',
      primaryBranch: 'main',
      scanSummary: { projectType: 'node', languages: [], frameworks: [], tools: [], isMonorepo: false, sourceRoots: [], hasProductGuidelines: false },
      managedFiles: [],
    }));
    expect(detectInstallState(tmpDir)).toBe('complete-symphony');
  });
});

describe('detectProjectName', () => {
  test('reads from package.json', () => {
    expect(detectProjectName(tmpDir)).toBe('test-project');
  });

  test('falls back to directory name', () => {
    fs.unlinkSync(path.join(tmpDir, 'package.json'));
    expect(detectProjectName(tmpDir)).toBe(path.basename(tmpDir));
  });
});

describe('executeInstall', () => {
  test('--dry-run produces actions without writing files', async () => {
    const result = await executeInstall({
      projectRoot: tmpDir,
      dryRun: true,
      force: false,
      yes: true,
    });

    expect(result.applied).toBe(false);
    expect(result.manifestWritten).toBe(false);
    expect(result.actions.length).toBeGreaterThan(0);
    expect(result.scanSummary.projectType).toBe('node');

    // No files should have been created
    expect(fs.existsSync(path.join(tmpDir, '.maestro', 'symphony', 'manifest.json'))).toBe(false);
  });

  test('--dry-run is idempotent', async () => {
    const r1 = await executeInstall({ projectRoot: tmpDir, dryRun: true, force: false, yes: true });
    const r2 = await executeInstall({ projectRoot: tmpDir, dryRun: true, force: false, yes: true });

    expect(r1.actions.length).toBe(r2.actions.length);
    for (let i = 0; i < r1.actions.length; i++) {
      expect(r1.actions[i].path).toBe(r2.actions[i].path);
      expect(r1.actions[i].action).toBe(r2.actions[i].action);
    }
  });

  test('fresh install creates all expected files', async () => {
    const result = await executeInstall({
      projectRoot: tmpDir,
      dryRun: false,
      force: false,
      yes: true,
    });

    expect(result.applied).toBe(true);
    expect(result.manifestWritten).toBe(true);

    // Check key files exist
    expect(fs.existsSync(path.join(tmpDir, '.maestro', 'context', 'product.md'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, '.maestro', 'context', 'tech-stack.md'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, '.maestro', 'context', 'guidelines.md'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, '.maestro', 'context', 'workflow.md'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, '.maestro', 'context', 'index.md'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, '.maestro', 'tracks.md'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'AGENTS.md'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'WORKFLOW.md'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, '.maestro', 'symphony', 'manifest.json'))).toBe(true);

    // Codex skills
    expect(fs.existsSync(path.join(tmpDir, '.codex', 'skills', 'commit', 'SKILL.md'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, '.codex', 'skills', 'land', 'land_watch.py'))).toBe(true);

    // Manifest is valid
    const manifest = readManifest(tmpDir);
    expect(manifest).not.toBeNull();
    expect(manifest!.version).toBe(1);
    expect(manifest!.scanSummary.projectType).toBe('node');
    expect(manifest!.managedFiles.length).toBeGreaterThan(0);
  });

  test('preserves existing unmanaged AGENTS.md without --force', async () => {
    const existing = '# My Custom Agents Config\n';
    fs.writeFileSync(path.join(tmpDir, 'AGENTS.md'), existing, 'utf8');

    const result = await executeInstall({
      projectRoot: tmpDir,
      dryRun: false,
      force: false,
      yes: true,
    });

    const agentsAction = result.actions.find(a => a.path === 'AGENTS.md');
    expect(agentsAction!.action).toBe('preserve-existing');

    // File should be unchanged
    const content = fs.readFileSync(path.join(tmpDir, 'AGENTS.md'), 'utf8');
    expect(content).toBe(existing);
  });

  test('--force overwrites existing unmanaged AGENTS.md', async () => {
    fs.writeFileSync(path.join(tmpDir, 'AGENTS.md'), '# Old', 'utf8');

    const result = await executeInstall({
      projectRoot: tmpDir,
      dryRun: false,
      force: true,
      yes: true,
    });

    const agentsAction = result.actions.find(a => a.path === 'AGENTS.md');
    expect(agentsAction!.action).toBe('update');

    // File should be replaced
    const content = fs.readFileSync(path.join(tmpDir, 'AGENTS.md'), 'utf8');
    expect(content).toContain('test-project');
  });
});
