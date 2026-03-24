/**
 * maestro toolbox-create -- scaffold a new tool with manifest and adapter skeleton.
 */

import * as fs from 'fs';
import * as path from 'path';
import { defineCommand } from 'citty';
import { output } from '../../../core/output.ts';
import { MaestroError, handleCommandError } from '../../../core/errors.ts';
import type { TransportType } from '../../../toolbox/sdk/types.ts';

const VALID_TRANSPORTS: TransportType[] = ['cli', 'http', 'mcp-stdio', 'mcp-http'];

function generateManifest(name: string, transport: TransportType, provides?: string): string {
  const base: Record<string, unknown> = {
    name,
    transport,
    description: `TODO: describe ${name}`,
    priority: 100,
    adapter: `tools/external/${name}/adapter.ts`,
  };

  if (transport === 'cli') {
    base.binary = name;
    base.detect = `${name} --version`;
    base.install = `TODO: install instructions for ${name}`;
  } else if (transport === 'http') {
    base.binary = null;
    base.detect = null;
    base.baseUrl = 'http://localhost:8080';
  } else if (transport === 'mcp-stdio') {
    base.binary = null;
    base.detect = null;
    base.command = 'npx';
    base.args = ['-y', `@scope/${name}`];
  } else if (transport === 'mcp-http') {
    base.binary = null;
    base.detect = null;
    base.url = 'http://localhost:3001/mcp';
  }

  if (provides) base.provides = provides;
  else base.provides = null;

  return JSON.stringify(base, null, 2);
}

function generateAdapter(name: string, transport: TransportType): string {
  const importLine = transport === 'cli'
    ? "import { CliTransport } from '../../../sdk/cli-transport.ts';"
    : transport === 'http'
      ? "import { HttpTransport } from '../../../sdk/http-transport.ts';"
      : transport === 'mcp-stdio' || transport === 'mcp-http'
        ? "import { McpTransport } from '../../../sdk/mcp-transport.ts';"
        : '';

  return `/**
 * Adapter factory for ${name}.
 * TODO: implement port interface methods.
 */

${importLine}
import type { AdapterContext, AdapterFactory } from '../../../types.ts';

export const createAdapter: AdapterFactory = (ctx: AdapterContext) => {
  // TODO: create transport from ctx.manifest config
  // TODO: return port implementation
  throw new Error('${name} adapter not yet implemented');
};
`;
}

export default defineCommand({
  meta: { name: 'toolbox-create', description: 'Scaffold a new tool with manifest and adapter' },
  args: {
    name: {
      type: 'string',
      description: 'Tool name (kebab-case)',
      required: true,
    },
    transport: {
      type: 'string',
      description: 'Transport type: cli, http, mcp-stdio, mcp-http',
      required: true,
    },
    provides: {
      type: 'string',
      description: 'Port name this tool provides (e.g. tasks, graph, search)',
    },
  },
  async run({ args }) {
    try {
      const transport = args.transport as TransportType;
      if (!VALID_TRANSPORTS.includes(transport)) {
        throw new MaestroError(
          `Invalid transport: ${args.transport}`,
          [`Valid transports: ${VALID_TRANSPORTS.join(', ')}`],
        );
      }

      if (!/^[a-z][a-z0-9-]*$/.test(args.name)) {
        throw new MaestroError('Tool name must be kebab-case (lowercase letters, numbers, hyphens)');
      }

      const toolDir = path.join(import.meta.dir, '../../../toolbox/tools/external', args.name);
      if (fs.existsSync(toolDir)) {
        throw new MaestroError(`Tool '${args.name}' already exists at ${toolDir}`);
      }

      fs.mkdirSync(toolDir, { recursive: true });
      fs.writeFileSync(path.join(toolDir, 'manifest.json'), generateManifest(args.name, transport, args.provides));
      fs.writeFileSync(path.join(toolDir, 'adapter.ts'), generateAdapter(args.name, transport));

      output(
        { name: args.name, transport, path: toolDir },
        () => `[ok] Created tool '${args.name}' at ${toolDir}\n  manifest.json + adapter.ts scaffolded`,
      );
    } catch (err) {
      handleCommandError('toolbox-create', err);
    }
  },
});
