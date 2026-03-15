import { defineCommand } from 'citty';
import { getServices } from '../../services.ts';
import { output } from '../../lib/output.ts';
import { handleCommandError } from '../../lib/errors.ts';
import { finishTask } from '../../usecases/finish-task.ts';

function formatResult(result: Awaited<ReturnType<typeof finishTask>>): string {
  const lines: string[] = [];
  if (result.status === 'done') {
    lines.push(`[ok] task marked completed`);
  } else if (result.status === 'blocked' || result.status === 'partial') {
    lines.push(`[!] task marked ${result.status}`);
  } else {
    lines.push(`[x] task marked failed`);
  }
  lines.push(`  base: ${result.audit.baseCommit || 'unknown'}`);
  lines.push(`  head: ${result.audit.headCommit}`);
  lines.push(`  dirty: ${result.audit.dirtyWorkingTree ? 'yes' : 'no'}`);
  if (result.nextAction) lines.push(`  next: ${result.nextAction}`);
  return lines.join('\n');
}

export default defineCommand({
  meta: { name: 'task-finish', description: 'Finish a task attempt and persist report/audit data' },
  args: {
    feature: { type: 'string', description: 'Feature name', required: true },
    task: { type: 'string', description: 'Task folder ID', required: true },
    status: { type: 'string', description: 'One of: completed, blocked, failed, partial', required: true },
    summary: { type: 'string', description: 'Summary of work completed', required: true },
    blockerReason: { type: 'string', description: 'Reason the task is blocked' },
    blockerRecommendation: { type: 'string', description: 'Suggested unblock decision' },
  },
  async run({ args }) {
    try {
      const validStatuses = ['completed', 'blocked', 'failed', 'partial'] as const;
      type FinishStatus = typeof validStatuses[number];
      if (!validStatuses.includes(args.status as FinishStatus)) {
        throw new Error(`Invalid status '${args.status}'. Must be one of: ${validStatuses.join(', ')}`);
      }
      const services = getServices();
      const result = await finishTask(services, {
        feature: args.feature,
        task: args.task,
        status: args.status as FinishStatus,
        summary: args.summary,
        blockerReason: args.blockerReason,
        blockerRecommendation: args.blockerRecommendation,
      });
      output(result, formatResult);
    } catch (err) {
      handleCommandError('task-finish', err);
    }
  },
});
