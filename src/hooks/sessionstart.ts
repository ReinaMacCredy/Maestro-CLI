import { readStdin, writeOutput, resolveProjectDir, logHookError } from './_helpers.ts';
import { initServices } from '../services.ts';
import { checkStatus } from '../usecases/check-status.ts';

const HOOK_NAME = 'sessionstart';

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
        hookEventName: 'SessionStart',
        additionalContext: ctx,
      },
    });
    return;
  }

  const featureName = activeFeature.name;
  const status = await checkStatus(services, featureName);

  const isCompact = source === 'compact' || source === 'resume';

  if (isCompact) {
    const lines = [
      `[maestro] Feature: ${featureName} (${status.feature.status})`,
      `Tasks: ${status.tasks.pending} pending, ${status.tasks.inProgress} in-progress, ${status.tasks.done} done (${status.tasks.total} total)`,
      `Next: ${status.nextAction}`,
    ];
    writeOutput({
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext: lines.join('\n'),
      },
    });
    return;
  }

  // Full context for startup
  const lines: string[] = [
    `[maestro] Feature: ${featureName} (${status.feature.status})`,
    '',
    `Plan: ${status.plan.exists ? (status.plan.approved ? 'approved' : 'draft') : 'none'}`,
    `Tasks: ${status.tasks.pending} pending, ${status.tasks.inProgress} in-progress, ${status.tasks.done} done (${status.tasks.total} total)`,
  ];

  if (status.runnable.length > 0) {
    lines.push('');
    lines.push('Runnable tasks:');
    for (const task of status.runnable) {
      lines.push(`  - ${task}`);
    }
  }

  if (status.zombies.length > 0) {
    lines.push('');
    lines.push('Zombie tasks (in_progress but no worktree):');
    for (const z of status.zombies) {
      lines.push(`  - ${z}`);
    }
  }

  lines.push('');
  lines.push(`Next: ${status.nextAction}`);

  // Recommend skills based on phase
  const skills: string[] = [];
  if (!status.plan.approved) {
    skills.push('writing-plans');
  }
  if (status.tasks.total > 0 && status.runnable.length > 0) {
    skills.push('executing-plans');
    skills.push('dispatching-parallel-agents');
  }
  if (skills.length > 0) {
    lines.push('');
    lines.push(`Recommended skills: ${skills.join(', ')}`);
  }

  lines.push('');
  lines.push('Use maestro MCP tools (maestro_status, maestro_worktree_start, etc.) for workflow orchestration.');

  writeOutput({
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
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
