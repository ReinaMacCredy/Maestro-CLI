/**
 * maestro config-agent -- get agent-specific config.
 */

import { defineCommand } from 'citty';
import { getServices } from '../../services.ts';
import { output } from '../../core/output.ts';
import { MaestroError, handleCommandError } from '../../core/errors.ts';
import { AGENT_NAMES } from '../../types.ts';
import type { AgentName } from '../../types.ts';

export default defineCommand({
  meta: { name: 'config-agent', description: 'Get agent-specific config' },
  args: {
    agent: {
      type: 'string',
      description: 'Agent name (hive-master, architect-planner, swarm-orchestrator, scout-researcher, forager-worker, hygienic-reviewer)',
      required: true,
    },
  },
  async run({ args }) {
    try {
      if (!AGENT_NAMES.includes(args.agent as AgentName)) {
        throw new MaestroError(`unknown agent '${args.agent}'`, [`Valid agents: ${AGENT_NAMES.join(', ')}`]);
      }

      const { configAdapter } = getServices();
      const agentConfig = configAdapter.getAgentConfig(args.agent as AgentName);
      output(agentConfig, (c) => JSON.stringify(c, null, 2));
    } catch (err) {
      handleCommandError('config-agent', err);
    }
  },
});
