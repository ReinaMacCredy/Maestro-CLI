/**
 * Adapter SDK -- barrel export for transport modules.
 */

export { CliTransport } from './cli-transport.ts';
export { HttpTransport } from './http-transport.ts';
export { McpTransport } from './mcp-transport.ts';
export type { McpToolResult, McpResource } from './mcp-transport.ts';
export type {
  TransportType,
  CliTransportConfig,
  HttpTransportConfig,
  McpStdioTransportConfig,
  McpHttpTransportConfig,
  TransportResult,
} from './types.ts';
