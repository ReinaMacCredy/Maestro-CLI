import type { PlanPort } from '../ports/plans.ts';
import type { FeaturePort } from '../ports/features.ts';
import type { TaskPort } from '../ports/tasks.ts';
import { MaestroError } from '../lib/errors.ts';
import scaffoldTemplate from '../templates/plan-scaffold.md';

const TASK_HEADING_RE = /^###\s+\d+\.\s+.+$/gm;

export interface WritePlanServices {
  planAdapter: PlanPort;
  featureAdapter: FeaturePort;
  taskPort?: TaskPort;
}

export interface WritePlanResult {
  path: string;
  feature: string;
  taskCount: number;
  scaffold?: boolean;
}

export interface WritePlanOpts {
  scaffold?: boolean;
}

function generateScaffold(featureName: string): string {
  return scaffoldTemplate.replace('{{featureName}}', featureName);
}

export async function writePlan(
  services: WritePlanServices,
  featureName: string,
  content: string,
  opts?: WritePlanOpts,
): Promise<WritePlanResult> {
  const { planAdapter, featureAdapter } = services;
  featureAdapter.requireActive(featureName);

  if (opts?.scaffold) {
    const template = generateScaffold(featureName);
    const planPath = planAdapter.write(featureName, template);
    const taskHeadings = template.match(TASK_HEADING_RE) || [];
    return { path: planPath, feature: featureName, taskCount: taskHeadings.length, scaffold: true };
  }

  // Validate Discovery section exists and is >= 100 chars
  const discoveryMatch = content.match(/## Discovery\s*\n([\s\S]*?)(?=\n##\s|$)/i);
  if (!discoveryMatch) {
    throw new MaestroError(
      'Plan must include a "## Discovery" section',
      ['Add a ## Discovery section documenting research findings']
    );
  }
  const discoveryContent = discoveryMatch[1].trim();
  if (discoveryContent.length < 100) {
    throw new MaestroError(
      `Discovery section too short (${discoveryContent.length} chars, min 100)`,
      ['Add more detail to the ## Discovery section']
    );
  }

  // Count task headings (### N. Task Name)
  const taskHeadings = content.match(TASK_HEADING_RE) || [];

  const wasApproved = planAdapter.isApproved(featureName);
  if (wasApproved && services.taskPort) {
    const tasks = await services.taskPort.list(featureName, { includeAll: true });
    if (tasks.length > 0) {
      throw new MaestroError(
        `Plan is approved with ${tasks.length} task(s). Revoke approval first before overwriting.`,
        [`Run: maestro plan-revoke --feature ${featureName}`],
      );
    }
  }

  const planPath = planAdapter.write(featureName, content);
  if (wasApproved) {
    featureAdapter.updateStatus(featureName, 'planning');
  }
  return { path: planPath, feature: featureName, taskCount: taskHeadings.length };
}
