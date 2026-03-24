import { describe, it, expect } from 'bun:test';

import { CliTransport } from '../../toolbox/sdk/cli-transport.ts';
import { inferTransport } from '../../toolbox/loader.ts';
import type { ToolManifest } from '../../toolbox/types.ts';

// ============================================================================
// CliTransport
// ============================================================================

describe('CliTransport', () => {
  it('executes command and parses JSON stdout', async () => {
    const transport = new CliTransport({
      binary: 'echo',
      cwd: '/tmp',
      toolName: 'echo-test',
    });
    const result = await transport.exec<{ hello: string }>(['{"hello":"world"}']);
    expect(result).toEqual({ hello: 'world' });
  });

  it('returns raw string when stdout is not JSON', async () => {
    const transport = new CliTransport({
      binary: 'echo',
      cwd: '/tmp',
      toolName: 'echo-test',
    });
    const result = await transport.exec<string>(['not json']);
    expect(typeof result).toBe('string');
    expect((result as string).trim()).toBe('not json');
  });

  it('throws MaestroError with install hint on ENOENT', async () => {
    const transport = new CliTransport({
      binary: 'nonexistent-tool-xyz-999',
      cwd: '/tmp',
      toolName: 'fake-tool',
      installHint: 'Run: cargo install fake-tool',
    });
    try {
      await transport.exec(['--version']);
      expect(true).toBe(false); // should not reach
    } catch (err: unknown) {
      const e = err as { message: string; hints?: string[] };
      expect(e.message).toContain('fake-tool not found');
      expect(e.hints).toContain('Run: cargo install fake-tool');
    }
  });

  it('throws on non-zero exit without retry', async () => {
    const transport = new CliTransport({
      binary: 'false',
      cwd: '/tmp',
      toolName: 'false-test',
    });
    try {
      await transport.exec([]);
      expect(true).toBe(false);
    } catch (err: unknown) {
      const e = err as { message: string };
      expect(e.message).toContain('false-test command failed');
    }
  });

  it('retries on configured exit codes', async () => {
    // 'sh -c exit 5' exits with code 5. With retryExitCodes=[5] and short delays,
    // it should retry and ultimately fail with retries exhausted message.
    const transport = new CliTransport({
      binary: 'sh',
      cwd: '/tmp',
      toolName: 'retry-test',
      retryExitCodes: [5],
      retryDelays: [10, 10], // fast retries for test
    });
    try {
      await transport.exec(['-c', 'exit 5']);
      expect(true).toBe(false);
    } catch (err: unknown) {
      const e = err as { message: string };
      // Should mention the tool name and exit code
      expect(e.message).toContain('retry-test');
    }
  });
});

// ============================================================================
// inferTransport
// ============================================================================

describe('inferTransport', () => {
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

  it('returns explicit transport when set', () => {
    expect(inferTransport(makeManifest({ name: 'a', transport: 'http' }))).toBe('http');
    expect(inferTransport(makeManifest({ name: 'a', transport: 'mcp-stdio' }))).toBe('mcp-stdio');
  });

  it('infers cli from binary field', () => {
    expect(inferTransport(makeManifest({ name: 'br', binary: 'br' }))).toBe('cli');
  });

  it('infers mcp-stdio from command field', () => {
    expect(inferTransport(makeManifest({ name: 'x', command: 'npx' }))).toBe('mcp-stdio');
  });

  it('infers mcp-http from url field', () => {
    expect(inferTransport(makeManifest({ name: 'x', url: 'http://localhost:3001/sse' }))).toBe('mcp-http');
  });

  it('infers http from baseUrl field', () => {
    expect(inferTransport(makeManifest({ name: 'x', baseUrl: 'http://localhost:8080' }))).toBe('http');
  });

  it('infers builtin when no transport indicators', () => {
    expect(inferTransport(makeManifest({ name: 'fs-tasks' }))).toBe('builtin');
  });

  it('explicit transport wins over inferred', () => {
    expect(inferTransport(makeManifest({ name: 'x', binary: 'br', transport: 'http' }))).toBe('http');
  });
});
