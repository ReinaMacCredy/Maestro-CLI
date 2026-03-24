/**
 * Adapter SDK -- barrel export for transport modules.
 */

export { CliTransport } from './cli-transport.ts';
export { HttpTransport } from './http-transport.ts';
export { McpTransport } from './mcp-transport.ts';
export { McpBridge, extractText, extractJson } from './mcp-bridge.ts';
export { createMcpPortAdapter } from './bridge-adapter.ts';
export type { BridgeMapping } from './bridge-adapter.ts';
export type { McpToolResult, McpResource } from './mcp-transport.ts';
export {
  MockCliTransport,
  MockHttpTransport,
  MockMcpTransport,
  createTestContext,
} from './test-harness.ts';
export type {
  TransportType,
  CliTransportConfig,
  HttpTransportConfig,
  McpStdioTransportConfig,
  McpHttpTransportConfig,
  TransportResult,
} from './types.ts';
