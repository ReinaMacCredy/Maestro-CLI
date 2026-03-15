/**
 * Symphony state model types.
 */

export interface SymphonyScanSummary {
  projectType: string;
  audience?: string;
  languages: string[];
  frameworks: string[];
  tools: string[];
  packageManager?: string;
  buildCommand?: string;
  testCommand?: string;
  devCommand?: string;
  lintCommand?: string;
  isMonorepo: boolean;
  monorepoPackages?: string[];
  sourceRoots: string[];
  hasProductGuidelines: boolean;
}

export type ManagedFileRole = 'context' | 'agents' | 'codex-skill' | 'workflow' | 'tracks';

export interface SymphonyManagedFile {
  path: string;              // relative to repo root
  role: ManagedFileRole;
  contentHash: string;       // SHA-256 of written content
}

export interface SymphonyManifest {
  version: 1;
  installedAt: string;       // ISO 8601
  lastSyncedAt: string;      // ISO 8601
  linearProjectSlug?: string;
  repoUrl?: string;
  primaryBranch: string;
  scanSummary: SymphonyScanSummary;
  managedFiles: SymphonyManagedFile[];
}

export type FileActionType = 'create' | 'update' | 'unchanged' | 'preserve-existing' | 'conflict';

export interface SymphonyPlannedAction {
  path: string;
  role: ManagedFileRole;
  action: FileActionType;
  /** New content to write (undefined for unchanged/preserve-existing) */
  content?: string;
  /** Hash of content currently on disk (undefined if file does not exist) */
  currentHash?: string;
  /** Hash recorded in manifest (undefined if not tracked) */
  manifestHash?: string;
}

export type InstallState = 'fresh' | 'partial-symphony' | 'complete-symphony' | 'foreign-config';
