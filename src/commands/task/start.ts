import { defineCommand } from 'citty';
import { getServices } from '../../services.ts';
import { output } from '../../lib/output.ts';
import { handleCommandError } from '../../lib/errors.ts';
import { startTask } from '../../usecases/start-task.ts';

function formatResult(result: Awaited<ReturnType<typeof startTask>>): string {
  const lines: string[] = [];
  if (result.finalStatus === 'done') {
    lines.push(`[ok] task '${result.task}' completed via ${result.launcher}`);
  } else if (result.finalStatus === 'blocked' || result.finalStatus === 'partial') {
    lines.push(`[!] task '${result.task}' ended as ${result.finalStatus}`);
  } else {
    lines.push(`[x] task '${result.task}' failed`);
  }
  lines.push(`  prompt: ${result.workerPromptPath}`);
  lines.push(`  session: ${result.sessionPath}`);
  lines.push(`  base: ${result.baseCommit}`);
  lines.push(`  head: ${result.headCommit}`);
  if (result.nextAction) lines.push(`  next: ${result.nextAction}`);
  return lines.join('\n');
}

export default defineCommand({
  meta: { name: 'task-start', description: 'Start a task with the configured worker CLI' },
  args: {
    feature: { type: 'string', description: 'Feature name', required: true },
    task: { type: 'string', description: 'Task folder ID', required: true },
    continueFrom: { type: 'string', description: 'Continuation mode: blocked or partial' },
    decision: { type: 'string', description: 'Decision text required for blocked continuation' },
    force: { type: 'boolean', description: 'Recover a stale in_progress task before restarting', default: false },
  },
  async run({ args }) {
    try {
      const services = getServices();
      const result = await startTask(services, {
        feature: args.feature,
        task: args.task,
        continueFrom: args.continueFrom === 'blocked' || args.continueFrom === 'partial'
          ? args.continueFrom
          : undefined,
        decision: args.decision,
        force: args.force,
      });
      output(result, formatResult);
    } catch (err) {
      handleCommandError('task-start', err);
    }
  },
});
