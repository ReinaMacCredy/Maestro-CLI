/**
 * DoctrinePort -- abstract interface for doctrine storage.
 * Doctrine items are structured operating rules derived from execution history.
 * Separate from MemoryPort -- different lifecycle, JSON storage, effectiveness tracking.
 */

export type DoctrineStatus = 'active' | 'deprecated' | 'proposed';

export interface DoctrineConditions {
  /** Match when ANY tag overlaps with task-derived tags. */
  tags?: string[];
  /** Match when changed files match these glob patterns. */
  filePatterns?: string[];
}

export interface DoctrineEffectiveness {
  injectionCount: number;
  /** Running average of associated task success rate (0.0-1.0). */
  associatedSuccessRate: number;
  /** Tasks where doctrine was injected but needed revision. */
  overrideCount: number;
  lastInjectedAt?: string;
}

export interface DoctrineItem {
  name: string;
  /** The prescription -- what to do. */
  rule: string;
  /** Why this rule exists. */
  rationale: string;
  conditions: DoctrineConditions;
  tags: string[];
  source: {
    features: string[];
    memories: string[];
  };
  effectiveness: DoctrineEffectiveness;
  status: DoctrineStatus;
  createdAt: string;
  updatedAt: string;
  schemaVersion: number;
}

export interface DoctrinePort {
  /** Write or update a doctrine item. Returns the file path. */
  write(item: DoctrineItem): string;

  /** Read a single doctrine item by name. */
  read(name: string): DoctrineItem | null;

  /** List doctrine items, optionally filtered by status. */
  list(opts?: { status?: DoctrineStatus }): DoctrineItem[];

  /** Mark a doctrine item as deprecated. Returns the updated item. */
  deprecate(name: string): DoctrineItem;

  /** Find doctrine items relevant to a task by tag/keyword overlap. */
  findRelevant(tags: string[], keywords: Set<string>): DoctrineItem[];

  /** Record that a doctrine was injected for a task. Best-effort. */
  recordInjection(name: string, taskSucceeded: boolean): void;
}
