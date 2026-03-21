/**
 * Core types for maestroCLI.
 * Updated for v2 plugin model -- 6-state task model, no worker/session/sandbox types.
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

export type TaskStatusType = 'pending' | 'claimed' | 'done' | 'blocked' | 'review' | 'revision';
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
  // Verification fields (stored inline; full report in verification.json)
  revisionCount?: number;
  revisionFeedback?: string;
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
  // Verification fields (stored inline; full report in verification.json)
  revisionCount?: number;
  revisionFeedback?: string;
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
  warnings?: string[];
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
// Memory Types
// ============================================================================

export interface MemoryFile {
  name: string;
  content: string;
  updatedAt: string;
  sizeBytes: number;
}

export const MEMORY_CATEGORIES = ['decision', 'research', 'architecture', 'convention', 'debug', 'execution'] as const;
export type MemoryCategory = typeof MEMORY_CATEGORIES[number];

export interface MemoryMetadata {
  tags?: string[];
  priority?: number;       // 0 (highest) to 4 (lowest), default 2
  category?: MemoryCategory;
}

export interface MemoryFileWithMeta extends MemoryFile {
  metadata: MemoryMetadata;
  bodyContent: string;     // content WITHOUT frontmatter block
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
  taskBackend?: 'fs' | 'br' | 'auto';
  hook_cadence?: Record<string, number>;
  dcp?: {
    enabled?: boolean;                  // default true
    memoryBudgetBytes?: number;         // default 4096
    completedTaskBudgetBytes?: number;  // default 2048
    observationMasking?: boolean;       // default true
    relevanceThreshold?: number;        // minimum score to include, default 0.1
    handoffDecisionBudgetBytes?: number; // default 2048
  };
  verification?: {
    enabled?: boolean;              // default: true
    autoReject?: boolean;           // default: true (auto-transition review -> revision)
    maxRevisions?: number;          // default: 2
    autoAcceptTypes?: string[];     // task types that skip verification
    buildCommand?: string;          // auto-detected from package.json if omitted
    buildTimeoutMs?: number;        // default: 30000
    scoreThreshold?: number;        // 0.0-1.0, default: 0.7
  };
  doctrine?: {
    enabled?: boolean;                // default: true
    doctrineBudgetBytes?: number;     // default: 1024
    maxSuggestionsPerFeature?: number; // default: 5
    staleThresholdDays?: number;       // default: 90
    crossFeatureScanLimit?: number;    // default: 20
    minSampleSize?: number;            // default: 5 (min features with pattern for suggestion)
  };
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

export const DCP_DEFAULTS = {
  enabled: true,
  memoryBudgetBytes: 4096,
  completedTaskBudgetBytes: 2048,
  observationMasking: true,
  relevanceThreshold: 0.1,
  handoffDecisionBudgetBytes: 2048,
} satisfies Required<NonNullable<HiveConfig['dcp']>>;

export const DOCTRINE_DEFAULTS = {
  enabled: true,
  doctrineBudgetBytes: 1024,
  maxSuggestionsPerFeature: 5,
  staleThresholdDays: 90,
  crossFeatureScanLimit: 20,
  minSampleSize: 5,
} satisfies Required<NonNullable<HiveConfig['doctrine']>>;

export const VERIFICATION_DEFAULTS = {
  enabled: true,
  autoReject: true,
  maxRevisions: 2,
  autoAcceptTypes: [] as string[],
  buildTimeoutMs: 30000,
  scoreThreshold: 0.7,
} satisfies Omit<Required<NonNullable<HiveConfig['verification']>>, 'buildCommand'>;

export const DEFAULT_HIVE_CONFIG: HiveConfig = {
  $schema: 'https://raw.githubusercontent.com/tctinh/agent-hive/main/packages/opencode-hive/schema/agent_hive.schema.json',
  enableToolsFor: [],
  disableSkills: [],
  disableMcps: [],
  agentMode: 'unified',
  claimExpiresMinutes: 120,
  taskBackend: 'auto',
  dcp: DCP_DEFAULTS,
  doctrine: DOCTRINE_DEFAULTS,
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
