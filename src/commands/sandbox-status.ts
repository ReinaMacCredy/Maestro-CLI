/**
 * maestro sandbox-status -- show sandbox detection status.
 */

import { defineCommand } from 'citty';
import { DockerSandboxAdapter } from '../adapters/docker-sandbox.ts';
import { output } from '../lib/output.ts';
import { formatError, formatHint, MaestroError } from '../lib/errors.ts';

interface SandboxStatusResult {
  path: string;
  dockerAvailable: boolean;
  detectedImage: string | null;
}

function formatSandboxStatus(result: SandboxStatusResult): string {
  const lines: string[] = [];
  lines.push(`path: ${result.path}`);
  lines.push(`docker: ${result.dockerAvailable ? 'available' : 'not available'}`);
  if (result.detectedImage) {
    lines.push(`image: ${result.detectedImage}`);
  } else {
    lines.push('image: no sandbox detected');
  }
  return lines.join('\n');
}

export default defineCommand({
  meta: { name: 'sandbox-status', description: 'Show sandbox detection status' },
  args: {
    path: {
      type: 'string',
      description: 'Project path (defaults to cwd)',
    },
  },
  async run({ args }) {
    try {
      const targetPath = args.path || process.cwd();
      const dockerAvailable = DockerSandboxAdapter.isDockerAvailable();
      const detectedImage = DockerSandboxAdapter.detectImage(targetPath);

      const result: SandboxStatusResult = {
        path: targetPath,
        dockerAvailable,
        detectedImage,
      };

      output(result, formatSandboxStatus);
    } catch (err) {
      if (err instanceof MaestroError || err instanceof Error) {
        console.error(formatError('sandbox-status', err.message));
        if (err instanceof MaestroError) err.hints.forEach(h => console.error(formatHint(h)));
        process.exit(1);
      }
      throw err;
    }
  },
});
