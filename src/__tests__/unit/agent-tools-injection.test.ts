import { describe, it, expect, beforeEach } from 'bun:test';

import { AgentToolsRegistry } from '../../toolbox/agents/registry.ts';
import { clearAgentToolCache } from '../../toolbox/agents/loader.ts';
import type { AgentToolManifest } from '../../toolbox/agents/types.ts';

const defaultSettings = { allow: [], deny: [], config: {} };

function makeManifest(name: string, binary: string): AgentToolManifest {
  return {
    name,
    binary,
    detect: `${binary} --version`,
    category: 'code-navigation',
    description: `Test ${name}`,
  };
}

describe('AgentToolsRegistry', () => {
  beforeEach(() => {
    clearAgentToolCache();
  });

  it('getInstalled returns only installed tools', () => {
    const manifests = [
      makeManifest('echo-test', 'echo'),
      makeManifest('nonexistent', 'nonexistent-xyz-999'),
    ];
    const registry = new AgentToolsRegistry(manifests, defaultSettings);
    const installed = registry.getInstalled();
    expect(installed.length).toBe(1);
    expect(installed[0].manifest.name).toBe('echo-test');
  });

  it('isAvailable respects deny list', () => {
    const manifests = [makeManifest('echo-test', 'echo')];
    const registry = new AgentToolsRegistry(manifests, { allow: [], deny: ['echo-test'], config: {} });
    expect(registry.isAvailable('echo-test')).toBe(false);
  });

  it('isAvailable respects allow list', () => {
    const manifests = [
      makeManifest('echo-a', 'echo'),
      makeManifest('echo-b', 'echo'),
    ];
    const registry = new AgentToolsRegistry(manifests, { allow: ['echo-a'], deny: [], config: {} });
    expect(registry.isAvailable('echo-a')).toBe(true);
    expect(registry.isAvailable('echo-b')).toBe(false);
  });

  it('getGuidance returns content for built-in tools', () => {
    const manifests = [makeManifest('rg', 'rg')];
    const registry = new AgentToolsRegistry(manifests, defaultSettings);
    const guidance = registry.getGuidance('rg');
    expect(guidance).not.toBeNull();
    expect(guidance).toContain('ripgrep');
  });

  it('getGuidance returns null for unknown tools', () => {
    const manifests = [makeManifest('unknown', 'echo')];
    const registry = new AgentToolsRegistry(manifests, defaultSettings);
    expect(registry.getGuidance('unknown')).toBeNull();
  });

  it('assembleProtocol loads and filters code-intelligence.md', () => {
    const manifests = [
      makeManifest('tilth', 'echo'),
      makeManifest('rg', 'echo'),
      makeManifest('sg', 'echo'),
    ];
    const registry = new AgentToolsRegistry(manifests, defaultSettings);
    const protocol = registry.assembleProtocol('code-intelligence');
    expect(protocol).not.toBeNull();
    expect(protocol).toContain('Chain Protocol');
    expect(protocol).toContain('SCOUT');
  });

  it('assembleProtocol returns null for unknown protocols', () => {
    const registry = new AgentToolsRegistry([], defaultSettings);
    expect(registry.assembleProtocol('nonexistent')).toBeNull();
  });
});

describe('buildAgentToolsRegistry', () => {
  beforeEach(() => {
    clearAgentToolCache();
  });

  it('builds from built-in manifests', async () => {
    const { buildAgentToolsRegistry } = await import('../../toolbox/agents/registry.ts');
    const registry = buildAgentToolsRegistry(defaultSettings);
    const all = registry.getAll();
    expect(all.length).toBe(4);
    expect(all.map(a => a.manifest.name).sort()).toEqual(['git', 'rg', 'sg', 'tilth']);
  });
});
