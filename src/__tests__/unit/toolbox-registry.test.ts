import { describe, it, expect, beforeEach } from 'bun:test';

import { ToolboxRegistry, buildToolbox } from '../../toolbox/registry.ts';
import { clearDetectCache, ADAPTER_REGISTRY, loadAdapterFactory } from '../../toolbox/loader.ts';
import { DEFAULT_SETTINGS } from '../../core/settings.ts';
import type { MaestroSettings } from '../../core/settings.ts';
import type { ToolManifest } from '../../toolbox/types.ts';

// ============================================================================
// Helpers
// ============================================================================

function makeManifest(overrides: Partial<ToolManifest> & { name: string }): ToolManifest {
  return {
    binary: null,
    detect: null,
    provides: null,
    priority: 0,
    adapter: 'test.ts',
    ...overrides,
  };
}

function settingsWith(overrides: Partial<MaestroSettings>): MaestroSettings {
  return { ...DEFAULT_SETTINGS, ...overrides };
}

// ============================================================================
// ToolboxRegistry
// ============================================================================

describe('ToolboxRegistry', () => {
  beforeEach(() => {
    clearDetectCache();
  });

  it('resolves highest-priority provider', () => {
    const manifests = [
      makeManifest({ name: 'fs-tasks', provides: 'tasks', priority: 0 }),
      makeManifest({ name: 'br', provides: 'tasks', priority: 100, detect: 'echo ok' }),
    ];
    const registry = new ToolboxRegistry(manifests, DEFAULT_SETTINGS);
    const provider = registry.resolveProvider('tasks');
    expect(provider?.name).toBe('br');
  });

  it('falls back to lower-priority when higher is not installed', () => {
    const manifests = [
      makeManifest({ name: 'fs-tasks', provides: 'tasks', priority: 0 }),
      makeManifest({
        name: 'br', provides: 'tasks', priority: 100,
        binary: 'nonexistent-xyz-999', detect: 'nonexistent-xyz-999 --version',
      }),
    ];
    const registry = new ToolboxRegistry(manifests, DEFAULT_SETTINGS);
    const provider = registry.resolveProvider('tasks');
    expect(provider?.name).toBe('fs-tasks');
  });

  it('returns null when no provider exists for port', () => {
    const manifests = [
      makeManifest({ name: 'fs-tasks', provides: 'tasks', priority: 0 }),
    ];
    const registry = new ToolboxRegistry(manifests, DEFAULT_SETTINGS);
    expect(registry.resolveProvider('graph')).toBeNull();
  });

  it('excludes denied tools from resolution', () => {
    const manifests = [
      makeManifest({ name: 'fs-tasks', provides: 'tasks', priority: 0 }),
      makeManifest({ name: 'br', provides: 'tasks', priority: 100, detect: 'echo ok' }),
    ];
    const settings = settingsWith({
      toolbox: { allow: [], deny: ['br'], config: {} },
    });
    const registry = new ToolboxRegistry(manifests, settings);
    const provider = registry.resolveProvider('tasks');
    expect(provider?.name).toBe('fs-tasks');
  });

  it('allowlist mode: only allowed tools resolve', () => {
    const manifests = [
      makeManifest({ name: 'fs-tasks', provides: 'tasks', priority: 0 }),
      makeManifest({ name: 'br', provides: 'tasks', priority: 100, detect: 'echo ok' }),
      makeManifest({ name: 'bv', provides: 'graph', priority: 100, detect: 'echo ok' }),
    ];
    // Only allow br -- bv should be denied
    const settings = settingsWith({
      toolbox: { allow: ['br', 'fs-tasks'], deny: [], config: {} },
    });
    const registry = new ToolboxRegistry(manifests, settings);
    expect(registry.resolveProvider('tasks')?.name).toBe('br');
    expect(registry.resolveProvider('graph')).toBeNull();
  });

  it('isAvailable checks install + not denied', () => {
    const manifests = [
      makeManifest({ name: 'fs-tasks', provides: 'tasks', priority: 0 }),
      makeManifest({ name: 'br', provides: 'tasks', priority: 100, detect: 'echo ok' }),
      makeManifest({
        name: 'bv', provides: 'graph', priority: 100,
        binary: 'nonexistent-xyz-999', detect: 'nonexistent-xyz-999 --version',
      }),
    ];
    const registry = new ToolboxRegistry(manifests, DEFAULT_SETTINGS);
    expect(registry.isAvailable('fs-tasks')).toBe(true);
    expect(registry.isAvailable('br')).toBe(true);
    expect(registry.isAvailable('bv')).toBe(false); // not installed
    expect(registry.isAvailable('unknown')).toBe(false);
  });

  it('isAvailable returns false for denied tool', () => {
    const manifests = [
      makeManifest({ name: 'br', provides: 'tasks', priority: 100, detect: 'echo ok' }),
    ];
    const settings = settingsWith({
      toolbox: { allow: [], deny: ['br'], config: {} },
    });
    const registry = new ToolboxRegistry(manifests, settings);
    expect(registry.isAvailable('br')).toBe(false);
  });

  it('getManifest returns manifest or null', () => {
    const manifests = [
      makeManifest({ name: 'br', provides: 'tasks', priority: 100, detect: 'echo ok' }),
    ];
    const registry = new ToolboxRegistry(manifests, DEFAULT_SETTINGS);
    expect(registry.getManifest('br')?.name).toBe('br');
    expect(registry.getManifest('unknown')).toBeNull();
  });

  it('getStatus returns all tool statuses', () => {
    const manifests = [
      makeManifest({ name: 'fs-tasks', provides: 'tasks', priority: 0 }),
      makeManifest({ name: 'br', provides: 'tasks', priority: 100, detect: 'echo ok' }),
    ];
    const registry = new ToolboxRegistry(manifests, DEFAULT_SETTINGS);
    const statuses = registry.getStatus();
    expect(statuses).toHaveLength(2);
    expect(statuses.every(s => s.manifest && typeof s.installed === 'boolean')).toBe(true);
  });
});

// ============================================================================
// buildToolbox
// ============================================================================

describe('buildToolbox', () => {
  beforeEach(() => {
    clearDetectCache();
  });

  it('builds from bundled manifests', () => {
    const toolbox = buildToolbox(DEFAULT_SETTINGS);
    const statuses = toolbox.getStatus();
    expect(statuses.length).toBe(5);
    // fs-tasks is always available (built-in)
    expect(toolbox.isAvailable('fs-tasks')).toBe(true);
    // tasks port always resolves (at least fs-tasks)
    expect(toolbox.resolveProvider('tasks')).not.toBeNull();
  });
});

// ============================================================================
// ADAPTER_REGISTRY + loadAdapterFactory
// ============================================================================

describe('ADAPTER_REGISTRY', () => {
  it('has entries for all 5 tools', () => {
    const names = Object.keys(ADAPTER_REGISTRY).sort();
    expect(names).toEqual(['agent-mail', 'br', 'bv', 'cass', 'fs-tasks']);
  });

  it('loadAdapterFactory returns a function for known tools', async () => {
    const factory = await loadAdapterFactory('fs-tasks');
    expect(typeof factory).toBe('function');
  });

  it('loadAdapterFactory returns null for unknown tools', async () => {
    const factory = await loadAdapterFactory('nonexistent');
    expect(factory).toBeNull();
  });
});
