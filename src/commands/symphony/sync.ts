/**
 * maestro symphony sync -- re-sync managed files from current repo state.
 */

import { defineCommand } from 'citty';
import { output } from '../../lib/output.ts';
import { handleCommandError } from '../../lib/errors.ts';

export default defineCommand({
  meta: { name: 'sync', description: 'Re-sync Symphony managed files from current repo state' },
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
      description: 'Overwrite drifted managed files',
      default: false,
    },
  },
  async run({ args: _args }) {
    try {
      // TODO: full sync flow (Slice 6)
      output(
        { status: 'not-implemented' },
        () => '[!] maestro symphony sync is not yet implemented.',
      );
    } catch (err) {
      handleCommandError('symphony sync', err);
    }
  },
});
