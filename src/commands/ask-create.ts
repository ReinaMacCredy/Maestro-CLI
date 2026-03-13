/**
 * maestro ask-create -- create an ask (question) for a feature.
 */

import { defineCommand } from 'citty';
import { getServices } from '../services.ts';
import { output } from '../lib/output.ts';
import { handleCommandError } from '../lib/errors.ts';

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
      handleCommandError('ask-create', err);
    }
  },
});
