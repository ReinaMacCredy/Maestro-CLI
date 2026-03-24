/**
 * Unit tests for src/tasks/sync-plan.ts
 *
 * Validates task creation, idempotency, orphan removal, status preservation,
 * manual-origin preservation, dependency pass-through, and error conditions.
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { syncPlan } from "../../tasks/sync-plan.ts";
import { FsPlanAdapter } from "../../plans/adapter.ts";
import { InMemoryTaskPort } from "../mocks/in-memory-task-port.ts";
import type { TaskStatusType, TaskOrigin } from '../../core/types.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FEATURE = "test-feature";

const PLAN_3_TASKS = `
## Discovery
We investigated the codebase and found significant areas for improvement in the database layer, API surface, and test coverage.

### 1. Setup Database
Create the database schema and migrations.
**Depends on**: none

### 2. Build API
Implement REST endpoints for the new schema.
**Depends on**: 1

### 3. Add Tests
Write comprehensive test coverage for API and DB layers.
**Depends on**: 2
`.trim();

const PLAN_2_TASKS = `
## Discovery
We investigated the codebase and found significant areas for improvement in the database layer and API surface.

### 1. Setup Database
Create the database schema and migrations.
**Depends on**: none

### 2. Build API
Implement REST endpoints for the new schema.
**Depends on**: 1
`.trim();

/** Set up the minimal .maestro directory structure for FsPlanAdapter. */
function setupFeatureDir(tmpDir: string, planContent: string, approved: boolean): void {
  const featureDir = path.join(tmpDir, ".maestro", "features", FEATURE);
  fs.mkdirSync(featureDir, { recursive: true });

  fs.writeFileSync(path.join(featureDir, "plan.md"), planContent);
  fs.writeFileSync(
    path.join(featureDir, "comments.json"),
    JSON.stringify({ threads: [] }),
  );
  fs.writeFileSync(
    path.join(featureDir, "feature.json"),
    JSON.stringify({
      name: FEATURE,
      status: approved ? "approved" : "planning",
      createdAt: "2024-01-01T00:00:00.000Z",
      ...(approved ? { approvedAt: "2024-01-01T00:00:00.000Z" } : {}),
    }),
  );

  if (approved) {
    fs.writeFileSync(
      path.join(featureDir, "APPROVED"),
      "Approved at 2024-01-01T00:00:00.000Z\n",
    );
  }
}

/**
 * Seed a task directly into InMemoryTaskPort with exact folder name.
 * This bypasses create() which generates its own folder from an auto-increment ID.
 */
function seedTask(
  taskPort: InMemoryTaskPort,
  folder: string,
  overrides: { status?: TaskStatusType; origin?: TaskOrigin; dependsOn?: string[] } = {},
): void {
  taskPort.seed(FEATURE, folder, {
    status: overrides.status,
    origin: overrides.origin,
    dependsOn: overrides.dependsOn,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("syncPlan", () => {
  let tmpDir: string;
  let planAdapter: FsPlanAdapter;
  let taskPort: InMemoryTaskPort;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "maestro-test-"));
    taskPort = new InMemoryTaskPort();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // -----------------------------------------------------------------------
  // Happy path
  // -----------------------------------------------------------------------

  test("creates tasks from approved plan", async () => {
    setupFeatureDir(tmpDir, PLAN_3_TASKS, true);
    planAdapter = new FsPlanAdapter(tmpDir);

    const result = await syncPlan({ taskPort, planAdapter }, FEATURE);

    expect(result.created).toHaveLength(3);
    expect(result.created).toContain("01-setup-database");
    expect(result.created).toContain("02-build-api");
    expect(result.created).toContain("03-add-tests");
    expect(result.removed).toHaveLength(0);
    expect(result.kept).toHaveLength(0);
    expect(result.manual).toHaveLength(0);
  });

  test("is idempotent -- second sync creates no new tasks", async () => {
    setupFeatureDir(tmpDir, PLAN_3_TASKS, true);
    planAdapter = new FsPlanAdapter(tmpDir);

    const first = await syncPlan({ taskPort, planAdapter }, FEATURE);
    expect(first.created).toHaveLength(3);

    const second = await syncPlan({ taskPort, planAdapter }, FEATURE);
    expect(second.created).toHaveLength(0);
    expect(second.kept).toHaveLength(3);

    // Total tasks unchanged
    const allTasks = await taskPort.list(FEATURE, { includeAll: true });
    expect(allTasks).toHaveLength(3);
  });

  // -----------------------------------------------------------------------
  // Removal / preservation
  // -----------------------------------------------------------------------

  test("removes tasks removed from plan", async () => {
    setupFeatureDir(tmpDir, PLAN_3_TASKS, true);
    planAdapter = new FsPlanAdapter(tmpDir);

    // First sync creates 3 tasks
    await syncPlan({ taskPort, planAdapter }, FEATURE);

    // Rewrite plan with only 2 tasks (task 3 dropped)
    const featureDir = path.join(tmpDir, ".maestro", "features", FEATURE);
    fs.writeFileSync(path.join(featureDir, "plan.md"), PLAN_2_TASKS);

    const result = await syncPlan({ taskPort, planAdapter }, FEATURE);

    expect(result.removed).toContain("03-add-tests");
    expect(result.kept).toContain("01-setup-database");
    expect(result.kept).toContain("02-build-api");

    // Verify the removed task is deleted from the store
    const task = await taskPort.get(FEATURE, "03-add-tests");
    expect(task).toBeNull();
  });

  test("preserves done tasks even if removed from plan", async () => {
    setupFeatureDir(tmpDir, PLAN_3_TASKS, true);
    planAdapter = new FsPlanAdapter(tmpDir);

    // Seed task 3 as done
    seedTask(taskPort, "03-add-tests", { status: "done" });

    // Sync with plan that only has 2 tasks (task 3 not in plan)
    const featureDir = path.join(tmpDir, ".maestro", "features", FEATURE);
    fs.writeFileSync(path.join(featureDir, "plan.md"), PLAN_2_TASKS);

    const result = await syncPlan({ taskPort, planAdapter }, FEATURE);

    // Task 3 is kept because it's done, even though it's not in the plan
    expect(result.kept).toContain("03-add-tests");
    expect(result.removed).not.toContain("03-add-tests");

    const task = await taskPort.get(FEATURE, "03-add-tests");
    expect(task?.status).toBe("done");
  });

  test("preserves claimed tasks even if removed from plan", async () => {
    setupFeatureDir(tmpDir, PLAN_3_TASKS, true);
    planAdapter = new FsPlanAdapter(tmpDir);

    // Seed task 3 as claimed
    seedTask(taskPort, "03-add-tests", { status: "claimed" });

    // Sync with plan that only has 2 tasks
    const featureDir = path.join(tmpDir, ".maestro", "features", FEATURE);
    fs.writeFileSync(path.join(featureDir, "plan.md"), PLAN_2_TASKS);

    const result = await syncPlan({ taskPort, planAdapter }, FEATURE);

    expect(result.kept).toContain("03-add-tests");
    expect(result.removed).not.toContain("03-add-tests");

    const task = await taskPort.get(FEATURE, "03-add-tests");
    expect(task?.status).toBe("claimed");
  });

  test("preserves manual-origin tasks", async () => {
    setupFeatureDir(tmpDir, PLAN_2_TASKS, true);
    planAdapter = new FsPlanAdapter(tmpDir);

    // Seed a manual task that doesn't appear in the plan
    seedTask(taskPort, "99-manual-hotfix", { origin: "manual" });

    const result = await syncPlan({ taskPort, planAdapter }, FEATURE);

    expect(result.manual).toContain("99-manual-hotfix");
    expect(result.removed).not.toContain("99-manual-hotfix");

    const task = await taskPort.get(FEATURE, "99-manual-hotfix");
    expect(task).not.toBeNull();
  });

  // -----------------------------------------------------------------------
  // Dependencies
  // -----------------------------------------------------------------------

  test("passes dependency folders to taskPort.create", async () => {
    setupFeatureDir(tmpDir, PLAN_3_TASKS, true);
    planAdapter = new FsPlanAdapter(tmpDir);

    await syncPlan({ taskPort, planAdapter }, FEATURE);

    // Task 1: no deps
    const t1 = await taskPort.get(FEATURE, "01-setup-database");
    expect(t1?.dependsOn ?? []).toEqual([]);

    // Task 2: depends on task 1's folder
    const t2 = await taskPort.get(FEATURE, "02-build-api");
    expect(t2?.dependsOn).toContain("01-setup-database");

    // Task 3: depends on task 2's folder
    const t3 = await taskPort.get(FEATURE, "03-add-tests");
    expect(t3?.dependsOn).toContain("02-build-api");
  });

  // -----------------------------------------------------------------------
  // Error conditions
  // -----------------------------------------------------------------------

  test("throws if plan is not approved", async () => {
    setupFeatureDir(tmpDir, PLAN_3_TASKS, false);
    planAdapter = new FsPlanAdapter(tmpDir);

    await expect(syncPlan({ taskPort, planAdapter }, FEATURE)).rejects.toThrow("approved");
  });

  test("throws if no plan exists", async () => {
    const featureDir = path.join(tmpDir, ".maestro", "features", FEATURE);
    fs.mkdirSync(featureDir, { recursive: true });
    planAdapter = new FsPlanAdapter(tmpDir);

    await expect(syncPlan({ taskPort, planAdapter }, FEATURE)).rejects.toThrow("No plan found");
  });
});
