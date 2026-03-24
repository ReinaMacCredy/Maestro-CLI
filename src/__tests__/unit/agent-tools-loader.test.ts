import { describe, it, expect, beforeEach } from 'bun:test';

import {
  scanAgentTools,
  detectAgentTool,
  clearAgentToolCache,
} from '../../toolbox/agents/loader.ts';
import type { AgentToolManifest } from '../../toolbox/agents/types.ts';

describe('scanAgentTools', () => {
  it('finds the 4 built-in agent tool manifests', () => {
    const manifests = scanAgentTools();
    expect(manifests.length).toBe(4);
    const names = manifests.map(m => m.name).sort();
    expect(names).toEqual(['git', 'rg', 'sg', 'tilth']);
  });

  it('each manifest has required fields', () => {
    const manifests = scanAgentTools();
    for (const m of manifests) {
      expect(m.name).toBeDefined();
      expect(m.binary).toBeDefined();
      expect(m.detect).toBeDefined();
      expect(m.category).toBeDefined();
      expect(m.description).toBeDefined();
    }
  });

  it('tilth is categorized as code-navigation', () => {
    const manifests = scanAgentTools();
    const tilth = manifests.find(m => m.name === 'tilth');
    expect(tilth?.category).toBe('code-navigation');
  });
});

describe('detectAgentTool', () => {
  beforeEach(() => {
    clearAgentToolCache();
  });

  it('detects a real binary (git)', () => {
    const manifest: AgentToolManifest = {
      name: 'git',
      binary: 'git',
      detect: 'git --version',
      category: 'version-control',
      description: 'Git',
    };
    const status = detectAgentTool(manifest);
    expect(status.installed).toBe(true);
    expect(status.version).toContain('git version');
  });

  it('marks missing binary as not installed', () => {
    const manifest: AgentToolManifest = {
      name: 'nonexistent',
      binary: 'nonexistent-xyz-999',
      detect: 'nonexistent-xyz-999 --version',
      category: 'code-navigation',
      description: 'Fake',
    };
    const status = detectAgentTool(manifest);
    expect(status.installed).toBe(false);
    expect(status.detectError).toBeDefined();
  });

  it('caches detection results', () => {
    const manifest: AgentToolManifest = {
      name: 'echo-cache',
      binary: 'echo',
      detect: 'echo cached',
      category: 'text-search',
      description: 'Echo',
    };
    const first = detectAgentTool(manifest);
    const second = detectAgentTool(manifest);
    expect(first.installed).toBe(second.installed);
  });
});
