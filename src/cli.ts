import { defineCommand, runMain } from 'citty';
import { setOutputMode } from './lib/output.ts';
import { initServices } from './services.ts';
import { findProjectRoot } from './utils/detection.ts';

// Lazy imports for subcommands
const lazyImport = (path: string) => import(path).then(m => m.default);

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
    'init': () => lazyImport('./commands/init.ts'),
    'status': () => lazyImport('./commands/status.ts'),
    'feature-create': () => lazyImport('./commands/feature-create.ts'),
    'feature-complete': () => lazyImport('./commands/feature-complete.ts'),
    'plan-write': () => lazyImport('./commands/plan-write.ts'),
    'plan-approve': () => lazyImport('./commands/plan-approve.ts'),
    'task-sync': () => lazyImport('./commands/task-sync.ts'),
    'worktree-start': () => lazyImport('./commands/worktree-start.ts'),
    'worktree-commit': () => lazyImport('./commands/worktree-commit.ts'),
    'merge': () => lazyImport('./commands/merge.ts'),
  },
  setup({ args }) {
    // Set output mode based on --json flag
    if (args.json) {
      setOutputMode('json');
    }

    // Initialize services (skip for init command -- it handles its own setup)
    const isInit = process.argv.includes('init');
    if (!isInit) {
      const projectRoot = findProjectRoot(process.cwd());
      if (projectRoot) {
        initServices(projectRoot);
      }
    }
  },
  run({ args, rawArgs }) {
    // citty calls parent run() even when subcommand matched.
    // Only show help/version when no subcommand was given.
    const subCommandNames = [
      'init', 'status', 'feature-create', 'feature-complete',
      'plan-write', 'plan-approve', 'task-sync',
      'worktree-start', 'worktree-commit', 'merge',
    ];
    const hasSubCommand = rawArgs.some(a => subCommandNames.includes(a));
    if (hasSubCommand) return;

    if (args.version) {
      console.log('0.1.0');
      return;
    }
    console.log('maestro 0.1.0 -- agent-optimized development orchestrator');
    console.log('Run `maestro --help` for usage.');
  },
});

runMain(main);
