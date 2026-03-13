/**
 * maestro sandbox-wrap -- wrap a command in a Docker sandbox.
 */

import { defineCommand } from 'citty';
import { DockerSandboxAdapter } from '../adapters/docker-sandbox.ts';
import { output } from '../lib/output.ts';
import { handleCommandError } from '../lib/errors.ts';

interface WrapResult {
  original: string;
  wrapped: string;
}

function formatWrapResult(result: WrapResult): string {
  return result.wrapped;
}

export default defineCommand({
  meta: { name: 'sandbox-wrap', description: 'Wrap a command in Docker sandbox' },
  args: {
    command: {
      type: 'string',
      description: 'Command to wrap',
      required: true,
    },
    image: {
      type: 'string',
      description: 'Docker image override',
    },
    persistent: {
      type: 'boolean',
      description: 'Use persistent container',
      default: false,
    },
    path: {
      type: 'string',
      description: 'Project path (defaults to cwd)',
    },
  },
  async run({ args }) {
    try {
      const targetPath = args.path || process.cwd();
      const wrapped = DockerSandboxAdapter.wrapCommand(targetPath, args.command, {
        mode: 'docker',
        image: args.image,
        persistent: args.persistent,
      });

      const result: WrapResult = {
        original: args.command,
        wrapped,
      };

      output(result, formatWrapResult);
    } catch (err) {
      handleCommandError('sandbox-wrap', err);
    }
  },
});
