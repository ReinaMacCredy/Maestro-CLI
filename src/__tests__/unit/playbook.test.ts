import { describe, test, expect } from 'bun:test';
import { buildPlaybook, buildTransitionHint } from '../../workflow/playbook.ts';
import { WorkflowRegistry } from '../../workflow/registry.ts';
import { declareAllTools } from '../../workflow/tool-declarations.ts';
import { BUILTIN_SKILL_NAMES } from '../../skills/registry';
import type { PipelineStage } from '../../workflow/stages.ts';

const ALL_STAGES: PipelineStage[] = ['discovery', 'research', 'planning', 'approval', 'execution', 'done'];

function makeRegistry(): WorkflowRegistry {
  const reg = new WorkflowRegistry();
  declareAllTools(reg);
  return reg;
}

describe('buildPlaybook', () => {
  test('returns valid shape for all 6 stages with registry', () => {
    const registry = makeRegistry();
    for (const stage of ALL_STAGES) {
      const pb = buildPlaybook(stage, registry);
      expect(pb.stage).toBe(stage);
      expect(pb.objective.length).toBeGreaterThan(0);
      expect(pb.tools.length).toBeGreaterThan(0);
      expect(pb.nextMilestone.length).toBeGreaterThan(0);
      expect(pb.antiPatterns.length).toBeGreaterThan(0);
    }
  });

  test('returns consistent output for same inputs', () => {
    const registry = makeRegistry();
    for (const stage of ALL_STAGES) {
      const a = buildPlaybook(stage, registry);
      const b = buildPlaybook(stage, registry);
      expect(a).toEqual(b);
    }
  });

  test('all skill names exist in BUILTIN_SKILL_NAMES', () => {
    const builtinSet = new Set(BUILTIN_SKILL_NAMES);
    for (const stage of ALL_STAGES) {
      const pb = buildPlaybook(stage);
      for (const skill of pb.skills) {
        expect(builtinSet.has(skill)).toBe(true);
      }
    }
  });

  test('done stage has no skills', () => {
    expect(buildPlaybook('done').skills).toEqual([]);
  });
});

describe('buildTransitionHint', () => {
  test('returns hint for plan_approve', () => {
    const hint = buildTransitionHint('plan_approve');
    expect(hint).toBeDefined();
    expect(hint!.nextStep).toContain('tasks_sync');
    expect(hint!.loadSkill).toBe('maestro:implement');
  });

  test('returns hint for tasks_sync when created > 0', () => {
    const hint = buildTransitionHint('tasks_sync', { created: 3 });
    expect(hint).toBeDefined();
    expect(hint!.nextStep).toContain('task_next');
  });

  test('returns undefined for tasks_sync when created === 0', () => {
    expect(buildTransitionHint('tasks_sync', { created: 0 })).toBeUndefined();
  });

  test('returns hint for task_done when all tasks complete', () => {
    const hint = buildTransitionHint('task_done', { taskDone: 5, taskTotal: 5 });
    expect(hint).toBeDefined();
    expect(hint!.nextStep).toContain('feature_complete');
  });

  test('returns undefined for task_done when tasks remain', () => {
    expect(buildTransitionHint('task_done', { taskDone: 3, taskTotal: 5 })).toBeUndefined();
  });

  test('returns hint for task_accept when all tasks complete', () => {
    const hint = buildTransitionHint('task_accept', { taskDone: 4, taskTotal: 4 });
    expect(hint).toBeDefined();
    expect(hint!.nextStep).toContain('feature_complete');
  });

  test('returns undefined for task_accept when tasks remain', () => {
    expect(buildTransitionHint('task_accept', { taskDone: 2, taskTotal: 4 })).toBeUndefined();
  });

  test('returns hint for feature_complete', () => {
    const hint = buildTransitionHint('feature_complete');
    expect(hint).toBeDefined();
    expect(hint!.nextStep).toContain('doctrine');
  });

  test('returns undefined for non-transition tools', () => {
    expect(buildTransitionHint('task_claim')).toBeUndefined();
    expect(buildTransitionHint('memory_write')).toBeUndefined();
    expect(buildTransitionHint('status')).toBeUndefined();
    expect(buildTransitionHint('plan_write')).toBeUndefined();
  });
});
