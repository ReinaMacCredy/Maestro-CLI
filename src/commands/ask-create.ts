/**
 * maestro ask-create -- create an ask (question) for a feature.
 */

import { defineCommand } from 'citty';
import { getServices } from '../services.ts';
import { output } from '../lib/output.ts';
import { formatError, formatHint, MaestroError } from '../lib/errors.ts';

export default defineCommand({
  meta: { name: 'ask-create', description: 'Create an ask' },
  args: {
    feature: {
      type: 'string',
      description: 'Feature name',
      required: true,
    },
    question: {
      type: 'string',
      description: 'Question to ask',
      required: true,
    },
  },
  async run({ args }) {
    try {
      const { askAdapter } = getServices();
      const ask = askAdapter.createAsk(args.feature, args.question);
      output(ask, (a) => `[ok] ask '${a.id}' created`);
    } catch (err) {
      if (err instanceof MaestroError || err instanceof Error) {
        console.error(formatError('ask-create', err.message));
        if (err instanceof MaestroError) err.hints.forEach(h => console.error(formatHint(h)));
        process.exit(1);
      }
      throw err;
    }
  },
});
