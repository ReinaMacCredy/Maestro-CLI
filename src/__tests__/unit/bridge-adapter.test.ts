import { describe, it, expect } from 'bun:test';

import { createMcpPortAdapter, extractJson } from '../../toolbox/sdk/bridge-adapter.ts';
import type { BridgeMapping } from '../../toolbox/sdk/bridge-adapter.ts';
import { MockMcpTransport } from '../../toolbox/sdk/test-harness.ts';
import { McpBridge } from '../../toolbox/sdk/mcp-bridge.ts';
import type { SearchPort, SessionSearchResult } from '../../search/port.ts';
import type { GraphPort, GraphInsights } from '../../tasks/graph/port.ts';

// ============================================================================
// SearchPort bridge
// ============================================================================

describe('SearchPort via McpBridge', () => {
  it('searchSessions routes through bridge and parses results', async () => {
    const mock = new MockMcpTransport();
    const results: SessionSearchResult[] = [
      { sessionPath: '/test/session.md', agent: 'claude', matchLine: 'auth flow', lineNumber: 42, score: 0.9 },
    ];
    mock.addToolResponse('search_sessions', { content: [{ type: 'text', text: JSON.stringify(results) }] });

    const bridge = new McpBridge(mock as any);
    bridge.mapTool<SessionSearchResult[]>('search_sessions', (r) => extractJson(r), 'searchSessions');

    const output = await bridge.callByMethod<SessionSearchResult[]>('searchSessions', { query: 'auth' });
    expect(output).toHaveLength(1);
    expect(output[0].sessionPath).toBe('/test/session.md');
    expect(output[0].score).toBe(0.9);
  });
});

// ============================================================================
// GraphPort bridge
// ============================================================================

describe('GraphPort via McpBridge', () => {
  it('getInsights routes through bridge and parses results', async () => {
    const mock = new MockMcpTransport();
    const insights: GraphInsights = {
      nodeCount: 10,
      edgeCount: 15,
      bottlenecks: [{ id: '1', title: 'Setup', score: 0.8 }],
      criticalPath: [{ id: '1', title: 'Setup' }],
      velocity: { closedLast7Days: 3, closedLast30Days: 12 },
    };
    mock.addToolResponse('get_insights', { content: [{ type: 'text', text: JSON.stringify(insights) }] });

    const bridge = new McpBridge(mock as any);
    bridge.mapTool<GraphInsights>('get_insights', (r) => extractJson(r), 'getInsights');

    const output = await bridge.callByMethod<GraphInsights>('getInsights');
    expect(output.nodeCount).toBe(10);
    expect(output.bottlenecks).toHaveLength(1);
  });
});

// ============================================================================
// Error handling
// ============================================================================

describe('McpBridge error scenarios', () => {
  it('handles MCP tool isError response', async () => {
    const mock = new MockMcpTransport();
    mock.addToolResponse('fail_tool', { content: [{ type: 'text', text: 'Server error' }], isError: true });

    const bridge = new McpBridge(mock as any);
    bridge.mapTool('fail_tool', () => null, 'doSomething');

    try {
      await bridge.callByMethod('doSomething');
      expect(true).toBe(false);
    } catch (err: unknown) {
      expect((err as Error).message).toContain('returned error');
    }
  });

  it('handles empty content gracefully', async () => {
    const mock = new MockMcpTransport();
    mock.addToolResponse('empty_tool', { content: [] });

    const bridge = new McpBridge(mock as any);
    bridge.mapTool('empty_tool', (r) => extractJson(r), 'parse');

    try {
      await bridge.callByMethod('parse');
      expect(true).toBe(false);
    } catch (err: unknown) {
      expect((err as Error).message).toContain('Transform failed');
    }
  });

  it('throws for unmapped method', async () => {
    const mock = new MockMcpTransport();
    const bridge = new McpBridge(mock as any);

    try {
      await bridge.callByMethod('nonexistent');
      expect(true).toBe(false);
    } catch (err: unknown) {
      expect((err as Error).message).toContain('No MCP tool mapped');
    }
  });
});
