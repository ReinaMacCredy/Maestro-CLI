import { defineCommand, runMain } from 'citty';

const main = defineCommand({
  meta: {
    name: 'maestro',
    version: '0.1.0',
    description: 'Agent-optimized development orchestrator',
  },
  args: {
    json: {
      type: 'boolean',
      description: 'Output as JSON',
      default: false,
    },
    version: {
      type: 'boolean',
      alias: 'v',
      description: 'Show version',
      default: false,
    },
  },
  subCommands: {
    // WU6: Core commands (orchestrated use cases)
    // status, init, feature-complete, plan-write, plan-approve,
    // task-sync, worktree-start, worktree-commit, merge

    // WU7: Thin CRUD commands
    // feature-create, feature-list, feature-info, feature-active,
    // plan-read, plan-comment, plan-revoke, plan-comments-clear,
    // task-create, task-update, task-list, task-info, ...
  },
  run({ args }) {
    if (args.version) {
      console.log('0.1.0');
      return;
    }
    // No subcommand -- show help
    console.log('maestro 0.1.0 -- agent-optimized development orchestrator');
    console.log('Run `maestro --help` for usage.');
  },
});

runMain(main);
