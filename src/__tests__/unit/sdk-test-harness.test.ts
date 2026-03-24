import { describe, it, expect } from 'bun:test';

import {
  MockCliTransport,
  MockHttpTransport,
  MockMcpTransport,
  createTestContext,
} from '../../toolbox/sdk/test-harness.ts';
import { McpBridge } from '../../toolbox/sdk/mcp-bridge.ts';

// ============================================================================
// MockCliTransport
// ============================================================================

describe('MockCliTransport', () => {
  it('records calls and returns canned responses', async () => {
    const mock = new MockCliTransport();
    mock.addResponse({ status: 'ok' });
    mock.addResponse({ count: 42 });

    const r1 = await mock.exec(['--status']);
    const r2 = await mock.exec(['--count']);

    expect(r1).toEqual({ status: 'ok' });
    expect(r2).toEqual({ count: 42 });
    expect(mock.calls).toHaveLength(2);
    expect(mock.calls[0].args).toEqual(['--status']);
  });

  it('throws Error responses', async () => {
    const mock = new MockCliTransport();
    mock.addResponse(new Error('boom'));

    try {
      await mock.exec(['fail']);
      expect(true).toBe(false);
    } catch (err: unknown) {
      expect((err as Error).message).toBe('boom');
    }
  });
});

// ============================================================================
// MockHttpTransport
// ============================================================================

describe('MockHttpTransport', () => {
  it('records get/post calls', async () => {
    const mock = new MockHttpTransport();
    mock.addResponse({ data: 'get' });
    mock.addResponse({ data: 'post' });

    const r1 = await mock.get('/health');
    const r2 = await mock.post('/items', { name: 'test' });

    expect(r1).toEqual({ data: 'get' });
    expect(r2).toEqual({ data: 'post' });
    expect(mock.calls).toHaveLength(2);
    expect(mock.calls[0].method).toBe('GET');
    expect(mock.calls[1].body).toEqual({ name: 'test' });
  });

  it('rpc records tool calls', async () => {
    const mock = new MockHttpTransport();
    mock.addResponse({ isError: false, text: 'done' });

    const result = await mock.rpc('test_tool', { arg: 1 });
    expect(result.isError).toBe(false);
    expect(result.text).toBe('done');
    expect(mock.calls[0].method).toBe('RPC');
  });
});

// ============================================================================
// MockMcpTransport
// ============================================================================

describe('MockMcpTransport', () => {
  it('returns canned tool responses', async () => {
    const mock = new MockMcpTransport();
    mock.addToolResponse('search', { content: [{ type: 'text', text: 'found' }] });

    const result = await mock.callTool('search', { q: 'test' });
    expect(result).toEqual({ content: [{ type: 'text', text: 'found' }] });
    expect(mock.calls).toHaveLength(1);
  });

  it('returns canned resources', async () => {
    const mock = new MockMcpTransport();
    mock.addResource('file:///test.md', { text: 'hello' });

    const result = await mock.readResource('file:///test.md');
    expect(result).toEqual({ text: 'hello' });
  });

  it('lists configured tools', async () => {
    const mock = new MockMcpTransport();
    mock.setTools([{ name: 'search', description: 'Search things' }]);

    const tools = await mock.listTools();
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe('search');
  });
});

// ============================================================================
// McpBridge
// ============================================================================

describe('McpBridge', () => {
  it('maps tool name to transform and calls', async () => {
    const mock = new MockMcpTransport();
    mock.addToolResponse('mcp_search', { content: [{ type: 'text', text: '3 results' }] });

    const bridge = new McpBridge(mock as any);
    bridge.mapTool('mcp_search', (result) => {
      const text = result.content[0]?.text ?? '';
      return parseInt(text) || 0;
    });

    const count = await bridge.call<number>('mcp_search', { q: 'test' });
    expect(count).toBe(3);
  });

  it('callByMethod uses reverse lookup', async () => {
    const mock = new MockMcpTransport();
    mock.addToolResponse('tool_list', { content: [{ type: 'text', text: '[]' }] });

    const bridge = new McpBridge(mock as any);
    bridge.mapTool('tool_list', (r) => r.content[0]?.text, 'listTasks');

    const result = await bridge.callByMethod('listTasks');
    expect(result).toBe('[]');
  });

  it('throws for unmapped tool', async () => {
    const mock = new MockMcpTransport();
    const bridge = new McpBridge(mock as any);

    try {
      await bridge.call('unknown');
      expect(true).toBe(false);
    } catch (err: unknown) {
      expect((err as Error).message).toContain('No mapping');
    }
  });

  it('getMappings lists registered tools', () => {
    const mock = new MockMcpTransport();
    const bridge = new McpBridge(mock as any);
    bridge.mapTool('a', () => null);
    bridge.mapTool('b', () => null);

    expect(bridge.getMappings().sort()).toEqual(['a', 'b']);
  });
});

// ============================================================================
// createTestContext
// ============================================================================

describe('createTestContext', () => {
  it('returns valid AdapterContext with defaults', () => {
    const ctx = createTestContext();
    expect(ctx.projectRoot).toBe('/tmp/test-project');
    expect(ctx.manifest.name).toBe('test-tool');
    expect(ctx.settings).toBeDefined();
  });

  it('accepts overrides', () => {
    const ctx = createTestContext({
      projectRoot: '/custom',
      toolConfig: { key: 'value' },
    });
    expect(ctx.projectRoot).toBe('/custom');
    expect(ctx.toolConfig).toEqual({ key: 'value' });
  });
});
