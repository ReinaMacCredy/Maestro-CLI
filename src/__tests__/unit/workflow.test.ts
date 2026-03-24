import { describe, test, expect } from "bun:test";
import { countTaskStatuses, derivePipelineStage, getNextAction } from "../../workflow/stages.ts";
import type { TaskStatusType } from '../../core/types.ts';

type TaskEntry = { status: TaskStatusType; folder: string };

describe("countTaskStatuses", () => {
  test("returns all zeros for empty list", () => {
    const counts = countTaskStatuses([]);
    expect(counts).toEqual({ pending: 0, inProgress: 0, done: 0, review: 0, revision: 0 });
  });

  test("counts mixed statuses correctly", () => {
    const tasks: Array<{ status: TaskStatusType }> = [
      { status: "pending" },
      { status: "pending" },
      { status: "claimed" },
      { status: "done" },
      { status: "done" },
      { status: "done" },
    ];

    const counts = countTaskStatuses(tasks);

    expect(counts.pending).toBe(2);
    expect(counts.inProgress).toBe(1);
    expect(counts.done).toBe(3);
  });

  test("ignores statuses outside pending/claimed/done/blocked", () => {
    const tasks: Array<{ status: TaskStatusType }> = [
      { status: "blocked" },
      { status: "done" },
    ];

    const counts = countTaskStatuses(tasks);

    expect(counts.pending).toBe(0);
    expect(counts.inProgress).toBe(0);
    expect(counts.done).toBe(1);
  });

  test("handles all same status", () => {
    const tasks: Array<{ status: TaskStatusType }> = [
      { status: "claimed" },
      { status: "claimed" },
    ];

    const counts = countTaskStatuses(tasks);

    expect(counts).toEqual({ pending: 0, inProgress: 2, done: 0, review: 0, revision: 0 });
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

  test("suggests task-sync when approved but no tasks", () => {
    const action = getNextAction("approved", [], []);
    expect(action).toContain("task-sync");
  });

  test("suggests continuing claimed task", () => {
    const tasks: TaskEntry[] = [
      { status: "done", folder: "01-setup" },
      { status: "claimed", folder: "02-core" },
      { status: "pending", folder: "03-finish" },
    ];
    const action = getNextAction("approved", tasks, ["03-finish"]);
    expect(action).toContain("02-core");
    expect(action).toContain("Task in progress");
  });

  test("suggests claiming single runnable task", () => {
    const tasks: TaskEntry[] = [
      { status: "done", folder: "01-setup" },
      { status: "pending", folder: "02-core" },
    ];
    const action = getNextAction("approved", tasks, ["02-core"]);
    expect(action).toContain("task_claim");
    expect(action).toContain("02-core");
  });

  test("reports multiple runnable tasks", () => {
    const tasks: TaskEntry[] = [
      { status: "pending", folder: "01-a" },
      { status: "pending", folder: "02-b" },
    ];
    const action = getNextAction("approved", tasks, ["01-a", "02-b"]);
    expect(action).toContain("task_claim");
    expect(action).toContain("01-a");
    expect(action).toContain("02-b");
  });

  test("reports all tasks complete", () => {
    const tasks: TaskEntry[] = [
      { status: "done", folder: "01-a" },
      { status: "done", folder: "02-b" },
    ];
    const action = getNextAction("approved", tasks, []);
    expect(action).toContain("complete");
  });

  test("reports blocked when pending tasks exist but none runnable", () => {
    const tasks: TaskEntry[] = [
      { status: "pending", folder: "01-blocked-task" },
    ];
    const action = getNextAction("approved", tasks, []);
    expect(action).toContain("blocked");
    expect(action).toContain("dependencies");
  });

  test("surfaces blocked tasks with unblock guidance", () => {
    const tasks: TaskEntry[] = [
      { status: "blocked", folder: "03-waiting" },
    ];
    const action = getNextAction("approved", tasks, []);
    expect(action).toContain("blocker");
    expect(action).toContain("03-waiting");
    expect(action).toContain("task_unblock");
  });

  test("surfaces review tasks with accept/reject guidance", () => {
    const tasks: TaskEntry[] = [
      { status: "done", folder: "01-setup" },
      { status: "review", folder: "02-core" },
      { status: "pending", folder: "03-finish" },
    ];
    const action = getNextAction("approved", tasks, []);
    expect(action).toContain("02-core");
    expect(action).toContain("task_accept");
  });

  test("surfaces revision tasks with claim guidance", () => {
    const tasks: TaskEntry[] = [
      { status: "done", folder: "01-setup" },
      { status: "revision", folder: "02-core" },
    ];
    const action = getNextAction("approved", tasks, []);
    expect(action).toContain("02-core");
    expect(action).toContain("revision");
    expect(action).toContain("claim");
  });

  test("review takes priority over claimed in next action", () => {
    const tasks: TaskEntry[] = [
      { status: "review", folder: "01-needs-review" },
      { status: "claimed", folder: "02-in-progress" },
    ];
    const action = getNextAction("approved", tasks, []);
    expect(action).toContain("01-needs-review");
    expect(action).toContain("review");
  });
});

describe("derivePipelineStage", () => {
  test("returns discovery when no plan, no tasks, no context", () => {
    expect(derivePipelineStage({ planExists: false, planApproved: false, taskTotal: 0, taskDone: 0, contextCount: 0 }))
      .toBe("discovery");
  });

  test("returns research when no plan but context files exist", () => {
    expect(derivePipelineStage({ planExists: false, planApproved: false, taskTotal: 0, taskDone: 0, contextCount: 3 }))
      .toBe("research");
  });

  test("returns planning when plan exists but not approved", () => {
    expect(derivePipelineStage({ planExists: true, planApproved: false, taskTotal: 0, taskDone: 0, contextCount: 0 }))
      .toBe("planning");
  });

  test("returns approval when plan approved but no tasks synced", () => {
    expect(derivePipelineStage({ planExists: true, planApproved: true, taskTotal: 0, taskDone: 0, contextCount: 0 }))
      .toBe("approval");
  });

  test("returns execution when tasks exist and not all done", () => {
    expect(derivePipelineStage({ planExists: true, planApproved: true, taskTotal: 5, taskDone: 2, contextCount: 0 }))
      .toBe("execution");
  });

  test("returns done when all tasks complete", () => {
    expect(derivePipelineStage({ planExists: true, planApproved: true, taskTotal: 5, taskDone: 5, contextCount: 0 }))
      .toBe("done");
  });
});

describe("countTaskStatuses with review/revision", () => {
  test("counts review and revision states", () => {
    const tasks: Array<{ status: TaskStatusType }> = [
      { status: "pending" },
      { status: "claimed" },
      { status: "done" },
      { status: "review" },
      { status: "revision" },
    ];
    const counts = countTaskStatuses(tasks);
    expect(counts).toEqual({
      pending: 1, inProgress: 1, done: 1, review: 1, revision: 1,
    });
  });
});
