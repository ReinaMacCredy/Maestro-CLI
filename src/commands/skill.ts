/**
 * maestro skill <name> -- load and print a skill template.
 */

import { defineCommand } from 'citty';
import { loadSkill } from '../skills/registry.ts';
import { output } from '../lib/output.ts';
import { formatError, formatHint, MaestroError } from '../lib/errors.ts';

function formatSkillContent(result: { content: string }): string {
  return result.content;
}

export default defineCommand({
  meta: { name: 'skill', description: 'Load and print a skill template' },
  args: {
    name: {
      type: 'positional',
      description: 'Skill name to load',
      required: true,
    },
  },
  async run({ args }) {
    try {
      const result = await loadSkill(args.name);

      if ('error' in result) {
        throw new MaestroError(result.error);
      }

      output(result, formatSkillContent);
    } catch (err) {
      if (err instanceof MaestroError || err instanceof Error) {
        console.error(formatError('skill', err.message));
        if (err instanceof MaestroError) err.hints.forEach(h => console.error(formatHint(h)));
        process.exit(1);
      }
      throw err;
    }
  },
});
