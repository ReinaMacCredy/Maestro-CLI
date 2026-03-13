/**
 * maestro skill-list -- list available skills.
 */

import { defineCommand } from 'citty';
import { listSkills } from '../skills/registry.ts';
import { output, renderTable } from '../lib/output.ts';
import { handleCommandError } from '../lib/errors.ts';

function formatSkillList(skills: Array<{ name: string; description: string }>): string {
  if (skills.length === 0) return 'No skills available.';
  const rows = skills.map(s => [s.name, s.description]);
  return renderTable(['Name', 'Description'], rows);
}

export default defineCommand({
  meta: { name: 'skill-list', description: 'List available skills' },
  args: {},
  async run() {
    try {
      const skills = listSkills();
      output(skills, formatSkillList);
    } catch (err) {
      handleCommandError('skill-list', err);
    }
  },
});
