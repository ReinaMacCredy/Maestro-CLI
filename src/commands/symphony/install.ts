/**
 * maestro symphony install -- onboard a repo with Symphony.
 */

import { defineCommand } from 'citty';
import { output } from '../../lib/output.ts';
import { handleCommandError } from '../../lib/errors.ts';

export default defineCommand({
  meta: { name: 'install', description: 'Install Symphony onboarding for current project' },
  args: {
    'dry-run': {
      type: 'boolean',
      description: 'Show planned actions without writing files',
      default: false,
    },
    yes: {
      type: 'boolean',
      alias: 'y',
      description: 'Skip confirmation prompt',
      default: false,
    },
    force: {
      type: 'boolean',
      description: 'Overwrite existing unmanaged files',
      default: false,
    },
    'linear-project': {
      type: 'string',
      description: 'Linear project slug for integration',
    },
    'repo-url': {
      type: 'string',
      description: 'Git remote URL (auto-detected if omitted)',
    },
  },
  async run({ args: _args }) {
    try {
      // TODO: full install flow (Slice 5)
      output(
        { status: 'not-implemented' },
        () => '[!] maestro symphony install is not yet implemented.',
      );
    } catch (err) {
      handleCommandError('symphony install', err);
    }
  },
});
