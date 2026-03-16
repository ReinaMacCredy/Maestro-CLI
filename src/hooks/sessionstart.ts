import { readStdin, writeOutput, resolveProjectDir, logHookError, HOOK_EVENTS } from './_helpers.ts';
import { initServices } from '../services.ts';
import { checkStatus, type StatusResult } from '../usecases/check-status.ts';
import { detectResearchTools } from '../utils/research-tools.ts';

const HOOK_NAME = 'sessionstart';

type PipelineStage = 'discovery' | 'research' | 'planning' | 'approval' | 'execution' | 'done';

function derivePipelineStage(result: StatusResult): PipelineStage {
  if (!result.plan.exists && result.tasks.total === 0) {
    return result.context.count > 0 ? 'research' : 'discovery';
  }
  if (result.plan.exists && !result.plan.approved) return 'planning';
  if (result.plan.approved && result.tasks.total === 0) return 'planning';
  if (result.tasks.total > 0 && result.tasks.done < result.tasks.total) return 'execution';
  if (result.tasks.total > 0 && result.tasks.done === result.tasks.total) return 'done';
  return 'discovery';
}

function buildResearchGuidance(tools: string[]): string[] {
  const lines: string[] = [];
  lines.push('Research: Use Agent subagents for codebase exploration, WebSearch + WebFetch for web research.');
  if (tools.includes('context7')) {
    lines.push('  [+] context7 detected -- use for up-to-date library docs and API references.');
  }
  if (tools.includes('notebooklm')) {
    lines.push('  [+] notebooklm detected -- use for deep multi-source research and analysis.');
  }
  if (tools.length === 0) {
    lines.push('  Tip: install context7 and notebooklm-mcp for enhanced research.');
  }
  return lines;
}

function buildPipelineGuidance(stage: PipelineStage): string {
  switch (stage) {
    case 'discovery':
      return 'Pipeline: discovery --> research --> planning --> execution. Start by exploring the feature scope with memory_write to capture findings.';
    case 'research':
      return 'Pipeline: discovery --> [research] --> planning --> execution. Continue research, then write the plan with plan_write.';
    case 'planning':
      return 'Pipeline: discovery --> research --> [planning] --> execution. Refine the plan and get approval with plan_approve.';
    case 'execution':
      return 'Pipeline: discovery --> research --> planning --> [execution]. Claim and complete tasks. Use task_next to find work.';
    case 'done':
      return 'Pipeline: complete. Review the feature and mark done with feature_complete.';
    default:
      return 'Use maestro_status for current state.';
  }
}

async function main(): Promise<void> {
  const projectDir = resolveProjectDir();

  const input = await readStdin();
  const source = (input.source as string) || 'startup';

  if (!projectDir) {
    writeOutput({});
    return;
  }

  const services = initServices(projectDir);
  const activeFeature = services.featureAdapter.getActive();

  if (!activeFeature) {
    const ctx = [
      '[maestro] No active feature.',
      'Use maestro MCP tools (maestro_status, maestro_feature_create) to start a new feature.',
    ].join('\n');
    writeOutput({
      hookSpecificOutput: {
        hookEventName: HOOK_EVENTS.SessionStart,
        additionalContext: ctx,
      },
    });
    return;
  }

  const featureName = activeFeature.name;
  const status = await checkStatus(services, featureName);
  const stage = derivePipelineStage(status);
  const researchTools = detectResearchTools(projectDir);

  const isCompact = source === 'compact' || source === 'resume';

  if (isCompact) {
    const lines = [
      `[maestro] Feature: ${featureName} [${stage}]`,
      `Tasks: ${status.tasks.pending} pending, ${status.tasks.inProgress} claimed, ${status.tasks.done} done (${status.tasks.total} total)`,
      `Next: ${status.nextAction}`,
    ];
    writeOutput({
      hookSpecificOutput: {
        hookEventName: HOOK_EVENTS.SessionStart,
        additionalContext: lines.join('\n'),
      },
    });
    return;
  }

  // Full context for startup
  const lines: string[] = [
    `[maestro] Feature: ${featureName} [${stage}]`,
    '',
    buildPipelineGuidance(stage),
    '',
    `Plan: ${status.plan.exists ? (status.plan.approved ? 'approved' : 'draft') : 'none'}`,
    `Tasks: ${status.tasks.pending} pending, ${status.tasks.inProgress} claimed, ${status.tasks.done} done (${status.tasks.total} total)`,
  ];

  if (stage === 'discovery' || stage === 'research') {
    lines.push('');
    lines.push(...buildResearchGuidance(researchTools));
  }

  if (status.runnable.length > 0) {
    lines.push('');
    lines.push('Runnable tasks:');
    for (const task of status.runnable) {
      lines.push(`  - ${task}`);
    }
  }

  if (status.blocked.length > 0) {
    lines.push('');
    lines.push('Blocked tasks:');
    for (const b of status.blocked) {
      lines.push(`  - ${b}`);
    }
  }

  lines.push('');
  lines.push(`Next: ${status.nextAction}`);

  // Recommend skills based on phase
  const skills: string[] = [];
  if (stage === 'discovery' || stage === 'research') {
    skills.push('maestro:brainstorming', 'maestro:parallel-exploration');
  } else if (stage === 'planning') {
    skills.push('maestro:design');
  } else if (stage === 'execution') {
    skills.push('maestro:implement', 'maestro:dispatching');
  }
  if (skills.length > 0) {
    lines.push('');
    lines.push(`Recommended skills: ${skills.join(', ')}`);
  }

  lines.push('');
  lines.push('Use maestro MCP tools (maestro_status, maestro_task_claim, maestro_task_done, etc.) for workflow orchestration.');

  writeOutput({
    hookSpecificOutput: {
      hookEventName: HOOK_EVENTS.SessionStart,
      additionalContext: lines.join('\n'),
    },
  });
}

try {
  await main();
} catch (error) {
  logHookError(resolveProjectDir(), HOOK_NAME, error);
  writeOutput({});
}
