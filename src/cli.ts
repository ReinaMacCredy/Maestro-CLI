import { defineCommand, runMain } from 'citty';
import { setOutputMode } from './lib/output.ts';
import { initServices } from './services.ts';
import { findProjectRoot } from './utils/detection.ts';
import { subCommands as generatedSubCommands } from './commands/_internal/registry.generated.ts';
import symphonyCmd from './commands/symphony/index.ts';
import { VERSION } from './version.ts';

const subCommands = { ...generatedSubCommands, symphony: symphonyCmd };
const subCommandNames = Object.keys(subCommands);
const metaCommands = new Set(['init', 'self-update', 'update']);

const main = defineCommand({
  meta: {
    name: 'maestro',
    version: VERSION,
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

    const isMetaCommand = process.argv.some(a => metaCommands.has(a));
    if (!isMetaCommand) {
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
      console.log(VERSION);
      return;
    }
    console.log(`maestro ${VERSION} -- agent-optimized development orchestrator`);
    console.log('Run `maestro --help` for usage.');
  },
});

runMain(main);
