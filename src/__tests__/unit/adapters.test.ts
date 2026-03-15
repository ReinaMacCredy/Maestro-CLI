import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

import { DockerSandboxAdapter } from '../../adapters/docker-sandbox.ts';
import { AgentsMdAdapter } from '../../adapters/agents-md.ts';

// ---------------------------------------------------------------------------
// DockerSandboxAdapter
// ---------------------------------------------------------------------------

describe('DockerSandboxAdapter', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-docker-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // -- shellQuote is private, but we can verify its behavior through
  //    buildRunCommand and buildExecCommand which use it on every argument.

  describe('buildRunCommand (exercises shellQuote)', () => {
    test('normal strings produce valid docker run command', () => {
      const cmd = DockerSandboxAdapter.buildRunCommand('/app/work', 'echo hello', 'node:22-slim');
      expect(cmd).toBe(
        "docker run --rm -v '/app/work':/app -w /app 'node:22-slim' sh -c 'echo hello'"
      );
    });

    test('strings with spaces are properly quoted', () => {
      const cmd = DockerSandboxAdapter.buildRunCommand('/my app/dir', 'echo hi', 'node:22-slim');
      expect(cmd).toContain("'/my app/dir'");
    });

    test('strings with single quotes are escaped', () => {
      const cmd = DockerSandboxAdapter.buildRunCommand("/app", "echo 'hello world'", 'node:22-slim');
      // POSIX: embedded ' becomes '\''
      expect(cmd).toContain("'echo '\\''hello world'\\'''");
    });

    test('empty command string is quoted as empty single-quoted string', () => {
      const cmd = DockerSandboxAdapter.buildRunCommand('/app', '', 'node:22-slim');
      expect(cmd).toContain("sh -c ''");
    });

    test('special shell characters are safely quoted', () => {
      const cmd = DockerSandboxAdapter.buildRunCommand('/app', 'echo $HOME && rm -rf /', 'node:22-slim');
      // Everything inside single quotes is literal -- $ and & are not expanded
      expect(cmd).toContain("'echo $HOME && rm -rf /'");
    });

    test('backticks and double quotes are safely quoted', () => {
      const cmd = DockerSandboxAdapter.buildRunCommand('/app', 'echo "$(whoami)" `id`', 'node:22-slim');
      expect(cmd).toContain("'echo \"$(whoami)\" `id`'");
    });

    test('newlines in arguments are safely quoted', () => {
      const cmd = DockerSandboxAdapter.buildRunCommand('/app', 'line1\nline2', 'node:22-slim');
      expect(cmd).toContain("'line1\nline2'");
    });
  });

  describe('buildExecCommand (exercises shellQuote)', () => {
    test('builds valid docker exec command', () => {
      const cmd = DockerSandboxAdapter.buildExecCommand('my-container', 'npm test');
      expect(cmd).toBe("docker exec 'my-container' sh -c 'npm test'");
    });

    test('container names with special chars are quoted', () => {
      const cmd = DockerSandboxAdapter.buildExecCommand("it's-mine", 'ls');
      expect(cmd).toContain("'it'\\''s-mine'");
    });
  });

  // -- detectImage uses filesystem presence checks

  describe('detectImage', () => {
    test('returns null when Dockerfile exists', () => {
      fs.writeFileSync(path.join(tmpDir, 'Dockerfile'), 'FROM node');
      expect(DockerSandboxAdapter.detectImage(tmpDir)).toBeNull();
    });

    test('returns node image for package.json project', () => {
      fs.writeFileSync(path.join(tmpDir, 'package.json'), '{}');
      expect(DockerSandboxAdapter.detectImage(tmpDir)).toBe('node:22-slim');
    });

    test('returns python image for requirements.txt project', () => {
      fs.writeFileSync(path.join(tmpDir, 'requirements.txt'), 'flask');
      expect(DockerSandboxAdapter.detectImage(tmpDir)).toBe('python:3.12-slim');
    });

    test('returns python image for pyproject.toml project', () => {
      fs.writeFileSync(path.join(tmpDir, 'pyproject.toml'), '[project]');
      expect(DockerSandboxAdapter.detectImage(tmpDir)).toBe('python:3.12-slim');
    });

    test('returns go image for go.mod project', () => {
      fs.writeFileSync(path.join(tmpDir, 'go.mod'), 'module example');
      expect(DockerSandboxAdapter.detectImage(tmpDir)).toBe('golang:1.22-slim');
    });

    test('returns rust image for Cargo.toml project', () => {
      fs.writeFileSync(path.join(tmpDir, 'Cargo.toml'), '[package]');
      expect(DockerSandboxAdapter.detectImage(tmpDir)).toBe('rust:1.77-slim');
    });

    test('returns ubuntu fallback for unknown project', () => {
      expect(DockerSandboxAdapter.detectImage(tmpDir)).toBe('ubuntu:24.04');
    });

    test('Dockerfile takes priority over package.json', () => {
      fs.writeFileSync(path.join(tmpDir, 'Dockerfile'), 'FROM node');
      fs.writeFileSync(path.join(tmpDir, 'package.json'), '{}');
      expect(DockerSandboxAdapter.detectImage(tmpDir)).toBeNull();
    });
  });

  // -- containerName is a pure-ish function (only Date.now fallback is non-deterministic)

  describe('containerName', () => {
    test('extracts feature and task from .worktrees path', () => {
      const p = path.join('/project', '.worktrees', 'my-feature', 'task-1');
      const name = DockerSandboxAdapter.containerName(p);
      expect(name).toBe('hive-my-feature-task-1');
    });

    test('falls back to timestamp-based name without .worktrees', () => {
      const name = DockerSandboxAdapter.containerName('/some/random/path');
      expect(name).toMatch(/^hive-sandbox-\d+$/);
    });

    test('replaces invalid docker name characters with dashes', () => {
      const p = path.join('/project', '.worktrees', 'feat_Special!@#', 'task.2');
      const name = DockerSandboxAdapter.containerName(p);
      // Only [a-z0-9-] survive (case-insensitive replace, then toLowerCase)
      expect(name).not.toMatch(/[^a-z0-9-]/);
    });

    test('truncates to 63 characters', () => {
      const longFeature = 'a'.repeat(50);
      const longTask = 'b'.repeat(50);
      const p = path.join('/project', '.worktrees', longFeature, longTask);
      const name = DockerSandboxAdapter.containerName(p);
      expect(name.length).toBeLessThanOrEqual(63);
    });
  });

  // -- wrapCommand logic paths (no docker required for the non-docker paths)

  describe('wrapCommand', () => {
    test('strips HOST: prefix and returns raw command', () => {
      const result = DockerSandboxAdapter.wrapCommand(tmpDir, 'HOST: ls -la', {
        mode: 'docker',
      });
      expect(result).toBe('ls -la');
    });

    test('returns raw command when mode is none', () => {
      const result = DockerSandboxAdapter.wrapCommand(tmpDir, 'npm test', {
        mode: 'none',
      });
      expect(result).toBe('npm test');
    });

    test('returns raw command when Dockerfile detected (image is null) and no config image', () => {
      fs.writeFileSync(path.join(tmpDir, 'Dockerfile'), 'FROM node');
      const result = DockerSandboxAdapter.wrapCommand(tmpDir, 'npm test', {
        mode: 'docker',
      });
      expect(result).toBe('npm test');
    });

    test('uses config image when provided (non-persistent)', () => {
      const result = DockerSandboxAdapter.wrapCommand(tmpDir, 'npm test', {
        mode: 'docker',
        image: 'custom:latest',
      });
      expect(result).toContain("docker run --rm");
      expect(result).toContain("'custom:latest'");
      expect(result).toContain("'npm test'");
    });
  });
});

// ---------------------------------------------------------------------------
// AgentsMdAdapter
// ---------------------------------------------------------------------------

describe('AgentsMdAdapter', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-agentsmd-test-'));
    // Create minimal maestro structure for the context adapter
    fs.mkdirSync(path.join(tmpDir, '.maestro', 'features'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // Minimal mock for FsContextAdapter -- only list() is needed by the methods we test
  function mockContextAdapter(contexts: Array<{ name: string; content: string }>) {
    return {
      list: () => contexts.map((c, i) => ({
        name: c.name,
        content: c.content,
        feature: 'test-feature',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })),
      read: () => null,
      write: () => {},
      remove: () => false,
      archive: () => ({ archived: 0, skipped: 0 }),
      stats: () => ({ totalFiles: 0, totalBytes: 0, byFeature: {} }),
    } as any;
  }

  // -- apply: writes AGENTS.md and returns metadata

  describe('apply', () => {
    test('creates new AGENTS.md and reports isNew true', () => {
      const adapter = new AgentsMdAdapter(tmpDir, mockContextAdapter([]));
      const result = adapter.apply('# Guidelines\n\nFollow these rules.');
      expect(result.isNew).toBe(true);
      expect(result.chars).toBe('# Guidelines\n\nFollow these rules.'.length);
      expect(result.path).toBe(path.join(tmpDir, 'AGENTS.md'));
      expect(fs.existsSync(result.path)).toBe(true);
    });

    test('overwrites existing AGENTS.md and reports isNew false', () => {
      fs.writeFileSync(path.join(tmpDir, 'AGENTS.md'), 'old content');
      const adapter = new AgentsMdAdapter(tmpDir, mockContextAdapter([]));
      const result = adapter.apply('new content');
      expect(result.isNew).toBe(false);
      expect(fs.readFileSync(result.path, 'utf-8')).toBe('new content');
    });

    test('handles empty content', () => {
      const adapter = new AgentsMdAdapter(tmpDir, mockContextAdapter([]));
      const result = adapter.apply('');
      expect(result.chars).toBe(0);
      expect(result.isNew).toBe(true);
    });
  });

  // -- init: reads existing or generates new content

  describe('init', () => {
    test('returns existing content when AGENTS.md exists', async () => {
      const existing = '# My Project Guidelines\n';
      fs.writeFileSync(path.join(tmpDir, 'AGENTS.md'), existing);
      const adapter = new AgentsMdAdapter(tmpDir, mockContextAdapter([]));
      const result = await adapter.init();
      expect(result.existed).toBe(true);
      expect(result.content).toBe(existing);
    });

    test('generates template when no AGENTS.md exists', async () => {
      // Create a package.json to give the template something to detect
      fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
        scripts: { build: 'tsc', test: 'bun test', dev: 'bun run dev' },
      }));
      fs.writeFileSync(path.join(tmpDir, 'tsconfig.json'), '{}');
      const adapter = new AgentsMdAdapter(tmpDir, mockContextAdapter([]));
      const result = await adapter.init();
      expect(result.existed).toBe(false);
      expect(result.content).toContain('# Agent Guidelines');
      expect(result.content).toContain('TypeScript');
    });
  });

  // -- sync: exercises extractFindings, generateProposals, formatDiff

  describe('sync (extractFindings + generateProposals + formatDiff)', () => {
    test('extracts "we use" patterns from context', async () => {
      fs.writeFileSync(path.join(tmpDir, 'AGENTS.md'), '');
      const contexts = [
        { name: 'tech-stack', content: 'We use TypeScript for all backend code.' },
      ];
      const adapter = new AgentsMdAdapter(tmpDir, mockContextAdapter(contexts));
      const result = await adapter.sync('test-feature');
      expect(result.proposals.length).toBeGreaterThan(0);
      expect(result.proposals.some(p => p.toLowerCase().includes('we use typescript'))).toBe(true);
    });

    test('extracts "prefer X over Y" patterns', async () => {
      fs.writeFileSync(path.join(tmpDir, 'AGENTS.md'), '');
      const contexts = [
        { name: 'decisions', content: 'Prefer bun over npm for package management.' },
      ];
      const adapter = new AgentsMdAdapter(tmpDir, mockContextAdapter(contexts));
      const result = await adapter.sync('test-feature');
      expect(result.proposals.some(p => p.toLowerCase().includes('prefer bun over npm'))).toBe(true);
    });

    test('extracts "don\'t use" patterns', async () => {
      fs.writeFileSync(path.join(tmpDir, 'AGENTS.md'), '');
      const contexts = [
        { name: 'rules', content: "don't use any for TypeScript types." },
      ];
      const adapter = new AgentsMdAdapter(tmpDir, mockContextAdapter(contexts));
      const result = await adapter.sync('test-feature');
      expect(result.proposals.some(p => p.toLowerCase().includes("don't use any"))).toBe(true);
    });

    test('extracts "do not use" patterns', async () => {
      fs.writeFileSync(path.join(tmpDir, 'AGENTS.md'), '');
      const contexts = [
        { name: 'rules', content: 'Do not use console.log in production code.' },
      ];
      const adapter = new AgentsMdAdapter(tmpDir, mockContextAdapter(contexts));
      const result = await adapter.sync('test-feature');
      expect(result.proposals.some(p => p.toLowerCase().includes('do not use console'))).toBe(true);
    });

    test('extracts build/test/dev command patterns', async () => {
      fs.writeFileSync(path.join(tmpDir, 'AGENTS.md'), '');
      const contexts = [
        { name: 'setup', content: 'Build command: bun run build' },
      ];
      const adapter = new AgentsMdAdapter(tmpDir, mockContextAdapter(contexts));
      const result = await adapter.sync('test-feature');
      expect(result.proposals.some(p => p.toLowerCase().includes('build command'))).toBe(true);
    });

    test('extracts "X lives in /path" patterns', async () => {
      fs.writeFileSync(path.join(tmpDir, 'AGENTS.md'), '');
      const contexts = [
        { name: 'arch', content: 'Config lives in /etc/myapp' },
      ];
      const adapter = new AgentsMdAdapter(tmpDir, mockContextAdapter(contexts));
      const result = await adapter.sync('test-feature');
      expect(result.proposals.some(p => p.toLowerCase().includes('config lives in /etc/myapp'))).toBe(true);
    });

    test('skips comment lines (starting with #)', async () => {
      fs.writeFileSync(path.join(tmpDir, 'AGENTS.md'), '');
      const contexts = [
        { name: 'notes', content: '# We use Python for everything\nPlain text here.' },
      ];
      const adapter = new AgentsMdAdapter(tmpDir, mockContextAdapter(contexts));
      const result = await adapter.sync('test-feature');
      // The heading line should be skipped -- no "we use python" proposal
      expect(result.proposals.some(p => p.toLowerCase().includes('we use python'))).toBe(false);
    });

    test('deduplicates findings', async () => {
      fs.writeFileSync(path.join(tmpDir, 'AGENTS.md'), '');
      const contexts = [
        { name: 'a', content: 'We use bun for everything.' },
        { name: 'b', content: 'We use bun for everything.' },
      ];
      const adapter = new AgentsMdAdapter(tmpDir, mockContextAdapter(contexts));
      const result = await adapter.sync('test-feature');
      const bunProposals = result.proposals.filter(p => p.toLowerCase().includes('we use bun'));
      expect(bunProposals.length).toBe(1);
    });

    test('filters out findings already present in current AGENTS.md', async () => {
      fs.writeFileSync(path.join(tmpDir, 'AGENTS.md'), 'We use TypeScript for all backend code.');
      const contexts = [
        { name: 'tech', content: 'We use TypeScript for all backend code.' },
      ];
      const adapter = new AgentsMdAdapter(tmpDir, mockContextAdapter(contexts));
      const result = await adapter.sync('test-feature');
      expect(result.proposals.length).toBe(0);
      expect(result.diff).toBe('');
    });

    test('returns empty proposals and diff when no contexts', async () => {
      fs.writeFileSync(path.join(tmpDir, 'AGENTS.md'), '# Guidelines');
      const adapter = new AgentsMdAdapter(tmpDir, mockContextAdapter([]));
      const result = await adapter.sync('test-feature');
      expect(result.proposals).toEqual([]);
      expect(result.diff).toBe('');
    });

    test('formats diff with + prefix for each proposal', async () => {
      fs.writeFileSync(path.join(tmpDir, 'AGENTS.md'), '');
      const contexts = [
        { name: 'a', content: 'We use React for UI.' },
        { name: 'b', content: 'Prefer hooks over class components.' },
      ];
      const adapter = new AgentsMdAdapter(tmpDir, mockContextAdapter(contexts));
      const result = await adapter.sync('test-feature');
      const diffLines = result.diff.split('\n');
      for (const line of diffLines) {
        expect(line).toMatch(/^\+ /);
      }
    });
  });

  // -- Detection helpers (exercised through init)

  describe('project detection via init', () => {
    test('detects bun as package manager from bun.lockb', async () => {
      fs.writeFileSync(path.join(tmpDir, 'bun.lockb'), '');
      const adapter = new AgentsMdAdapter(tmpDir, mockContextAdapter([]));
      const result = await adapter.init();
      expect(result.content).toContain('bun');
    });

    test('detects yarn from yarn.lock', async () => {
      fs.writeFileSync(path.join(tmpDir, 'yarn.lock'), '');
      fs.writeFileSync(path.join(tmpDir, 'package.json'), '{}');
      const adapter = new AgentsMdAdapter(tmpDir, mockContextAdapter([]));
      const result = await adapter.init();
      expect(result.content).toContain('yarn');
    });

    test('detects Go language from go.mod', async () => {
      fs.writeFileSync(path.join(tmpDir, 'go.mod'), 'module example.com/m');
      const adapter = new AgentsMdAdapter(tmpDir, mockContextAdapter([]));
      const result = await adapter.init();
      expect(result.content).toContain('Go');
    });

    test('detects Rust language from Cargo.toml', async () => {
      fs.writeFileSync(path.join(tmpDir, 'Cargo.toml'), '[package]');
      const adapter = new AgentsMdAdapter(tmpDir, mockContextAdapter([]));
      const result = await adapter.init();
      expect(result.content).toContain('Rust');
    });

    test('detects Python from requirements.txt', async () => {
      fs.writeFileSync(path.join(tmpDir, 'requirements.txt'), 'flask');
      const adapter = new AgentsMdAdapter(tmpDir, mockContextAdapter([]));
      const result = await adapter.init();
      expect(result.content).toContain('Python');
    });

    test('detects vitest framework from devDependencies', async () => {
      fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
        devDependencies: { vitest: '^1.0.0' },
      }));
      const adapter = new AgentsMdAdapter(tmpDir, mockContextAdapter([]));
      const result = await adapter.init();
      expect(result.content).toContain('vitest');
    });

    test('detects monorepo from workspaces field', async () => {
      fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
        workspaces: ['packages/*'],
      }));
      const adapter = new AgentsMdAdapter(tmpDir, mockContextAdapter([]));
      const result = await adapter.init();
      expect(result.content).toContain('Monorepo');
    });

    test('includes build/test/dev commands from package.json scripts', async () => {
      fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
        scripts: { build: 'tsc', test: 'jest', dev: 'nodemon' },
      }));
      const adapter = new AgentsMdAdapter(tmpDir, mockContextAdapter([]));
      const result = await adapter.init();
      expect(result.content).toContain('Build');
      expect(result.content).toContain('Run tests');
      expect(result.content).toContain('Development mode');
    });

    test('handles invalid package.json gracefully', async () => {
      fs.writeFileSync(path.join(tmpDir, 'package.json'), 'not json!');
      const adapter = new AgentsMdAdapter(tmpDir, mockContextAdapter([]));
      const result = await adapter.init();
      // Should still generate a template without crashing
      expect(result.content).toContain('# Agent Guidelines');
    });
  });
});
