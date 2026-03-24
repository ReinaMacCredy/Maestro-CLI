import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir, homedir } from 'os';

import {
  DEFAULT_SETTINGS,
  mergeSettings,
  isToolAllowed,
  type MaestroSettings,
} from '../../core/settings.ts';
import { FsSettingsAdapter, migrateFromConfig } from '../../core/settings-adapter.ts';
// ============================================================================
// mergeSettings
// ============================================================================

describe('mergeSettings', () => {
  it('returns defaults when no overlays', () => {
    const result = mergeSettings(DEFAULT_SETTINGS);
    expect(result).toEqual(DEFAULT_SETTINGS);
  });

  it('overlays scalar fields in nested sections', () => {
    const result = mergeSettings(DEFAULT_SETTINGS, {
      dcp: { ...DEFAULT_SETTINGS.dcp, memoryBudgetTokens: 2048 },
    });
    expect(result.dcp.memoryBudgetTokens).toBe(2048);
    // Other dcp fields preserved
    expect(result.dcp.enabled).toBe(true);
    expect(result.dcp.relevanceThreshold).toBe(0.1);
  });

  it('replaces arrays (not concat)', () => {
    const result = mergeSettings(DEFAULT_SETTINGS, {
      toolbox: { ...DEFAULT_SETTINGS.toolbox, allow: ['br', 'bv'] },
    });
    expect(result.toolbox.allow).toEqual(['br', 'bv']);
  });

  it('applies multiple overlays in order', () => {
    const global: Partial<MaestroSettings> = {
      tasks: { claimExpiresMinutes: 60, backend: 'auto' },
    };
    const project: Partial<MaestroSettings> = {
      tasks: { claimExpiresMinutes: 30, backend: 'br' },
    };
    const result = mergeSettings(DEFAULT_SETTINGS, global, project);
    expect(result.tasks.claimExpiresMinutes).toBe(30);
    expect(result.tasks.backend).toBe('br');
  });

  it('deep-merges toolbox.config', () => {
    const global: Partial<MaestroSettings> = {
      toolbox: {
        allow: [],
        deny: [],
        config: { br: { syncOnClaim: true } },
      },
    };
    const project: Partial<MaestroSettings> = {
      toolbox: {
        allow: [],
        deny: [],
        config: { br: { timeout: 5000 }, bv: { verbose: true } },
      },
    };
    const result = mergeSettings(DEFAULT_SETTINGS, global, project);
    expect(result.toolbox.config.br).toEqual({ syncOnClaim: true, timeout: 5000 });
    expect(result.toolbox.config.bv).toEqual({ verbose: true });
  });

  it('skips undefined overlay keys', () => {
    const result = mergeSettings(DEFAULT_SETTINGS, { dcp: undefined } as Partial<MaestroSettings>);
    expect(result.dcp).toEqual(DEFAULT_SETTINGS.dcp);
  });
});

// ============================================================================
// isToolAllowed
// ============================================================================

describe('isToolAllowed', () => {
  it('allows everything when both lists empty', () => {
    expect(isToolAllowed('br', { allow: [], deny: [] })).toBe(true);
    expect(isToolAllowed('anything', { allow: [], deny: [] })).toBe(true);
  });

  it('denies tools in deny list', () => {
    expect(isToolAllowed('bv', { allow: [], deny: ['bv'] })).toBe(false);
  });

  it('allowlist mode: only listed tools pass', () => {
    expect(isToolAllowed('br', { allow: ['br'], deny: [] })).toBe(true);
    expect(isToolAllowed('bv', { allow: ['br'], deny: [] })).toBe(false);
  });

  it('deny wins over allow', () => {
    expect(isToolAllowed('br', { allow: ['br'], deny: ['br'] })).toBe(false);
  });
});

// ============================================================================
// migrateFromConfig
// ============================================================================

describe('migrateFromConfig', () => {
  it('migrates taskBackend and claimExpiresMinutes', () => {
    const result = migrateFromConfig({
      taskBackend: 'br',
      claimExpiresMinutes: 60,
    });
    expect(result.tasks?.backend).toBe('br');
    expect(result.tasks?.claimExpiresMinutes).toBe(60);
  });

  it('migrates enableToolsFor to toolbox.allow', () => {
    const result = migrateFromConfig({ enableToolsFor: ['br', 'bv'] });
    expect(result.toolbox?.allow).toEqual(['br', 'bv']);
  });

  it('migrates disableMcps to toolbox.deny', () => {
    const result = migrateFromConfig({ disableMcps: ['cass'] });
    expect(result.toolbox?.deny).toEqual(['cass']);
  });

  it('migrates dcp with token fields preferred', () => {
    const result = migrateFromConfig({
      dcp: {
        enabled: false,
        memoryBudgetTokens: 2048,
        memoryBudgetBytes: 9999, // should be ignored when tokens is present
      },
    });
    expect(result.dcp?.enabled).toBe(false);
    expect(result.dcp?.memoryBudgetTokens).toBe(2048);
  });

  it('migrates dcp bytes to tokens when no token field', () => {
    const result = migrateFromConfig({
      dcp: { memoryBudgetBytes: 8192 },
    });
    expect(result.dcp?.memoryBudgetTokens).toBe(2048); // 8192 / 4
  });

  it('migrates verification section', () => {
    const result = migrateFromConfig({
      verification: {
        enabled: false,
        maxRevisions: 5,
        buildCommand: 'bun run check',
      },
    });
    expect(result.verification?.enabled).toBe(false);
    expect(result.verification?.maxRevisions).toBe(5);
    expect(result.verification?.buildCommand).toBe('bun run check');
  });

  it('migrates doctrine with byte-to-token conversion', () => {
    const result = migrateFromConfig({
      doctrine: {
        doctrineBudgetBytes: 2048,
        minSampleSize: 10,
      },
    });
    expect(result.doctrine?.doctrineBudgetTokens).toBe(512); // 2048 / 4
    expect(result.doctrine?.minSampleSize).toBe(10);
  });

  it('returns empty when config has no relevant fields', () => {
    const result = migrateFromConfig({ $schema: 'foo' });
    expect(result).toEqual({});
  });
});

// ============================================================================
// FsSettingsAdapter
// ============================================================================

describe('FsSettingsAdapter', () => {
  let tmpDir: string;
  let globalDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(tmpdir(), 'settings-test-'));
    globalDir = path.join(tmpDir, 'global-maestro');
    fs.mkdirSync(globalDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('returns defaults when no files exist', () => {
    const projectDir = path.join(tmpDir, 'project');
    fs.mkdirSync(projectDir, { recursive: true });
    const adapter = new FsSettingsAdapter(projectDir, globalDir);
    const result = adapter.get();
    expect(result).toEqual(DEFAULT_SETTINGS);
  });

  it('reads global settings only', () => {
    const projectDir = path.join(tmpDir, 'project');
    fs.mkdirSync(projectDir, { recursive: true });
    fs.writeFileSync(
      path.join(globalDir, 'settings.json'),
      JSON.stringify({ tasks: { claimExpiresMinutes: 60, backend: 'br' } }),
    );
    const adapter = new FsSettingsAdapter(projectDir, globalDir);
    const result = adapter.get();
    expect(result.tasks.claimExpiresMinutes).toBe(60);
    expect(result.tasks.backend).toBe('br');
  });

  it('reads project settings that override global', () => {
    const projectDir = path.join(tmpDir, 'project');
    fs.mkdirSync(path.join(projectDir, '.maestro'), { recursive: true });
    fs.writeFileSync(
      path.join(globalDir, 'settings.json'),
      JSON.stringify({ tasks: { claimExpiresMinutes: 60, backend: 'br' } }),
    );
    fs.writeFileSync(
      path.join(projectDir, '.maestro', 'settings.json'),
      JSON.stringify({ tasks: { claimExpiresMinutes: 30, backend: 'fs' } }),
    );
    const adapter = new FsSettingsAdapter(projectDir, globalDir);
    const result = adapter.get();
    expect(result.tasks.claimExpiresMinutes).toBe(30);
    expect(result.tasks.backend).toBe('fs');
  });

  it('falls back to config.json migration when no settings.json', () => {
    const projectDir = path.join(tmpDir, 'project');
    fs.mkdirSync(projectDir, { recursive: true });
    fs.writeFileSync(
      path.join(globalDir, 'config.json'),
      JSON.stringify({ taskBackend: 'br', claimExpiresMinutes: 90 }),
    );
    const adapter = new FsSettingsAdapter(projectDir, globalDir);
    const result = adapter.get();
    expect(result.tasks.backend).toBe('br');
    expect(result.tasks.claimExpiresMinutes).toBe(90);
  });

  it('getToolConfig returns config for named tool', () => {
    const projectDir = path.join(tmpDir, 'project');
    fs.mkdirSync(path.join(projectDir, '.maestro'), { recursive: true });
    fs.writeFileSync(
      path.join(projectDir, '.maestro', 'settings.json'),
      JSON.stringify({ toolbox: { allow: [], deny: [], config: { br: { syncMode: 'eager' } } } }),
    );
    const adapter = new FsSettingsAdapter(projectDir, globalDir);
    expect(adapter.getToolConfig('br')).toEqual({ syncMode: 'eager' });
    expect(adapter.getToolConfig('unknown')).toEqual({});
  });

  it('caches result and invalidate clears cache', () => {
    const projectDir = path.join(tmpDir, 'project');
    fs.mkdirSync(path.join(projectDir, '.maestro'), { recursive: true });
    const settingsPath = path.join(projectDir, '.maestro', 'settings.json');
    fs.writeFileSync(settingsPath, JSON.stringify({ tasks: { claimExpiresMinutes: 60, backend: 'auto' } }));

    const adapter = new FsSettingsAdapter(projectDir, globalDir);
    expect(adapter.get().tasks.claimExpiresMinutes).toBe(60);

    // Modify file on disk
    fs.writeFileSync(settingsPath, JSON.stringify({ tasks: { claimExpiresMinutes: 99, backend: 'auto' } }));
    // Still cached
    expect(adapter.get().tasks.claimExpiresMinutes).toBe(60);
    // Invalidate
    adapter.invalidate();
    expect(adapter.get().tasks.claimExpiresMinutes).toBe(99);
  });
});
