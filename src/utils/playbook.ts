/**
 * Playbook engine -- stage-specific workflow guidance for agents.
 *
 * buildPlaybook() returns the tools, skills, and objectives for a pipeline stage.
 * buildTransitionHint() returns breadcrumb hints for stage-transition tools.
 *
 * IMPORTANT: This file MUST NOT import from registry.generated.ts (380KB+).
 * The session hook imports this at startup -- pulling in the registry would bloat it.
 * Skill names are hardcoded strings; validation is test-only.
 */

import type { PipelineStage } from './workflow.ts';
import { discoverExternalSkillsByStage } from '../skills/external-discovery.ts';

export interface Playbook {
  stage: PipelineStage;
  objective: string;
  tools: string[];
  skills: string[];
  nextMilestone: string;
  antiPatterns: string[];
}

export interface TransitionHint {
  nextStep: string;
  loadSkill?: string;
}

const PLAYBOOKS = {
  discovery: {
    stage: 'discovery',
    objective: 'Explore scope, brainstorm, capture findings',
    tools: ['memory_write', 'skill'],
    skills: ['maestro:brainstorming', 'maestro:design', 'maestro:parallel-exploration'],
    nextMilestone: 'Write plan with plan_write',
    antiPatterns: [
      "Don't write the plan yet -- explore first",
      "Don't skip memory_write -- findings are lost without it",
    ],
  },
  research: {
    stage: 'research',
    objective: 'Deep-dive codebase, save structured findings',
    tools: ['memory_write', 'memory_read', 'memory_list', 'skill'],
    skills: ['maestro:brainstorming', 'maestro:design', 'maestro:parallel-exploration'],
    nextMilestone: 'Write plan with plan_write',
    antiPatterns: [
      "Don't research without saving findings as memory",
      "Don't start planning before research is sufficient",
    ],
  },
  planning: {
    stage: 'planning',
    objective: 'Write plan with discovery section, non-goals, ghost diffs',
    tools: ['plan_write', 'plan_read', 'plan_comment', 'memory_read'],
    skills: ['maestro:design'],
    nextMilestone: 'Approve plan with plan_approve',
    antiPatterns: [
      "Don't skip ## Discovery section in plan",
      "Don't approve your own plan without review",
    ],
  },
  approval: {
    stage: 'approval',
    objective: 'Generate tasks from the approved plan',
    tools: ['tasks_sync'],
    skills: ['maestro:implement'],
    nextMilestone: 'Call tasks_sync to generate tasks',
    antiPatterns: [
      "Don't skip tasks_sync -- jumping to implementation without tasks loses tracking",
    ],
  },
  execution: {
    stage: 'execution',
    objective: 'Claim tasks, implement via TDD, verify',
    tools: [
      'task_next', 'task_claim', 'task_done',
      'task_block', 'task_unblock', 'task_accept', 'task_reject', 'task_list',
    ],
    skills: ['maestro:implement', 'maestro:dispatching', 'maestro:tdd'],
    nextMilestone: 'All tasks done',
    antiPatterns: [
      "Don't skip task_claim before working",
      "Don't mark done without verification",
    ],
  },
  done: {
    stage: 'done',
    objective: 'Complete feature, promote memories, review doctrine',
    tools: ['feature_complete', 'memory_promote', 'doctrine_list'],
    skills: [],
    nextMilestone: 'Call feature_complete',
    antiPatterns: [
      "Don't forget to promote useful memories to global",
    ],
  },
} satisfies Record<PipelineStage, Playbook>;

export function buildPlaybook(stage: PipelineStage): Playbook {
  return PLAYBOOKS[stage];
}

/**
 * Build playbook with external skills merged in.
 * Discovers skills from external directories tagged for this stage
 * and appends them to the built-in skill list.
 */
export function buildPlaybookWithExternalSkills(stage: PipelineStage, projectRoot: string): Playbook {
  const base = buildPlaybook(stage);
  const external = discoverExternalSkillsByStage(projectRoot, stage);
  if (external.length === 0) return base;
  const extraNames = external.map(s => s.name).filter(n => !base.skills.includes(n));
  if (extraNames.length === 0) return base;
  return { ...base, skills: [...base.skills, ...extraNames] };
}

const allTasksCompleteHint = (ctx?: TransitionContext): TransitionHint | undefined => {
  if (ctx?.taskDone === undefined || ctx?.taskTotal === undefined) return undefined;
  if (ctx.taskDone < ctx.taskTotal) return undefined;
  return { nextStep: 'All tasks complete. Call feature_complete' };
};

const TRANSITION_HINTS: Record<string, (ctx?: TransitionContext) => TransitionHint | undefined> = {
  plan_approve: () => ({
    nextStep: 'Call tasks_sync to generate tasks, then task_next',
    loadSkill: 'maestro:implement',
  }),
  tasks_sync: (ctx) => {
    if (!ctx?.created || ctx.created <= 0) return undefined;
    return { nextStep: 'Call task_next to find runnable work, then task_claim' };
  },
  task_done: allTasksCompleteHint,
  task_accept: allTasksCompleteHint,
  feature_complete: () => ({
    nextStep: 'Feature done. Review doctrine suggestions if any',
  }),
};

interface TransitionContext {
  taskDone?: number;
  taskTotal?: number;
  created?: number;
}

export function buildTransitionHint(
  tool: string,
  context?: TransitionContext,
): TransitionHint | undefined {
  const factory = TRANSITION_HINTS[tool];
  if (!factory) return undefined;
  return factory(context);
}
