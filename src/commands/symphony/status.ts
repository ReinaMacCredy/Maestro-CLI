/**
 * maestro symphony status -- show Symphony manifest state and drift.
 */

import { defineCommand } from 'citty';
import { output } from '../../lib/output.ts';
import { handleCommandError } from '../../lib/errors.ts';

export default defineCommand({
  meta: { name: 'status', description: 'Show Symphony installation status and file drift' },
  args: {},
  async run() {
    try {
      // TODO: full status flow (Slice 7)
      output(
        { status: 'not-implemented' },
        () => '[!] maestro symphony status is not yet implemented.',
      );
    } catch (err) {
      handleCommandError('symphony status', err);
    }
  },
});
