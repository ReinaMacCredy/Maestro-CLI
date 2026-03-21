/**
 * BvGraphAdapter -- GraphPort implementation backed by bv (beads viewer) CLI.
 *
 * Uses bv --robot-* flags for JSON output optimized for AI agents.
 * Gracefully returns empty/null when bv is not installed.
 */

import type { GraphPort, GraphInsights, NextRecommendation, ExecutionPlan } from '../ports/graph.ts';
import { CliRunner } from '../utils/cli-runner.ts';

export class BvGraphAdapter implements GraphPort {
  private cli: CliRunner;

  constructor(projectRoot: string) {
    this.cli = new CliRunner('bv', {
      cwd: projectRoot,
      toolName: 'bv',
      installHint: 'bv (beads viewer) is required. See: https://github.com/Dicklesworthstone/beads_viewer',
    });
  }

  async getInsights(): Promise<GraphInsights> {
    const raw = await this.cli.exec<Record<string, unknown>>(['-robot-insights', '-format', 'json']);
    return normalizeInsights(raw);
  }

  async getNextRecommendation(): Promise<NextRecommendation | null> {
    const raw = await this.cli.exec<Record<string, unknown>>(['-robot-next', '-format', 'json']);
    return normalizeNext(raw);
  }

  async getExecutionPlan(agents = 1): Promise<ExecutionPlan> {
    const raw = await this.cli.exec<Record<string, unknown>>(
      ['-robot-plan', '-agents', String(agents), '-format', 'json']
    );
    return normalizePlan(raw);
  }
}

// -- Normalization helpers (bv output shapes vary) --

function normalizeInsights(raw: Record<string, unknown>): GraphInsights {
  const graph = (raw.graph ?? raw) as Record<string, unknown>;
  const metrics = (raw.metrics ?? graph.metrics ?? {}) as Record<string, unknown>;

  return {
    nodeCount: asNumber(graph.node_count ?? metrics.node_count, 0),
    edgeCount: asNumber(graph.edge_count ?? metrics.edge_count, 0),
    bottlenecks: asArray(raw.bottlenecks ?? graph.bottlenecks).map(b => ({
      id: String((b as Record<string, unknown>).id ?? ''),
      title: String((b as Record<string, unknown>).title ?? ''),
      score: asNumber((b as Record<string, unknown>).score ?? (b as Record<string, unknown>).betweenness, 0),
    })),
    criticalPath: asArray(raw.critical_path ?? graph.critical_path).map(n => ({
      id: String((n as Record<string, unknown>).id ?? ''),
      title: String((n as Record<string, unknown>).title ?? ''),
    })),
    velocity: {
      closedLast7Days: asNumber(
        (raw.velocity as Record<string, unknown>)?.closed_7d ??
        (metrics.velocity as Record<string, unknown>)?.closed_7d, 0
      ),
      closedLast30Days: asNumber(
        (raw.velocity as Record<string, unknown>)?.closed_30d ??
        (metrics.velocity as Record<string, unknown>)?.closed_30d, 0
      ),
    },
  };
}

function normalizeNext(raw: Record<string, unknown>): NextRecommendation | null {
  const rec = (raw.recommendation ?? raw.pick ?? raw) as Record<string, unknown>;
  if (!rec || !rec.id) return null;

  return {
    id: String(rec.id),
    title: String(rec.title ?? ''),
    score: asNumber(rec.score ?? rec.priority_score, 0),
    reasons: asArray(rec.reasons ?? rec.rationale).map(r => String(r)),
    unblocks: asNumber(rec.unblocks ?? rec.dependents_count, 0),
  };
}

function normalizePlan(raw: Record<string, unknown>): ExecutionPlan {
  // bv nests tracks under raw.plan.tracks
  const planObj = (raw.plan ?? raw) as Record<string, unknown>;
  const tracks = asArray(planObj.tracks ?? raw.tracks ?? raw.execution_tracks ?? raw.phases);

  return {
    tracks: tracks.map((t, i) => {
      const track = t as Record<string, unknown>;
      return {
        name: String(track.name ?? track.track_id ?? track.label ?? `Track ${i + 1}`),
        beads: asArray(track.beads ?? track.issues ?? track.items).map((b, j) => {
          const bead = b as Record<string, unknown>;
          return {
            id: String(bead.id ?? ''),
            title: String(bead.title ?? ''),
            order: asNumber(bead.order ?? bead.position, j + 1),
          };
        }),
      };
    }),
    parallelism: tracks.length,
  };
}

function asNumber(v: unknown, fallback: number): number {
  const n = Number(v);
  return isNaN(n) ? fallback : n;
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}
