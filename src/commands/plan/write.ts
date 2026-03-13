/**
 * maestro plan-write -- write/update feature plan.
 */

import { defineCommand } from 'citty';
import { getServices } from '../../services.ts';
import { writePlan } from '../../usecases/write-plan.ts';
import { output } from '../../lib/output.ts';
import { handleCommandError, MaestroError } from '../../lib/errors.ts';
import * as fs from 'fs';

export default defineCommand({
  meta: { name: 'plan-write', description: 'Write or update feature plan' },
  args: {
    feature: {
      type: 'string',
      description: 'Feature name',
      required: true,
    },
    content: {
      type: 'string',
      description: 'Plan content (or use --file)',
    },
    file: {
      type: 'string',
      description: 'Read plan content from file',
    },
  },
  async run({ args }) {
    try {
      const services = getServices();

      let content = args.content;
      if (!content && args.file) {
        content = fs.readFileSync(args.file, 'utf-8');
      }
      if (!content) {
        throw new MaestroError('No content provided', [
          'Pass --content "..." or --file path/to/plan.md',
        ]);
      }

      const result = await writePlan(services, args.feature, content);
      output(result, (r) => `[ok] plan written for '${r.feature}' (${r.taskCount} task headings)`);
    } catch (err) {
      handleCommandError('plan-write', err);
    }
  },
});
