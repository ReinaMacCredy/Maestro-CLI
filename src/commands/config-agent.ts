/**
 * maestro config-agent -- get agent-specific config.
 */

import { defineCommand } from 'citty';
import { getServices } from '../services.ts';
import { output } from '../lib/output.ts';
import { formatError, handleCommandError } from '../lib/errors.ts';

type AgentName = 'hive-master' | 'architect-planner' | 'swarm-orchestrator' | 'scout-researcher' | 'forager-worker' | 'hygienic-reviewer';

const VALID_AGENTS: AgentName[] = [
  'hive-master', 'architect-planner', 'swarm-orchestrator',
  'scout-researcher', 'forager-worker', 'hygienic-reviewer',
];

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
      if (!VALID_AGENTS.includes(args.agent as AgentName)) {
        console.error(formatError('config-agent', `unknown agent '${args.agent}'. Valid: ${VALID_AGENTS.join(', ')}`));
        process.exit(1);
      }

      const { configAdapter } = getServices();
      const agentConfig = configAdapter.getAgentConfig(args.agent as AgentName);
      output(agentConfig, (c) => JSON.stringify(c, null, 2));
    } catch (err) {
      handleCommandError('config-agent', err);
    }
  },
});
