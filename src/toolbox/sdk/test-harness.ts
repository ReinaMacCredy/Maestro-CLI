/**
 * Mock transports for testing adapter factories without real tools.
 */

import type { AdapterContext, ToolManifest } from '../types.ts';
import type { MaestroSettings } from '../../core/settings.ts';
import { DEFAULT_SETTINGS } from '../../core/settings.ts';

// ============================================================================
// Mock CLI Transport
// ============================================================================

export interface MockCliCall {
  args: string[];
  timestamp: number;
}

export class MockCliTransport {
  calls: MockCliCall[] = [];
  private responses: unknown[] = [];
  private responseIndex = 0;

  /** Queue a response for the next exec() call. */
  addResponse(data: unknown): this {
    this.responses.push(data);
    return this;
  }

  async exec<T = unknown>(args: string[]): Promise<T> {
    this.calls.push({ args, timestamp: Date.now() });
    const response = this.responses[this.responseIndex++];
    if (response instanceof Error) throw response;
    return (response ?? {}) as T;
  }
}

// ============================================================================
// Mock HTTP Transport
// ============================================================================

export interface MockHttpCall {
  method: string;
  path: string;
  body?: unknown;
  timestamp: number;
}

export class MockHttpTransport {
  calls: MockHttpCall[] = [];
  private responses: unknown[] = [];
  private responseIndex = 0;

  addResponse(data: unknown): this {
    this.responses.push(data);
    return this;
  }

  async get<T = unknown>(path: string): Promise<T | null> {
    this.calls.push({ method: 'GET', path, timestamp: Date.now() });
    return this.nextResponse<T>();
  }

  async post<T = unknown>(path: string, body: unknown): Promise<T | null> {
    this.calls.push({ method: 'POST', path, body, timestamp: Date.now() });
    return this.nextResponse<T>();
  }

  async rpc(tool: string, args: Record<string, unknown>): Promise<{ isError: boolean; text?: string }> {
    this.calls.push({ method: 'RPC', path: tool, body: args, timestamp: Date.now() });
    const r = this.nextResponse<{ isError: boolean; text?: string }>();
    return r ?? { isError: true, text: 'No response' };
  }

  private nextResponse<T>(): T | null {
    const response = this.responses[this.responseIndex++];
    if (response instanceof Error) throw response;
    return (response ?? null) as T | null;
  }
}

// ============================================================================
// Mock MCP Transport
// ============================================================================

export interface MockMcpCall {
  method: string;
  name: string;
  args?: Record<string, unknown>;
  timestamp: number;
}

export class MockMcpTransport {
  calls: MockMcpCall[] = [];
  private toolResponses: Map<string, unknown> = new Map();
  private resourceResponses: Map<string, unknown> = new Map();
  private tools: Array<{ name: string; description?: string }> = [];

  addToolResponse(name: string, data: unknown): this {
    this.toolResponses.set(name, data);
    return this;
  }

  addResource(uri: string, data: unknown): this {
    this.resourceResponses.set(uri, data);
    return this;
  }

  setTools(tools: Array<{ name: string; description?: string }>): this {
    this.tools = tools;
    return this;
  }

  async callTool(name: string, args: Record<string, unknown> = {}): Promise<unknown> {
    this.calls.push({ method: 'callTool', name, args, timestamp: Date.now() });
    return this.toolResponses.get(name) ?? { content: [], isError: true };
  }

  async readResource(uri: string): Promise<unknown> {
    this.calls.push({ method: 'readResource', name: uri, timestamp: Date.now() });
    return this.resourceResponses.get(uri) ?? null;
  }

  async listTools(): Promise<Array<{ name: string; description?: string }>> {
    this.calls.push({ method: 'listTools', name: '*', timestamp: Date.now() });
    return this.tools;
  }

  async close(): Promise<void> {
    this.calls.push({ method: 'close', name: '*', timestamp: Date.now() });
  }
}

// ============================================================================
// Test Context Factory
// ============================================================================

/**
 * Build a mock AdapterContext for testing adapter factories.
 */
export function createTestContext(overrides: Partial<AdapterContext> = {}): AdapterContext {
  const defaultManifest: ToolManifest = {
    name: 'test-tool',
    binary: null,
    detect: null,
    provides: null,
    priority: 0,
    adapter: 'test.ts',
  };

  return {
    projectRoot: '/tmp/test-project',
    settings: DEFAULT_SETTINGS,
    toolConfig: {},
    manifest: defaultManifest,
    ports: {},
    ...overrides,
  };
}
