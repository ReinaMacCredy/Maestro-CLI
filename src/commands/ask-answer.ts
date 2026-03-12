/**
 * maestro ask-answer -- answer a pending ask.
 */

import { defineCommand } from 'citty';
import { getServices } from '../services.ts';
import { output } from '../lib/output.ts';
import { formatError, formatHint, MaestroError } from '../lib/errors.ts';

export default defineCommand({
  meta: { name: 'ask-answer', description: 'Answer an ask' },
  args: {
    feature: {
      type: 'string',
      description: 'Feature name',
      required: true,
    },
    id: {
      type: 'string',
      description: 'Ask ID',
      required: true,
    },
    answer: {
      type: 'string',
      description: 'Answer text',
      required: true,
    },
  },
  async run({ args }) {
    try {
      const { askAdapter } = getServices();
      askAdapter.submitAnswer(args.feature, args.id, args.answer);
      output({ id: args.id, answered: true }, () => `[ok] ask '${args.id}' answered`);
    } catch (err) {
      if (err instanceof MaestroError || err instanceof Error) {
        console.error(formatError('ask-answer', err.message));
        if (err instanceof MaestroError) err.hints.forEach(h => console.error(formatHint(h)));
        process.exit(1);
      }
      throw err;
    }
  },
});
