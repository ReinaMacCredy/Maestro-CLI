import { describe, it, expect } from 'bun:test';

import { McpBridge, extractText, extractJson } from '../../toolbox/sdk/mcp-bridge.ts';
import { MockMcpTransport } from '../../toolbox/sdk/test-harness.ts';
import type { McpToolResult } from '../../toolbox/sdk/mcp-transport.ts';

// ============================================================================
// extractText / extractJson
// ============================================================================

describe('extractText', () => {
  it('extracts text from first content item', () => {
    const result: McpToolResult = { content: [{ type: 'text', text: 'hello' }] };
    expect(extractText(result)).toBe('hello');
  });

  it('returns empty string for empty content', () => {
    expect(extractText({ content: [] })).toBe('');
  });

  it('returns empty string for missing text', () => {
    expect(extractText({ content: [{ type: 'image' }] })).toBe('');
  });
});

describe('extractJson', () => {
  it('parses JSON from content text', () => {
    const result: McpToolResult = { content: [{ type: 'text', text: '{"count":42}' }] };
    expect(extractJson<{ count: number }>(result)).toEqual({ count: 42 });
  });

  it('throws on empty content', () => {
    expect(() => extractJson({ content: [] })).toThrow('empty content');
  });

  it('throws on invalid JSON', () => {
    const result: McpToolResult = { content: [{ type: 'text', text: 'not json' }] };
    expect(() => extractJson(result)).toThrow();
  });
});

// ============================================================================
// McpBridge error handling
// ============================================================================

describe('McpBridge', () => {
  it('wraps transform errors with tool name', async () => {
    const mock = new MockMcpTransport();
    mock.addToolResponse('bad_tool', { content: [{ type: 'text', text: 'not json' }] });

    const bridge = new McpBridge(mock as any);
    bridge.mapTool('bad_tool', (r) => JSON.parse(extractText(r)));

    try {
      await bridge.call('bad_tool');
      expect(true).toBe(false);
    } catch (err: unknown) {
      expect((err as Error).message).toContain("Transform failed for MCP tool 'bad_tool'");
    }
  });

  it('throws on isError response', async () => {
    const mock = new MockMcpTransport();
    mock.addToolResponse('err_tool', { content: [{ type: 'text', text: 'server error' }], isError: true });

    const bridge = new McpBridge(mock as any);
    bridge.mapTool('err_tool', () => null);

    try {
      await bridge.call('err_tool');
      expect(true).toBe(false);
    } catch (err: unknown) {
      expect((err as Error).message).toContain("returned error");
    }
  });

  it('discoverAndSuggest matches tool names to port methods', async () => {
    const mock = new MockMcpTransport();
    mock.setTools([
      { name: 'search_sessions', description: 'Search' },
      { name: 'get_insights', description: 'Graph insights' },
      { name: 'unrelated_tool', description: 'Something else' },
    ]);

    const bridge = new McpBridge(mock as any);
    const suggestions = await bridge.discoverAndSuggest('search');
    expect(suggestions.length).toBeGreaterThanOrEqual(1);
    expect(suggestions.some(s => s.portMethod === 'searchSessions')).toBe(true);

    const graphSuggestions = await bridge.discoverAndSuggest('graph');
    expect(graphSuggestions.some(s => s.portMethod === 'getInsights')).toBe(true);
  });

  it('discoverAndSuggest returns empty for unknown port', async () => {
    const mock = new MockMcpTransport();
    const bridge = new McpBridge(mock as any);
    const suggestions = await bridge.discoverAndSuggest('nonexistent');
    expect(suggestions).toEqual([]);
  });
});
