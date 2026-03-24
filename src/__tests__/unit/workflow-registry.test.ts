import { describe, it, expect } from 'bun:test';

import { WorkflowRegistry } from '../../workflow/registry.ts';

describe('WorkflowRegistry', () => {
  it('registers and retrieves tools', () => {
    const reg = new WorkflowRegistry();
    reg.register('maestro_plan_write', { stages: ['planning'], category: 'primary' });
    reg.register('maestro_task_claim', { stages: ['execution'], category: 'primary' });

    expect(reg.size).toBe(2);
    expect(reg.getCategory('maestro_plan_write')).toBe('primary');
  });

  it('getToolsForStage returns only tools matching stage', () => {
    const reg = new WorkflowRegistry();
    reg.register('maestro_plan_write', { stages: ['planning'], category: 'primary' });
    reg.register('maestro_task_claim', { stages: ['execution'], category: 'primary' });
    reg.register('maestro_memory_write', { stages: ['discovery', 'research'], category: 'primary' });

    expect(reg.getToolsForStage('planning')).toEqual(['maestro_plan_write']);
    expect(reg.getToolsForStage('execution')).toEqual(['maestro_task_claim']);
    expect(reg.getToolsForStage('discovery')).toEqual(['maestro_memory_write']);
    expect(reg.getToolsForStage('nonexistent')).toEqual([]);
  });

  it('excludes meta and utility from stage tools', () => {
    const reg = new WorkflowRegistry();
    reg.register('maestro_status', { stages: ['discovery', 'execution'], category: 'meta' });
    reg.register('maestro_feature_create', { stages: ['discovery'], category: 'primary' });

    const tools = reg.getToolsForStage('discovery');
    expect(tools).toContain('maestro_feature_create');
    expect(tools).not.toContain('maestro_status');
  });

  it('filters conditional tools by toolbox availability', () => {
    const reg = new WorkflowRegistry();
    reg.register('maestro_graph_insights', { stages: ['execution'], category: 'conditional', requires: 'bv' });
    reg.register('maestro_task_claim', { stages: ['execution'], category: 'primary' });

    // Without toolbox -- conditional excluded
    expect(reg.getToolsForStage('execution')).toEqual(['maestro_task_claim']);

    // With toolbox where bv is available
    const mockToolbox = { isAvailable: (name: string) => name === 'bv' } as any;
    const tools = reg.getToolsForStage('execution', mockToolbox);
    expect(tools).toContain('maestro_graph_insights');
    expect(tools).toContain('maestro_task_claim');
  });

  it('filters conditional tools when toolbox says unavailable', () => {
    const reg = new WorkflowRegistry();
    reg.register('maestro_search_sessions', { stages: ['research'], category: 'conditional', requires: 'cass' });

    const mockToolbox = { isAvailable: () => false } as any;
    expect(reg.getToolsForStage('research', mockToolbox)).toEqual([]);
  });

  it('getAll returns all registered tools', () => {
    const reg = new WorkflowRegistry();
    reg.register('a', { stages: ['discovery'], category: 'primary' });
    reg.register('b', { stages: ['execution'], category: 'meta' });

    const all = reg.getAll();
    expect(all.length).toBe(2);
    expect(all.map(t => t.name).sort()).toEqual(['a', 'b']);
  });

  it('getMeta returns null for unknown tool', () => {
    const reg = new WorkflowRegistry();
    expect(reg.getMeta('nonexistent')).toBeNull();
  });
});
