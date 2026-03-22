/**
 * Visualize use case: gather maestro state data and render as interactive HTML.
 */

import type { MaestroServices } from '../services.ts';
import type {
  MaestroVisualType,
  VisualResult,
  PlanGraphData,
  StatusDashboardData,
  MemoryMapData,
  ExecutionTimelineData,
  DoctrineNetworkData,
} from '../utils/visual/types.ts';
import { renderPage, writeVisual } from '../utils/visual/renderer.ts';
import { renderPlanGraph } from '../utils/visual/templates/plan-graph.ts';
import { renderStatusDashboard } from '../utils/visual/templates/status-dashboard.ts';
import { renderMemoryMap } from '../utils/visual/templates/memory-map.ts';
import { renderExecutionTimeline } from '../utils/visual/templates/execution-timeline.ts';
import { renderDoctrineNetwork } from '../utils/visual/templates/doctrine-network.ts';
import { checkStatus, type StatusServices } from './check-status.ts';
import { executionInsights } from './execution-insights.ts';
import { MaestroError } from '../lib/errors.ts';
import { countTaskStatuses } from '../utils/workflow.ts';

// ============================================================================
// Data Gathering
// ============================================================================

async function gatherPlanGraph(feature: string, services: MaestroServices): Promise<PlanGraphData> {
  const tasks = await services.taskPort.list(feature, { includeAll: true });
  const plan = services.planAdapter.read(feature);

  return {
    tasks: tasks.map(t => ({
      folder: t.folder,
      name: t.name ?? t.folder,
      status: t.status,
      dependsOn: t.dependsOn ?? [],
      claimedBy: t.claimedBy,
      summary: t.summary,
    })),
    planContent: plan?.content,
    feature,
  };
}

async function gatherStatusDashboard(feature: string, services: MaestroServices): Promise<StatusDashboardData> {
  // Bridge MaestroServices to StatusServices
  const statusServices: StatusServices = {
    taskPort: services.taskPort,
    featureAdapter: services.featureAdapter,
    planAdapter: services.planAdapter,
    memoryAdapter: services.memoryAdapter,
    configAdapter: services.configAdapter,
    directory: services.directory,
    graphPort: services.graphPort,
    handoffPort: services.handoffPort,
    searchPort: services.searchPort,
  };

  const status = await checkStatus(statusServices, feature);

  // Doctrine stats from optional port
  const doctrineItems = services.doctrinePort?.list() ?? [];
  const doctrineStats = {
    total: doctrineItems.length,
    active: doctrineItems.filter(d => d.status === 'active').length,
    deprecated: doctrineItems.filter(d => d.status === 'deprecated').length,
  };

  const featureJson = services.featureAdapter.get(feature);

  return {
    feature: {
      name: status.feature.name,
      status: status.feature.status,
      createdAt: featureJson?.createdAt ?? '',
      approvedAt: featureJson?.approvedAt,
      completedAt: featureJson?.completedAt,
    },
    tasks: {
      total: status.tasks.total,
      pending: status.tasks.pending,
      claimed: status.tasks.inProgress,
      done: status.tasks.done,
      blocked: status.tasks.items.filter(t => t.status === 'blocked').length,
      review: status.tasks.review,
      revision: status.tasks.revision,
    },
    runnable: status.runnable,
    blocked: status.blocked,
    pipelineStage: status.nextAction.includes('plan') ? 'planning' : status.tasks.done === status.tasks.total && status.tasks.total > 0 ? 'done' : 'execution',
    memoryStats: { count: status.context.count, totalBytes: status.context.totalBytes },
    doctrineStats,
    nextAction: status.nextAction,
  };
}

async function gatherMemoryMap(feature: string, services: MaestroServices): Promise<MemoryMapData> {
  const memories = services.memoryAdapter.listWithMeta(feature);

  return {
    memories: memories.map(m => ({
      name: m.name,
      category: m.metadata.category,
      priority: m.metadata.priority,
      tags: m.metadata.tags ?? [],
      sizeBytes: m.sizeBytes,
      updatedAt: m.updatedAt,
    })),
    feature,
  };
}

async function gatherExecutionTimeline(feature: string, services: MaestroServices): Promise<ExecutionTimelineData> {
  const config = services.configAdapter.get();
  const result = await executionInsights(
    feature,
    services.taskPort,
    services.memoryAdapter,
    services.doctrinePort,
    config.doctrine,
  );

  return {
    insights: result.insights,
    knowledgeFlow: result.knowledgeFlow,
    coverage: result.coverage,
    doctrineEffectiveness: result.doctrineEffectiveness,
    feature,
  };
}

async function gatherDoctrineNetwork(feature: string, services: MaestroServices): Promise<DoctrineNetworkData> {
  if (!services.doctrinePort) {
    throw new MaestroError('Doctrine not configured', [
      'Run maestro doctrine-write to add doctrine items, then re-run this visualization.',
    ]);
  }

  return {
    items: services.doctrinePort.list(),
    feature,
  };
}

// ============================================================================
// Template Dispatch
// ============================================================================

export async function visualize(
  type: MaestroVisualType,
  featureName: string,
  services: MaestroServices,
  autoOpen: boolean = true,
): Promise<VisualResult> {
  const title = `${type}: ${featureName}`;
  const generatedAt = new Date().toISOString();

  let output;

  switch (type) {
    case 'plan-graph': {
      const data = await gatherPlanGraph(featureName, services);
      output = renderPlanGraph({ data, title, feature: featureName, generatedAt });
      break;
    }
    case 'status-dashboard': {
      const data = await gatherStatusDashboard(featureName, services);
      output = renderStatusDashboard({ data, title, feature: featureName, generatedAt });
      break;
    }
    case 'memory-map': {
      const data = await gatherMemoryMap(featureName, services);
      output = renderMemoryMap({ data, title, feature: featureName, generatedAt });
      break;
    }
    case 'execution-timeline': {
      const data = await gatherExecutionTimeline(featureName, services);
      output = renderExecutionTimeline({ data, title, feature: featureName, generatedAt });
      break;
    }
    case 'doctrine-network': {
      const data = await gatherDoctrineNetwork(featureName, services);
      output = renderDoctrineNetwork({ data, title, feature: featureName, generatedAt });
      break;
    }
    default: {
      const _exhaustive: never = type;
      throw new MaestroError(`Unknown visualization type: ${type}`);
    }
  }

  const html = renderPage({
    title,
    bodyHtml: output.bodyHtml,
    extraHead: output.extraHead,
    extraScripts: output.extraScripts,
  });

  return writeVisual(type, html, featureName, autoOpen);
}
