/**
 * maestro graph-insights -- show dependency graph metrics.
 */

import { defineCommand } from 'citty';
import { getServices } from '../../services.ts';
import { output, renderTable } from '../../lib/output.ts';
import { handleCommandError, MaestroError } from '../../lib/errors.ts';

export default defineCommand({
  meta: { name: 'graph-insights', description: 'Show dependency graph metrics' },
  args: {},
  async run() {
    try {
      const services = getServices();
      if (!services.graphPort) {
        throw new MaestroError('bv not available', ['Install bv (beads viewer) for graph intelligence']);
      }

      const insights = await services.graphPort.getInsights();

      output(insights, (data) => {
        const lines: string[] = [
          `Nodes: ${data.nodeCount}  Edges: ${data.edgeCount}`,
          '',
        ];

        if (data.bottlenecks.length > 0) {
          lines.push('Bottlenecks:');
          lines.push(renderTable(
            ['ID', 'Title', 'Score'],
            data.bottlenecks.map((b) => [b.id, b.title, String(b.score)]),
          ));
          lines.push('');
        }

        if (data.criticalPath.length > 0) {
          lines.push('Critical Path:');
          lines.push(renderTable(
            ['ID', 'Title'],
            data.criticalPath.map((c) => [c.id, c.title]),
          ));
          lines.push('');
        }

        lines.push(`Velocity: ${data.velocity.closedLast7Days} closed (7d), ${data.velocity.closedLast30Days} closed (30d)`);
        return lines.join('\n');
      });
    } catch (err) {
      handleCommandError('graph-insights', err);
    }
  },
});
