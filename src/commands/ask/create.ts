/**
 * maestro ask-create -- create an ask (question) for a feature.
 */

import { defineCommand } from 'citty';
import { getServices } from '../../services.ts';
import { output } from '../../lib/output.ts';
import { resolveFeature } from '../../utils/resolve-feature.ts';
import { handleCommandError } from '../../lib/errors.ts';

export default defineCommand({
  meta: { name: 'ask-create', description: 'Create an ask' },
  args: {
    question: {
      type: 'string',
      description: 'Question to ask',
      required: true,
    },
    feature: {
      type: 'string',
      description: 'Feature name (auto-resolved if omitted)',
    },
  },
  async run({ args }) {
    try {
      const feature = resolveFeature(args.feature);
      const { askAdapter } = getServices();
      const ask = askAdapter.createAsk(feature, args.question);
      output(ask, (a) => `[ok] ask '${a.id}' created`);
    } catch (err) {
      handleCommandError('ask-create', err);
    }
  },
});
