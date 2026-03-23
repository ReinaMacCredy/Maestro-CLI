/**
 * maestro task-next -- show runnable tasks and recommended next.
 */

import { defineCommand } from 'citty';
import { getServices } from '../../services.ts';
import { output, renderTable } from '../../lib/output.ts';
import { handleCommandError } from '../../lib/errors.ts';
import { requireFeature, FEATURE_HINT } from '../../core/resolve.ts';

export default defineCommand({
  meta: { name: 'task-next', description: 'Show runnable tasks and recommended next' },
  args: {
    feature: {
      type: 'string',
      description: 'Feature name (defaults to active feature)',
    },
  },
  async run({ args }) {
    try {
      const services = getServices();
      const featureName = requireFeature(services, args.feature, [
        FEATURE_HINT,
      ]);

      const runnable = await services.taskPort.getRunnable(featureName);
      const tasks = runnable.map((t) => ({
        folder: t.folder,
        name: t.name,
        dependsOn: t.dependsOn ?? [],
      }));

      const recommended = tasks[0];
      const recommendedSpec = recommended
        ? await services.taskPort.readSpec(featureName, recommended.folder)
        : null;

      const data = { feature: featureName, tasks, recommendedSpec };

      output(data, () => {
        if (tasks.length === 0) return 'No runnable tasks.';
        const headers = ['Folder', 'Name', 'Depends On'];
        const rows = tasks.map((t, i) => [
          i === 0 ? `${t.folder} [recommended]` : t.folder,
          t.name,
          t.dependsOn.length > 0 ? t.dependsOn.join(', ') : '-',
        ]);
        let out = renderTable(headers, rows);
        if (recommendedSpec) {
          out += `\n\n--- Recommended spec ---\n${recommendedSpec}`;
        }
        return out;
      });
    } catch (err) {
      handleCommandError('task-next', err);
    }
  },
});
