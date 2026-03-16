/**
 * Task spec builder for maestroCLI.
 * Extracted from utils/worker/spec.ts.
 *
 * Builds task spec content from plan sections, context, and dependency info.
 */

export interface BuildSpecParams {
  featureName: string;
  task: { folder: string; name: string; order: number; description?: string };
  dependsOn: string[];
  allTasks: Array<{ folder: string; name: string; order: number }>;
  planContent?: string | null;
  contextFiles?: Array<{ name: string; content: string }>;
  completedTasks?: Array<{ name: string; summary: string }>;
}

/**
 * Build spec content for a task.
 */
export function buildSpecContent(params: BuildSpecParams): string {
  const { featureName, task, dependsOn, allTasks, planContent, contextFiles = [], completedTasks = [] } = params;

  const specLines: string[] = [
    `# Task: ${task.folder}`,
    '',
    `## Feature: ${featureName}`,
    '',
    '## Dependencies',
    '',
  ];

  if (dependsOn.length > 0) {
    for (const dep of dependsOn) {
      const depTask = allTasks.find(t => t.folder === dep);
      if (depTask) {
        specLines.push(`- **${depTask.order}. ${depTask.name}** (${dep})`);
      } else {
        specLines.push(`- ${dep}`);
      }
    }
  } else {
    specLines.push('_None_');
  }

  specLines.push('', '## Plan Section', '');

  const planSection = extractPlanSection(planContent ?? null, task);
  if (planSection) {
    specLines.push(planSection.trim());
  } else {
    specLines.push('_No plan section available._');
  }

  specLines.push('');

  const taskType = getTaskType(planSection, task.name);
  if (taskType) {
    specLines.push('## Task Type', '', taskType, '');
  }

  if (contextFiles.length > 0) {
    const contextCompiled = contextFiles
      .map(f => `## ${f.name}\n\n${f.content}`)
      .join('\n\n---\n\n');
    specLines.push('## Context', '', contextCompiled, '');
  }

  if (completedTasks.length > 0) {
    const completedLines = completedTasks.map(t => `- ${t.name}: ${t.summary}`);
    specLines.push('## Completed Tasks', '', ...completedLines, '');
  }

  return specLines.join('\n');
}

/**
 * Extract the plan section for a specific task from plan.md content.
 */
export function extractPlanSection(
  planContent: string | null,
  task: { name: string; order: number; folder: string }
): string | null {
  if (!planContent) return null;

  const escapedTitle = task.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const titleRegex = new RegExp(`###\\s*\\d+\\.\\s*${escapedTitle}[\\s\\S]*?(?=###|$)`, 'i');
  let taskMatch = planContent.match(titleRegex);

  if (!taskMatch && task.order > 0) {
    const orderRegex = new RegExp(`###\\s*${task.order}\\.\\s*[^\\n]+[\\s\\S]*?(?=###|$)`, 'i');
    taskMatch = planContent.match(orderRegex);
  }

  return taskMatch ? taskMatch[0].trim() : null;
}

/**
 * Infer the task type from its plan section content.
 */
export function getTaskType(planSection: string | null, taskName: string): string | null {
  if (!planSection) {
    return null;
  }

  const fileTypeMatches = Array.from(planSection.matchAll(/-\s*(Create|Modify|Test):/gi)).map(
    match => match[1].toLowerCase()
  );
  const fileTypes = new Set(fileTypeMatches);

  if (fileTypes.size === 0) {
    return taskName.toLowerCase().includes('test') ? 'testing' : null;
  }

  if (fileTypes.size === 1) {
    const onlyType = Array.from(fileTypes)[0];
    if (onlyType === 'create') return 'greenfield';
    if (onlyType === 'test') return 'testing';
  }

  if (fileTypes.has('modify')) {
    return 'modification';
  }

  return null;
}
