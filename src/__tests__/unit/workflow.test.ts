import { describe, test, expect } from "bun:test";
import { countTaskStatuses, getNextAction } from "../../utils/workflow";

describe("countTaskStatuses", () => {
  test("returns all zeros for empty list", () => {
    const counts = countTaskStatuses([]);
    expect(counts).toEqual({ pending: 0, inProgress: 0, done: 0 });
  });

  test("counts mixed statuses correctly", () => {
    const tasks = [
      { status: "pending" },
      { status: "pending" },
      { status: "in_progress" },
      { status: "done" },
      { status: "done" },
      { status: "done" },
    ];

    const counts = countTaskStatuses(tasks);

    expect(counts.pending).toBe(2);
    expect(counts.inProgress).toBe(1);
    expect(counts.done).toBe(3);
  });

  test("ignores statuses outside pending/in_progress/done", () => {
    const tasks = [
      { status: "cancelled" },
      { status: "blocked" },
      { status: "failed" },
      { status: "done" },
    ];

    const counts = countTaskStatuses(tasks);

    expect(counts.pending).toBe(0);
    expect(counts.inProgress).toBe(0);
    expect(counts.done).toBe(1);
  });

  test("handles all same status", () => {
    const tasks = [
      { status: "in_progress" },
      { status: "in_progress" },
    ];

    const counts = countTaskStatuses(tasks);

    expect(counts).toEqual({ pending: 0, inProgress: 2, done: 0 });
  });
});

describe("getNextAction", () => {
  test("suggests writing plan when no plan exists", () => {
    const action = getNextAction(null, [], []);
    expect(action).toContain("plan-write");
  });

  test("suggests writing plan when plan is draft", () => {
    const action = getNextAction("draft", [], []);
    expect(action).toContain("plan-write");
  });

  test("suggests waiting for approval when plan is in review", () => {
    const action = getNextAction("review", [], []);
    expect(action).toContain("approval");
  });

  test("suggests task-sync when approved but no tasks", () => {
    const action = getNextAction("approved", [], []);
    expect(action).toContain("task-sync");
  });

  test("suggests continuing in-progress task", () => {
    const tasks = [
      { status: "done", folder: "01-setup" },
      { status: "in_progress", folder: "02-core" },
      { status: "pending", folder: "03-finish" },
    ];
    const action = getNextAction("approved", tasks, ["03-finish"]);
    expect(action).toContain("02-core");
    expect(action).toContain("Continue");
  });

  test("suggests starting single runnable task", () => {
    const tasks = [
      { status: "done", folder: "01-setup" },
      { status: "pending", folder: "02-core" },
    ];
    const action = getNextAction("approved", tasks, ["02-core"]);
    expect(action).toContain("task-start");
    expect(action).toContain("02-core");
  });

  test("reports multiple sequential runnable tasks", () => {
    const tasks = [
      { status: "pending", folder: "01-a" },
      { status: "pending", folder: "02-b" },
    ];
    const action = getNextAction("approved", tasks, ["01-a", "02-b"]);
    expect(action).toContain("2 tasks");
    expect(action).toContain("one at a time");
    expect(action).toContain("01-a");
    expect(action).toContain("02-b");
  });

  test("reports all tasks complete", () => {
    const tasks = [
      { status: "done", folder: "01-a" },
      { status: "done", folder: "02-b" },
    ];
    const action = getNextAction("approved", tasks, []);
    expect(action).toContain("complete");
  });

  test("reports blocked when pending tasks exist but none runnable", () => {
    const tasks = [
      { status: "pending", folder: "01-blocked-task" },
    ];
    const action = getNextAction("approved", tasks, []);
    expect(action).toContain("blocked");
    expect(action).toContain("dependencies");
  });

  test("surfaces partial tasks before claiming the feature is complete", () => {
    const tasks = [
      { status: "done", folder: "01-setup" },
      { status: "partial", folder: "02-core" },
    ];
    const action = getNextAction("approved", tasks, []);
    expect(action).toContain("partial");
    expect(action).toContain("02-core");
  });

  test("surfaces blocked tasks before claiming the feature is complete", () => {
    const tasks = [
      { status: "blocked", folder: "03-waiting" },
    ];
    const action = getNextAction("approved", tasks, []);
    expect(action).toContain("blocked");
    expect(action).toContain("03-waiting");
  });

  test("surfaces failed tasks before claiming the feature is complete", () => {
    const tasks = [
      { status: "failed", folder: "04-retry" },
    ];
    const action = getNextAction("approved", tasks, []);
    expect(action).toContain("task-update");
    expect(action).toContain("04-retry");
  });
});
