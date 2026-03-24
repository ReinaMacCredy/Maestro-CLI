/**
 * Toolbox type system -- manifest schema, tool status, adapter context.
 */

import type { MaestroSettings } from '../core/settings.ts';
import type { TransportType } from './sdk/types.ts';

// ============================================================================
// Manifest
// ============================================================================

export interface ToolManifest {
  /** Unique tool name (e.g. 'br', 'bv', 'fs-tasks'). */
  name: string;
  description?: string;
  /** Binary name on PATH. null = built-in (no external binary). */
  binary: string | null;
  /** Shell command to detect availability. null = always available. */
  detect: string | null;
  install?: string;
  homepage?: string;
  /** Port name this tool provides: 'tasks' | 'graph' | 'search' | 'handoff' | null. */
  provides: string | null;
  /** Higher wins when multiple tools provide the same port. */
  priority: number;
  /** Relative path to adapter module from toolbox root. */
  adapter: string;
  /** AdapterContext keys the adapter factory needs (e.g. ['projectRoot', 'taskPort']). */
  inject?: string[];
  /** Other tool names that must be present for this tool to work. */
  requires?: string[];
  /** Transport type. Inferred from binary/detect if absent. */
  transport?: TransportType;
  /** MCP stdio: command to launch server. */
  command?: string;
  /** MCP stdio: arguments for the command. */
  args?: string[];
  /** MCP stdio: environment variables. */
  env?: Record<string, string>;
  /** HTTP/MCP-HTTP: base URL or endpoint URL. */
  url?: string;
  /** HTTP: base URL for API calls. */
  baseUrl?: string;
}

// ============================================================================
// Tool Status
// ============================================================================

export interface ToolStatus {
  manifest: ToolManifest;
  installed: boolean;
  version?: string;
  settingsState: 'allowed' | 'denied' | 'default';
  detectError?: string;
  /** Resolved transport type (explicit or inferred). */
  transport: TransportType;
}

// ============================================================================
// Adapter Factory
// ============================================================================

export interface AdapterContext {
  projectRoot: string;
  settings: MaestroSettings;
  toolConfig: Record<string, unknown>;
  manifest: ToolManifest;
  /** Partially-built ports from Phase 1 resolution (available during Phase 2). */
  ports: Record<string, unknown>;
}

export type AdapterFactory<T = unknown> = (ctx: AdapterContext) => T;
