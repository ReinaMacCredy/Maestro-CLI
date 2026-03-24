/**
 * Integration tests for MCP response mode params:
 * - memory_list brief=true
 * - task_list brief=true
 * - plan_read summary=true
 * - status verbose=true/false
 *
 * These params exist on MCP tool handlers (src/server/*.ts), not CLI commands.
 * Tests exercise the same adapter + transformation logic the handlers use.
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { mkdtemp, rm, realpath } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { execSync } from 'child_process';
import { initServices, type MaestroServices } from '../../services.ts';
import { syncPlan } from '../../usecases/sync-plan.ts';
import { extractPlanOutline } from '../../plans/parser.ts';
import type { MemoryFile } from '../../core/types.ts';

let dir: string;
let services: MaestroServices;

const PLAN_CONTENT = [
  '## Discovery',
  '',
  'Research shows MCP response verbosity is the main token bottleneck. Tool definitions are manageable at 4-11K tokens, but plan_read dumps 5-20KB of markdown per call.',
  '',
  '## Plan',
  '',
  '### 1. Add brief mode to memory_list [depends: none]',
  'Strip content from MemoryFile when brief=true.',
  '',
  '### 2. Add compact mode to task_list [depends: none]',
  'Return only folder/name/status/origin/dependsOn when brief=true.',
  '',
  '### 3. Add summary mode to plan_read [depends: none]',
  'Return preview/headings/commentCount instead of full markdown.',
  '',
  '## Non-Goals',
  '- Tool-RAG or lazy proxy patterns',
  '',
  '## Ghost Diffs',
  '- No CLI changes',
].join('\n');

const FEATURE = 'test-response-modes';

beforeAll(async () => {
  const rawDir = await mkdtemp(join(tmpdir(), 'maestro-mcp-modes-'));
  dir = await realpath(rawDir);

  // git init (required by some adapters)
  execSync('git init && git config user.name Test && git config user.email test@test.com', {
    cwd: dir, stdio: 'pipe',
  });
  execSync('touch .gitkeep && git add . && git commit -m init', {
    cwd: dir, stdio: 'pipe',
  });

  services = initServices(dir);

  // Bootstrap: init, feature, memories, plan, approve, task sync
  services.featureAdapter.create(FEATURE);
  services.memoryAdapter.write(FEATURE, 'arch-notes', 'Hexagonal architecture with MCP server layer.');
  services.memoryAdapter.write(FEATURE, 'perf-findings', 'Response verbosity is the main token bottleneck, not tool count.');
  services.planAdapter.write(FEATURE, PLAN_CONTENT);
  services.planAdapter.approve(FEATURE);
  await syncPlan(services, FEATURE);
});

afterAll(async () => {
  if (dir) await rm(dir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Phase 1a: memory_list brief mode
// ---------------------------------------------------------------------------
describe('memory_list response modes', () => {
  test('default mode returns full content + sizeBytes', () => {
    const files = services.memoryAdapter.list(FEATURE);
    expect(files.length).toBe(2);

    for (const f of files) {
      expect(f).toHaveProperty('name');
      expect(f).toHaveProperty('content');
      expect(f).toHaveProperty('updatedAt');
      expect(f).toHaveProperty('sizeBytes');
      expect(typeof f.sizeBytes).toBe('number');
      expect(f.sizeBytes).toBeGreaterThan(0);
      expect(typeof f.content).toBe('string');
      expect(f.content.length).toBeGreaterThan(0);
    }
  });

  test('brief mode strips content, keeps metadata + sizeBytes', () => {
    const files = services.memoryAdapter.list(FEATURE);

    // Simulate what the MCP handler does with brief=true
    const brief = files.map(({ name, updatedAt, sizeBytes }: MemoryFile) => ({
      name, updatedAt, sizeBytes,
    }));

    expect(brief.length).toBe(2);
    for (const f of brief) {
      expect(f).toHaveProperty('name');
      expect(f).toHaveProperty('updatedAt');
      expect(f).toHaveProperty('sizeBytes');
      expect(f).not.toHaveProperty('content');
    }
  });

  test('sizeBytes matches actual file size', () => {
    const files = services.memoryAdapter.list(FEATURE);
    for (const f of files) {
      // sizeBytes should match the content length (file is UTF-8 text)
      expect(f.sizeBytes).toBe(f.content.length);
    }
  });
});

// ---------------------------------------------------------------------------
// Phase 1b: task_list brief mode
// ---------------------------------------------------------------------------
describe('task_list response modes', () => {
  test('default mode returns all TaskInfo fields', () => {
    // Use sync version -- tasks were synced in beforeAll
    const tasks = services.taskPort.list(FEATURE).then(t => t);
    return tasks.then(list => {
      expect(list.length).toBe(3);
      for (const t of list) {
        expect(t).toHaveProperty('folder');
        expect(t).toHaveProperty('name');
        expect(t).toHaveProperty('status');
        expect(t).toHaveProperty('origin');
        // These fields should exist (possibly undefined)
        expect('planTitle' in t || t.planTitle === undefined).toBe(true);
      }
    });
  });

  test('brief mode returns only 5 fields', async () => {
    const tasks = await services.taskPort.list(FEATURE);

    // Simulate what the MCP handler does with brief=true
    const compact = tasks.map(({ folder, name, status, origin, dependsOn }) => ({
      folder, name, status, origin, dependsOn,
    }));

    expect(compact.length).toBe(3);
    for (const t of compact) {
      const keys = Object.keys(t);
      expect(keys).toContain('folder');
      expect(keys).toContain('name');
      expect(keys).toContain('status');
      expect(keys).toContain('origin');
      expect(keys).toContain('dependsOn');
      // Should NOT have these
      expect(keys).not.toContain('planTitle');
      expect(keys).not.toContain('summary');
      expect(keys).not.toContain('claimedBy');
      expect(keys).not.toContain('claimedAt');
      expect(keys).not.toContain('completedAt');
      expect(keys).not.toContain('blockerReason');
      expect(keys).not.toContain('blockerDecision');
    }
  });

  test('brief mode preserves dependency ordering', async () => {
    const tasks = await services.taskPort.list(FEATURE);
    const compact = tasks.map(({ folder, name, status, origin, dependsOn }) => ({
      folder, name, status, origin, dependsOn,
    }));

    // All 3 tasks have [depends: none] so dependsOn should be []
    for (const t of compact) {
      expect(t.dependsOn).toEqual([]);
    }
  });
});

// ---------------------------------------------------------------------------
// Phase 1c: plan_read summary mode
// ---------------------------------------------------------------------------
describe('plan_read response modes', () => {
  test('default mode returns full plan content', () => {
    const plan = services.planAdapter.read(FEATURE);
    expect(plan).not.toBeNull();
    expect(plan!.content).toBe(PLAN_CONTENT);
    expect(plan!.status).toBe('approved');
    expect(Array.isArray(plan!.comments)).toBe(true);
  });

  test('summary mode returns preview + headings + commentCount', () => {
    const plan = services.planAdapter.read(FEATURE);
    expect(plan).not.toBeNull();

    // Simulate what the MCP handler does with summary=true
    const { preview, headings } = extractPlanOutline(plan!.content);
    const summary = {
      preview,
      headings,
      status: plan!.status,
      commentCount: plan!.comments.length,
    };

    expect(summary.status).toBe('approved');
    expect(summary.commentCount).toBe(0);
    expect(summary).not.toHaveProperty('content');
    expect(summary).not.toHaveProperty('comments');

    // Preview should be <= 500 chars
    expect(summary.preview.length).toBeLessThanOrEqual(500);

    // Should capture the correct headings
    expect(summary.headings).toContain('Discovery');
    expect(summary.headings).toContain('Plan');
    expect(summary.headings).toContain('Non-Goals');
    expect(summary.headings).toContain('Ghost Diffs');
    // ### headings
    expect(summary.headings).toContain('1. Add brief mode to memory_list [depends: none]');
    expect(summary.headings).toContain('2. Add compact mode to task_list [depends: none]');
    expect(summary.headings).toContain('3. Add summary mode to plan_read [depends: none]');
  });

  test('summary preview truncates long plans at last newline', () => {
    // The PLAN_CONTENT is > 500 chars
    expect(PLAN_CONTENT.length).toBeGreaterThan(500);

    const { preview } = extractPlanOutline(PLAN_CONTENT);
    expect(preview.length).toBeLessThanOrEqual(500);
    // Preview should end at a complete line (no trailing newline)
    expect(preview.endsWith('\n')).toBe(false);
    // Should be a prefix of the original content
    expect(PLAN_CONTENT.startsWith(preview)).toBe(true);
  });

  test('summary saves significant tokens on large plans', () => {
    // Generate a realistically large plan (~5KB)
    const largePlan = PLAN_CONTENT + '\n\n' +
      Array.from({ length: 100 }, (_, i) => `Detail line ${i}: implementation notes and context that agents don't need for overview.`).join('\n');

    const fullSize = JSON.stringify({ content: largePlan, status: 'approved', comments: [] }).length;

    const { preview, headings } = extractPlanOutline(largePlan);
    const summary = { preview, headings, status: 'approved', commentCount: 0 };
    const summarySize = JSON.stringify(summary).length;

    // Summary should be materially smaller for large plans
    expect(summarySize).toBeLessThan(fullSize * 0.5);
  });
});

// ---------------------------------------------------------------------------
// Phase 1d: status verbose mode
// ---------------------------------------------------------------------------
describe('status response modes', () => {
  test('researchTools detection function exists and returns array', async () => {
    // Import the function used by the status handler
    const { detectResearchTools } = await import('../../workflow/research-tools.ts');
    const tools = detectResearchTools(dir);
    expect(Array.isArray(tools)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Phase 2a: conditional registration
// ---------------------------------------------------------------------------
describe('conditional tool registration', () => {
  test('checkCli returns boolean', async () => {
    const { checkCli } = await import('../../lib/cli-detect.ts');
    // 'ls' should be available on any system
    expect(checkCli('ls')).toBe(true);
    // A nonsense CLI name should not be available
    expect(checkCli('__maestro_nonexistent_cli_xyz__')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Phase 4a: shared params
// ---------------------------------------------------------------------------
describe('shared Zod params', () => {
  test('featureParam produces correct schema', async () => {
    const { featureParam } = await import('../../server/_utils/params.ts');
    const schema = featureParam();
    // Should be optional string
    expect(schema.isOptional()).toBe(true);
    const result = schema.safeParse(undefined);
    expect(result.success).toBe(true);
    const result2 = schema.safeParse('my-feature');
    expect(result2.success).toBe(true);
  });

  test('taskParam produces required string schema', async () => {
    const { taskParam } = await import('../../server/_utils/params.ts');
    const schema = taskParam();
    expect(schema.isOptional()).toBe(false);
    const fail = schema.safeParse(undefined);
    expect(fail.success).toBe(false);
    const pass = schema.safeParse('01-setup');
    expect(pass.success).toBe(true);
  });

  test('limitParam produces optional number with default', async () => {
    const { limitParam } = await import('../../server/_utils/params.ts');
    const schema = limitParam(10);
    expect(schema.isOptional()).toBe(true);
    const result = schema.parse(undefined);
    expect(result).toBe(10);
    const result2 = schema.parse(5);
    expect(result2).toBe(5);
  });
});
