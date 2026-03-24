/**
 * Agent tool type system -- manifests and status for code intelligence tools.
 * Agent tools provide guidance text for workers, not port implementations.
 */

export type AgentToolCategory = 'code-navigation' | 'text-search' | 'code-patterns' | 'version-control';

export interface AgentToolManifest {
  name: string;
  binary: string;
  detect: string;
  category: AgentToolCategory;
  description: string;
  minVersion?: string;
}

export interface AgentToolStatus {
  manifest: AgentToolManifest;
  installed: boolean;
  version?: string;
  detectError?: string;
}
