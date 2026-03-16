/**
 * Core types for maestroCLI.
 * Updated for v2 plugin model -- 4-state task model, no worker/session/sandbox types.
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

export type TaskStatusType = 'pending' | 'claimed' | 'done' | 'blocked';
export type TaskOrigin = 'plan' | 'manual';

export interface TaskStatus {
  schemaVersion?: number;
  status: TaskStatusType;
  origin: TaskOrigin;
  planTitle?: string;
  summary?: string;
  claimedBy?: string;
  claimedAt?: string;
  completedAt?: string;
  blockerReason?: string;
  blockerDecision?: string;
  dependsOn?: string[];
}

export interface TaskInfo {
  folder: string;
  name: string;
  status: TaskStatusType;
  origin: TaskOrigin;
  planTitle?: string;
  summary?: string;
  claimedBy?: string;
  claimedAt?: string;
  completedAt?: string;
  blockerReason?: string;
  blockerDecision?: string;
  /** Task dependencies */
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
  claimExpiresMinutes: number;
  taskBackend?: 'fs' | 'br';
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

export type AgentName = keyof typeof DEFAULT_AGENT_MODELS;
export const AGENT_NAMES = Object.keys(DEFAULT_AGENT_MODELS) as AgentName[];

export const DEFAULT_HIVE_CONFIG: HiveConfig = {
  $schema: 'https://raw.githubusercontent.com/tctinh/agent-hive/main/packages/opencode-hive/schema/agent_hive.schema.json',
  enableToolsFor: [],
  disableSkills: [],
  disableMcps: [],
  agentMode: 'unified',
  claimExpiresMinutes: 120,
  taskBackend: 'fs',
  agents: {
    'hive-master': {
      model: DEFAULT_AGENT_MODELS['hive-master'],
      temperature: 0.5,
      skills: ['maestro:brainstorming', 'maestro:design', 'maestro:dispatching', 'maestro:implement'],
      autoLoadSkills: ['maestro:parallel-exploration'],
    },
    'architect-planner': {
      model: DEFAULT_AGENT_MODELS['architect-planner'],
      temperature: 0.7,
      skills: ['maestro:brainstorming', 'maestro:design'],
      autoLoadSkills: ['maestro:parallel-exploration'],
    },
    'swarm-orchestrator': {
      model: DEFAULT_AGENT_MODELS['swarm-orchestrator'],
      temperature: 0.5,
      skills: ['maestro:dispatching', 'maestro:implement'],
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
      autoLoadSkills: ['maestro:tdd', 'maestro:verification'],
    },
    'hygienic-reviewer': {
      model: DEFAULT_AGENT_MODELS['hygienic-reviewer'],
      temperature: 0.3,
      skills: ['maestro:debugging', 'maestro:review'],
      autoLoadSkills: [],
    },
  },
};
