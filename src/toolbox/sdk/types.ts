/**
 * Transport type system for the Adapter SDK.
 * Each transport type defines how maestro communicates with an external tool.
 */

export type TransportType = 'cli' | 'http' | 'mcp-stdio' | 'mcp-http' | 'builtin';

// ============================================================================
// Transport Configs
// ============================================================================

export interface CliTransportConfig {
  binary: string;
  cwd: string;
  /** Exit codes that trigger automatic retry (e.g. SQLite lock = 5). */
  retryExitCodes?: number[];
  /** Delay (ms) between retries. Length determines max retry count. */
  retryDelays?: number[];
  /** Max stdout buffer in bytes. Default: 10 MiB. */
  maxBuffer?: number;
  /** Human-readable tool name for error messages. */
  toolName: string;
  /** Install hint shown when binary is not found. */
  installHint?: string;
}

export interface HttpTransportConfig {
  baseUrl: string;
  /** Request timeout in ms. Default: 10000. */
  timeout?: number;
  /** Delay (ms) between retries on 5xx. Length determines max retry count. */
  retryDelays?: number[];
  /** Headers sent with every request. */
  authHeaders?: Record<string, string>;
  /** Swallow errors and return null instead of throwing. */
  bestEffort?: boolean;
}

export interface McpStdioTransportConfig {
  /** Command to launch the MCP server process. */
  command: string;
  /** Arguments for the command. */
  args?: string[];
  /** Environment variables for the subprocess. */
  env?: Record<string, string>;
  /** Working directory. */
  cwd?: string;
}

export interface McpHttpTransportConfig {
  /** URL of the MCP HTTP server (Streamable HTTP endpoint). */
  url: string;
  /** Auth headers for the connection. */
  authHeaders?: Record<string, string>;
}

// ============================================================================
// Transport Result
// ============================================================================

export interface TransportResult<T> {
  data?: T;
  error?: string;
  retryable: boolean;
}
