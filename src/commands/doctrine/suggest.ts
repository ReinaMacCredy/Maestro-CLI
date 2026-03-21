/**
 * maestro doctrine-suggest -- suggest doctrine from cross-feature patterns.
 */

import { defineCommand } from 'citty';
import { getServices } from '../../services.ts';
import { output } from '../../lib/output.ts';
import { handleCommandError } from '../../lib/errors.ts';
import { suggestDoctrine } from '../../usecases/suggest-doctrine.ts';

export default defineCommand({
  meta: { name: 'doctrine-suggest', description: 'Suggest doctrine from cross-feature execution patterns' },
  args: {},
  async run() {
    try {
      const services = getServices();
      if (!services.doctrinePort) {
        console.error('[!] Doctrine port not available');
        process.exit(1);
      }

      const existing = services.doctrinePort.list({ status: 'active' });
      const config = services.configAdapter.get().doctrine;
      const result = suggestDoctrine(services.featureAdapter, services.memoryAdapter, existing, config);

      output(result, (r) => {
        if (r.suggestions.length === 0) {
          return `No doctrine suggestions (analyzed ${r.analysisStats.execMemoriesAnalyzed} memories, ${r.analysisStats.crossFeatureMatches} cross-feature matches).`;
        }
        const lines = [`${r.suggestions.length} suggestion(s):\n`];
        for (const s of r.suggestions) {
          lines.push(`[${s.confidence}] ${s.name} (${s.category})`);
          lines.push(`  Rule: ${s.rule}`);
          lines.push(`  From: ${s.source.features.join(', ')}`);
          lines.push('');
        }
        return lines.join('\n');
      });
    } catch (err) {
      handleCommandError('doctrine-suggest', err);
    }
  },
});
