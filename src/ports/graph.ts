/**
 * GraphPort -- abstract interface for dependency graph analysis.
 * Backed by bv (beads viewer) for graph-aware task routing.
 */

export interface GraphInsights {
  nodeCount: number;
  edgeCount: number;
  bottlenecks: Array<{ id: string; title: string; score: number }>;
  criticalPath: Array<{ id: string; title: string }>;
  velocity: { closedLast7Days: number; closedLast30Days: number };
}

export interface NextRecommendation {
  id: string;
  title: string;
  score: number;
  reasons: string[];
  unblocks: number;
}

export interface ExecutionTrack {
  name: string;
  beads: Array<{ id: string; title: string; order: number }>;
}

export interface ExecutionPlan {
  tracks: ExecutionTrack[];
  parallelism: number;
}

export interface GraphPort {
  /** Graph metrics: bottlenecks, critical path, velocity. */
  getInsights(): Promise<GraphInsights>;
  /** Top recommended next bead with scoring rationale. */
  getNextRecommendation(): Promise<NextRecommendation | null>;
  /** Dependency-respecting parallel execution tracks for N agents. */
  getExecutionPlan(agents?: number): Promise<ExecutionPlan>;
}
