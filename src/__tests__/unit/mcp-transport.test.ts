import { describe, it, expect } from 'bun:test';

import { McpTransport } from '../../toolbox/sdk/mcp-transport.ts';

/**
 * MCP transport tests -- lightweight verification of construction and types.
 * Full integration tests against a real MCP server are deferred to toolbox test command.
 */

describe('McpTransport', () => {
  it('fromStdio creates a transport instance', () => {
    const transport = McpTransport.fromStdio({
      command: 'echo',
      args: ['hello'],
    });
    expect(transport).toBeDefined();
    expect(typeof transport.callTool).toBe('function');
    expect(typeof transport.readResource).toBe('function');
    expect(typeof transport.listTools).toBe('function');
    expect(typeof transport.close).toBe('function');
  });

  it('fromHttp creates a transport instance', () => {
    const transport = McpTransport.fromHttp({
      url: 'http://localhost:3001/mcp',
    });
    expect(transport).toBeDefined();
    expect(typeof transport.callTool).toBe('function');
  });

  it('fromStdio accepts env and cwd options', () => {
    const transport = McpTransport.fromStdio({
      command: 'npx',
      args: ['-y', '@scope/mcp-server'],
      env: { API_KEY: 'test' },
      cwd: '/tmp',
    });
    expect(transport).toBeDefined();
  });

  it('fromHttp accepts auth headers', () => {
    const transport = McpTransport.fromHttp({
      url: 'http://localhost:3001/mcp',
      authHeaders: { Authorization: 'Bearer token' },
    });
    expect(transport).toBeDefined();
  });

  it('close is safe to call without connecting', async () => {
    const transport = McpTransport.fromStdio({ command: 'echo' });
    // Should not throw
    await transport.close();
  });
});
