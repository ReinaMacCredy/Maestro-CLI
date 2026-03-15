/**
 * maestro symphony -- parent command with nested subcommands.
 */

import { defineCommand } from 'citty';
import installCmd from './install.ts';
import syncCmd from './sync.ts';
import statusCmd from './status.ts';

export default defineCommand({
  meta: { name: 'symphony', description: 'Symphony onboarding and sync' },
  subCommands: {
    install: installCmd,
    sync: syncCmd,
    status: statusCmd,
  },
});
