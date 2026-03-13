/**
 * maestro ask-answer -- answer a pending ask.
 */

import { defineCommand } from 'citty';
import { getServices } from '../services.ts';
import { output } from '../lib/output.ts';
import { resolveFeature } from '../lib/resolve-feature.ts';
import { handleCommandError } from '../lib/errors.ts';

export default defineCommand({
  meta: { name: 'ask-answer', description: 'Answer an ask' },
  args: {
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
    feature: {
      type: 'string',
      description: 'Feature name (auto-resolved if omitted)',
    },
  },
  async run({ args }) {
    try {
      const feature = resolveFeature(args.feature);
      const { askAdapter } = getServices();
      askAdapter.submitAnswer(feature, args.id, args.answer);
      output({ id: args.id, answered: true }, () => `[ok] ask '${args.id}' answered`);
    } catch (err) {
      handleCommandError('ask-answer', err);
    }
  },
});
