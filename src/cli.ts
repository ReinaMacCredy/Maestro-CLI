import { defineCommand, runMain } from 'citty';
import { setOutputMode } from './lib/output.ts';
import { initServices } from './services.ts';
import { findProjectRoot } from './utils/detection.ts';
import { subCommands } from './commands/registry.generated.ts';

const subCommandNames = Object.keys(subCommands);

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
  subCommands,
  setup({ args }) {
    if (args.json) {
      setOutputMode('json');
    }

    const isInit = process.argv.includes('init');
    if (!isInit) {
      const projectRoot = findProjectRoot(process.cwd());
      if (projectRoot) {
        initServices(projectRoot);
      }
    }
  },
  run({ args, rawArgs }) {
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
