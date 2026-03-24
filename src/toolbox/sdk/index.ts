/**
 * Adapter SDK -- barrel export for transport modules.
 */

export { CliTransport } from './cli-transport.ts';
export { HttpTransport } from './http-transport.ts';
export { McpTransport } from './mcp-transport.ts';
export { McpBridge } from './mcp-bridge.ts';
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
