/**
 * maestro graph-next -- show recommended next bead.
 */

import { defineCommand } from 'citty';
import { getServices } from '../../services.ts';
import { output } from '../../lib/output.ts';
import { handleCommandError, MaestroError } from '../../lib/errors.ts';

export default defineCommand({
  meta: { name: 'graph-next', description: 'Show recommended next bead' },
  args: {},
  async run() {
    try {
      const services = getServices();
      if (!services.graphPort) {
        throw new MaestroError('bv not available', ['Install bv (beads viewer) for graph intelligence']);
      }

      const recommendation = await services.graphPort.getNextRecommendation();

      if (!recommendation) {
        output({ message: 'No recommendations available' }, () => 'No recommendations available.');
        return;
      }

      output(recommendation, (rec) => {
        const lines = [
          `Recommended: ${rec.id}`,
          `  Title: ${rec.title}`,
          `  Score: ${rec.score}`,
          `  Unblocks: ${rec.unblocks}`,
        ];
        if (rec.reasons.length > 0) {
          lines.push('  Reasons:');
          rec.reasons.forEach((r) => lines.push(`    - ${r}`));
        }
        return lines.join('\n');
      });
    } catch (err) {
      handleCommandError('graph-next', err);
    }
  },
});
