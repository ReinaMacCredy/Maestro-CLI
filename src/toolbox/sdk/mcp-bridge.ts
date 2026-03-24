/**
 * MCP Bridge -- maps MCP tool names to port method calls.
 * Scaffolding for Sprint 3; actual port implementations via bridge in Sprint 4.
 */

import type { McpTransport, McpToolResult } from './mcp-transport.ts';

export type ToolMapping<T> = (result: McpToolResult) => T;

/**
 * McpBridge auto-bridges MCP tools to port method calls.
 * Register mappings with mapTool(), then call tools with call().
 */
export class McpBridge {
  private transport: McpTransport;
  private mappings: Map<string, ToolMapping<unknown>> = new Map();
  private reverseMap: Map<string, string> = new Map(); // portMethod -> mcpTool

  constructor(transport: McpTransport) {
    this.transport = transport;
  }

  /**
   * Register a mapping from MCP tool name to a result transformer.
   * @param mcpToolName - Name of the MCP tool to call
   * @param transform - Transforms McpToolResult into the port's expected return type
   * @param portMethodName - Optional: associate with a port method name for reverse lookup
   */
  mapTool<T>(mcpToolName: string, transform: ToolMapping<T>, portMethodName?: string): this {
    this.mappings.set(mcpToolName, transform as ToolMapping<unknown>);
    if (portMethodName) {
      this.reverseMap.set(portMethodName, mcpToolName);
    }
    return this;
  }

  /**
   * Call an MCP tool and transform the result.
   */
  async call<T>(mcpToolName: string, args: Record<string, unknown> = {}): Promise<T> {
    const transform = this.mappings.get(mcpToolName);
    if (!transform) {
      throw new Error(`No mapping registered for MCP tool: ${mcpToolName}`);
    }
    const result = await this.transport.callTool(mcpToolName, args);
    return transform(result) as T;
  }

  /**
   * Call by port method name (reverse lookup).
   */
  async callByMethod<T>(portMethodName: string, args: Record<string, unknown> = {}): Promise<T> {
    const mcpTool = this.reverseMap.get(portMethodName);
    if (!mcpTool) {
      throw new Error(`No MCP tool mapped for port method: ${portMethodName}`);
    }
    return this.call<T>(mcpTool, args);
  }

  /** List all registered tool mappings. */
  getMappings(): string[] {
    return [...this.mappings.keys()];
  }

  /** Discover available tools from the MCP server. */
  async discoverTools(): Promise<Array<{ name: string; description?: string }>> {
    return this.transport.listTools();
  }

  /** Close the underlying transport. */
  async close(): Promise<void> {
    return this.transport.close();
  }
}
