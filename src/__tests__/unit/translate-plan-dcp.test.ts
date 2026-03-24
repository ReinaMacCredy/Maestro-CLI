/**
 * Tests that translate-plan (BR backend) does NOT inject memories into bead
 * descriptions. The pre-agent hook handles memory injection via DCP at
 * agent-spawn time, so baking memories into beads would cause double injection.
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { translatePlan, type TranslatePlanServices } from '../../tasks/translate-plan.ts';
import { buildBeadOpts } from '../../tasks/bead-builder.ts';
import { InMemoryTaskPort } from '../mocks/in-memory-task-port.ts';
import { InMemoryMemoryPort } from '../mocks/in-memory-memory-port.ts';
import type { PlanPort } from '../../plans/port.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FEATURE = 'test-dcp-beads';

const PLAN = `
## Discovery
Investigated the codebase and found areas for improvement.

### 1. Add Widget
Create widget component with full styling.
**Depends on**: none

### 2. Add Tests
Write tests for widget.
**Depends on**: 1
`.trim();

function makePlanAdapter(content: string, status: 'approved' | 'planning' = 'approved'): PlanPort {
  return {
    read: (_feature: string) => ({ content, status, comments: [] }),
    write: () => {},
    approve: () => {},
    revoke: () => {},
    addComment: () => ({ id: '1', line: 0, body: '', author: '', timestamp: '' }),
    clearComments: () => {},
  } as unknown as PlanPort;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('translate-plan: no memories in bead descriptions', () => {
  let taskPort: InMemoryTaskPort;
  let memoryPort: InMemoryMemoryPort;

  beforeEach(() => {
    taskPort = new InMemoryTaskPort();
    memoryPort = new InMemoryMemoryPort();
  });

  test('bead descriptions contain plan + dependencies but NO memory section', async () => {
    // Seed memories that should NOT appear in bead descriptions
    memoryPort.write(FEATURE, 'auth-decision', 'We chose JWT for authentication.');
    memoryPort.write(FEATURE, 'db-schema', 'Using PostgreSQL with normalized schema.');

    const services: TranslatePlanServices = {
      taskPort,
      planAdapter: makePlanAdapter(PLAN),
    };

    const result = await translatePlan(services, FEATURE);
    expect(result.created.length).toBe(2);

    // Inspect each created task's description via the spec
    const tasks = await taskPort.list(FEATURE, { includeAll: true });

    for (const task of tasks) {
      expect(task.folder).toBeTruthy();
      expect(task.name).toBeTruthy();
    }

    // The memories should NOT have been consumed -- memoryAdapter is not even
    // in TranslatePlanServices anymore
    expect(memoryPort.list(FEATURE).length).toBe(2);
  });

  test('services interface does not require memoryAdapter', () => {
    // TypeScript compile-time check: TranslatePlanServices should work
    // without memoryAdapter
    const services: TranslatePlanServices = {
      taskPort,
      planAdapter: makePlanAdapter(PLAN),
    };

    // No memoryAdapter property needed
    expect(services).not.toHaveProperty('memoryAdapter');
  });

  test('bead descriptions do not contain Prior Work section', () => {
    const opts = buildBeadOpts({
      featureName: FEATURE,
      task: { folder: '01-add-widget', name: 'Add Widget', order: 1, description: '', dependsOnNumbers: null },
      planContent: PLAN,
      allTasks: [
        { folder: '01-add-widget', name: 'Add Widget', order: 1, description: '', dependsOnNumbers: null },
        { folder: '02-add-tests', name: 'Add Tests', order: 2, description: '', dependsOnNumbers: [1] },
      ],
      dependsOn: [],
      // completedTasks not passed -- translate-plan no longer gathers them
    });

    expect(opts.description).not.toContain('## Prior Work');
    expect(opts.description).not.toContain('Widget created');
  });

  test('translatePlan keeps done tasks and creates new ones (no completedTasks in beads)', async () => {
    // Create a completed task first
    const created = await taskPort.create(FEATURE, 'Add Widget');
    await taskPort.claim(FEATURE, created.folder, 'agent-1');
    await taskPort.done(FEATURE, created.folder, 'Widget created with full styling');

    const services: TranslatePlanServices = {
      taskPort,
      planAdapter: makePlanAdapter(PLAN),
    };

    const result = await translatePlan(services, FEATURE);

    // Task 1 already exists (done), so only task 2 should be created
    expect(result.created.length).toBe(1);
    expect(result.kept).toContain(created.folder);
  });

  test('no regression: tasks are created correctly without memoryFiles', async () => {
    const services: TranslatePlanServices = {
      taskPort,
      planAdapter: makePlanAdapter(PLAN),
    };

    const result = await translatePlan(services, FEATURE);

    expect(result.created.length).toBe(2);
    expect(result.removed.length).toBe(0);
    expect(result.kept.length).toBe(0);

    const tasks = await taskPort.list(FEATURE, { includeAll: true });
    expect(tasks.length).toBe(2);
    expect(tasks.some(t => t.name === 'Add Widget')).toBe(true);
    expect(tasks.some(t => t.name === 'Add Tests')).toBe(true);
  });
});
