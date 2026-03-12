/**
 * maestro status -- composite feature status query.
 */

import { defineCommand } from 'citty';
import { getServices } from '../services.ts';
import { checkStatus, type StatusResult } from '../usecases/check-status.ts';
import { output, renderStatusLine } from '../lib/output.ts';
import { formatError, formatHint, MaestroError } from '../lib/errors.ts';
import { truncateList, formatTruncation } from '../lib/truncation.ts';

function formatStatus(result: StatusResult): string {
  const lines: string[] = [];

  lines.push('# maestro status');
  lines.push('');
  lines.push(renderStatusLine('feature', `${result.feature.name} [${result.feature.status}]`));

  const planLabel = result.plan.exists
    ? (result.plan.approved ? 'approved' : 'draft')
    : 'none';
  const commentSuffix = result.plan.commentCount > 0 ? ` (${result.plan.commentCount} comments)` : '';
  lines.push(renderStatusLine('plan', `${planLabel}${commentSuffix}`));

  const taskSummary = `${result.tasks.done}/${result.tasks.total} done, ` +
    `${result.tasks.inProgress} in_progress, ${result.tasks.pending} pending`;
  lines.push(renderStatusLine('tasks', taskSummary));

  const taskLines = result.tasks.items.map(t => {
    const status = `[${t.status}]`.padEnd(14);
    const blockedBy = result.blocked[t.folder];
    const suffix = blockedBy ? ` (blocked by: ${blockedBy.join(', ')})` : '';
    return `  ${status} ${t.folder}${suffix}`;
  });
  const { items: visibleTasks, truncated } = truncateList(taskLines, 20);
  lines.push(...visibleTasks);
  if (truncated > 0) {
    lines.push(`  ${formatTruncation(truncated, 'tasks')}`);
  }

  if (result.context.count > 0) {
    lines.push(renderStatusLine('context', `${result.context.count} files, ${result.context.totalChars} chars`));
  }

  lines.push(renderStatusLine('next', result.nextAction));

  return lines.join('\n');
}

export default defineCommand({
  meta: { name: 'status', description: 'Show feature status overview' },
  args: {
    feature: {
      type: 'string',
      description: 'Feature name (uses active feature if omitted)',
    },
  },
  async run({ args }) {
    try {
      const { taskPort, featureAdapter, planAdapter, contextAdapter } = getServices();

      let featureName = args.feature;
      if (!featureName) {
        const active = featureAdapter.getActive();
        featureName = active?.name;
      }
      if (!featureName) {
        throw new MaestroError('No feature specified and no active feature set', [
          'Specify --feature <name> or set active: maestro feature-active <name>',
        ]);
      }

      const result = await checkStatus(taskPort, featureAdapter, planAdapter, contextAdapter, featureName);
      output(result, formatStatus);
    } catch (err) {
      if (err instanceof MaestroError) {
        console.error(formatError('status', err.message));
        err.hints.forEach(h => console.error(formatHint(h)));
        process.exit(1);
      }
      throw err;
    }
  },
});
