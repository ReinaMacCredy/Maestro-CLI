/**
 * Core types for maestroCLI.
 * Forked from hive-core/src/types.ts with extensions for TaskPort and
 * types moved from service files to avoid cross-adapter imports.
 */

// ============================================================================
// Feature Types
// ============================================================================

export type FeatureStatusType = 'planning' | 'approved' | 'executing' | 'completed';

export interface FeatureJson {
  name: string;
  status: FeatureStatusType;
  ticket?: string;
  sessionId?: string;
  createdAt: string;
  approvedAt?: string;
  completedAt?: string;
}

// ============================================================================
// Task Types
// ============================================================================

export type TaskStatusType = 'pending' | 'in_progress' | 'done' | 'cancelled' | 'blocked' | 'failed' | 'partial';
export type TaskOrigin = 'plan' | 'manual';
export type SubtaskType = 'test' | 'implement' | 'review' | 'verify' | 'research' | 'debug' | 'custom';

export interface Subtask {
  id: string;
  name: string;
  folder: string;
  status: TaskStatusType;
  type?: SubtaskType;
  createdAt?: string;
  completedAt?: string;
}

export interface SubtaskStatus {
  status: TaskStatusType;
  type?: SubtaskType;
  createdAt: string;
  completedAt?: string;
}

export interface WorkerSession {
  taskId?: string;
  sessionId: string;
  workerId?: string;
  agent?: string;
  mode?: 'inline' | 'delegate';
  lastHeartbeatAt?: string;
  attempt?: number;
  messageCount?: number;
}

export interface TaskStatus {
  schemaVersion?: number;
  status: TaskStatusType;
  origin: TaskOrigin;
  planTitle?: string;
  summary?: string;
  startedAt?: string;
  completedAt?: string;
  baseCommit?: string;
  subtasks?: Subtask[];
  idempotencyKey?: string;
  workerSession?: WorkerSession;
  dependsOn?: string[];
}

export interface TaskInfo {
  folder: string;
  name: string;
  status: TaskStatusType;
  origin: TaskOrigin;
  planTitle?: string;
  summary?: string;
  /** Task dependencies -- extended for TaskPort integration */
  dependsOn?: string[];
}

// ============================================================================
// Plan Types
// ============================================================================

export interface PlanComment {
  id: string;
  line: number;
  body: string;
  author: string;
  timestamp: string;
}

export interface CommentsJson {
  threads: PlanComment[];
}

export interface PlanReadResult {
  content: string;
  status: FeatureStatusType;
  comments: PlanComment[];
}

export interface TasksSyncResult {
  created: string[];
  removed: string[];
  kept: string[];
  manual: string[];
}

// ============================================================================
// Feature Info
// ============================================================================

export interface FeatureInfo {
  name: string;
  status: FeatureStatusType;
  tasks: TaskInfo[];
  hasPlan: boolean;
  commentCount: number;
}

// ============================================================================
// Context Types
// ============================================================================

export interface ContextFile {
  name: string;
  content: string;
  updatedAt: string;
}

// ============================================================================
// Session Types
// ============================================================================

export interface SessionInfo {
  sessionId: string;
  taskFolder?: string;
  startedAt: string;
  lastActiveAt: string;
  messageCount?: number;
}

export interface SessionsJson {
  master?: string;
  sessions: SessionInfo[];
}

// ============================================================================
// Task Spec
// ============================================================================

export interface TaskSpec {
  taskFolder: string;
  featureName: string;
  planSection: string;
  context: string;
  priorTasks: Array<{ folder: string; summary?: string }>;
}

// ============================================================================
// Config Types
// ============================================================================

export interface AgentModelConfig {
  model?: string;
  temperature?: number;
  skills?: string[];
  autoLoadSkills?: string[];
  variant?: string;
}

export interface HiveConfig {
  $schema?: string;
  enableToolsFor?: string[];
  disableSkills?: string[];
  disableMcps?: string[];
  omoSlimEnabled?: boolean;
  agentMode?: 'unified' | 'dedicated';
  agents?: {
    'hive-master'?: AgentModelConfig;
    'architect-planner'?: AgentModelConfig;
    'swarm-orchestrator'?: AgentModelConfig;
    'scout-researcher'?: AgentModelConfig;
    'forager-worker'?: AgentModelConfig;
    'hygienic-reviewer'?: AgentModelConfig;
  };
  sandbox?: 'none' | 'docker';
  dockerImage?: string;
  persistentContainers?: boolean;
  hook_cadence?: Record<string, number>;
}

export const DEFAULT_AGENT_MODELS = {
  'hive-master': 'github-copilot/claude-opus-4.5',
  'architect-planner': 'github-copilot/gpt-5.2-codex',
  'swarm-orchestrator': 'github-copilot/claude-opus-4.5',
  'scout-researcher': 'zai-coding-plan/glm-4.7',
  'forager-worker': 'github-copilot/gpt-5.2-codex',
  'hygienic-reviewer': 'github-copilot/gpt-5.2-codex',
} as const;

export const DEFAULT_HIVE_CONFIG: HiveConfig = {
  $schema: 'https://raw.githubusercontent.com/tctinh/agent-hive/main/packages/opencode-hive/schema/agent_hive.schema.json',
  enableToolsFor: [],
  disableSkills: [],
  disableMcps: [],
  agentMode: 'unified',
  sandbox: 'none',
  agents: {
    'hive-master': {
      model: DEFAULT_AGENT_MODELS['hive-master'],
      temperature: 0.5,
      skills: ['brainstorming', 'writing-plans', 'dispatching-parallel-agents', 'executing-plans'],
      autoLoadSkills: ['parallel-exploration'],
    },
    'architect-planner': {
      model: DEFAULT_AGENT_MODELS['architect-planner'],
      temperature: 0.7,
      skills: ['brainstorming', 'writing-plans'],
      autoLoadSkills: ['parallel-exploration'],
    },
    'swarm-orchestrator': {
      model: DEFAULT_AGENT_MODELS['swarm-orchestrator'],
      temperature: 0.5,
      skills: ['dispatching-parallel-agents', 'executing-plans'],
      autoLoadSkills: [],
    },
    'scout-researcher': {
      model: DEFAULT_AGENT_MODELS['scout-researcher'],
      temperature: 0.5,
      skills: [],
      autoLoadSkills: [],
    },
    'forager-worker': {
      model: DEFAULT_AGENT_MODELS['forager-worker'],
      temperature: 0.3,
      autoLoadSkills: ['test-driven-development', 'verification-before-completion'],
    },
    'hygienic-reviewer': {
      model: DEFAULT_AGENT_MODELS['hygienic-reviewer'],
      temperature: 0.3,
      skills: ['systematic-debugging', 'code-reviewer'],
      autoLoadSkills: [],
    },
  },
};

// ============================================================================
// Worktree Types (moved from worktreeService to avoid cross-adapter import)
// ============================================================================

export interface WorktreeInfo {
  path: string;
  branch: string;
  commit: string;
  feature: string;
  step: string;
}

export interface DiffResult {
  hasDiff: boolean;
  diffContent: string;
  filesChanged: string[];
  insertions: number;
  deletions: number;
}

export interface ApplyResult {
  success: boolean;
  error?: string;
  filesAffected: string[];
}

export interface CommitResult {
  committed: boolean;
  sha: string;
  message?: string;
}

export interface MergeResult {
  success: boolean;
  merged: boolean;
  sha?: string;
  filesChanged?: string[];
  conflicts?: string[];
  error?: string;
}

export interface WorktreeConfig {
  baseDir: string;
  hiveDir: string;
}

// ============================================================================
// Sandbox Types (moved from dockerSandboxService to avoid cross-adapter import)
// ============================================================================

export interface SandboxConfig {
  mode: 'none' | 'docker';
  image?: string;
  persistent?: boolean;
}
