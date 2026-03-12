import { describe, test, expect } from "bun:test";
import {
  parseTasksFromPlan,
  validateDependencyGraph,
  resolveDependencies,
} from "../../utils/plan-parser";
import type { ParsedTask } from "../../utils/plan-parser";

describe("parseTasksFromPlan", () => {
  test("parses numbered headings into tasks", () => {
    const plan = [
      "## Plan",
      "",
      "### 1. Setup project",
      "Initialize the repo with config.",
      "",
      "### 2. Add API layer",
      "Build REST endpoints.",
    ].join("\n");

    const tasks = parseTasksFromPlan(plan);

    expect(tasks).toHaveLength(2);
    expect(tasks[0].order).toBe(1);
    expect(tasks[0].name).toBe("Setup project");
    expect(tasks[0].folder).toBe("01-setup-project");
    expect(tasks[0].description).toContain("Initialize the repo");
    expect(tasks[1].order).toBe(2);
    expect(tasks[1].name).toBe("Add API layer");
    expect(tasks[1].folder).toBe("02-add-api-layer");
  });

  test("returns empty array for plan with no task headings", () => {
    const plan = "## Overview\n\nJust some notes.";
    expect(parseTasksFromPlan(plan)).toEqual([]);
  });

  test("returns empty array for empty string", () => {
    expect(parseTasksFromPlan("")).toEqual([]);
  });

  test("parses explicit dependency annotations", () => {
    const plan = [
      "### 1. Foundation",
      "Base work.",
      "**Depends on**: none",
      "",
      "### 2. Core logic",
      "Main implementation.",
      "**Depends on**: 1",
      "",
      "### 3. Integration",
      "Wire it together.",
      "**Depends on**: 1, 2",
    ].join("\n");

    const tasks = parseTasksFromPlan(plan);

    expect(tasks).toHaveLength(3);
    expect(tasks[0].dependsOnNumbers).toEqual([]);
    expect(tasks[1].dependsOnNumbers).toEqual([1]);
    expect(tasks[2].dependsOnNumbers).toEqual([1, 2]);
  });

  test("leaves dependsOnNumbers null when no annotation present", () => {
    const plan = "### 1. Solo task\nDo the thing.";
    const tasks = parseTasksFromPlan(plan);
    expect(tasks[0].dependsOnNumbers).toBeNull();
  });

  test("stops task body at non-numbered ### heading", () => {
    const plan = [
      "### 1. First task",
      "Description here.",
      "### Non-Goals",
      "This should not be part of the task.",
    ].join("\n");

    const tasks = parseTasksFromPlan(plan);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].description).not.toContain("Non-Goals");
  });
});

describe("validateDependencyGraph", () => {
  test("accepts a valid graph with no errors", () => {
    const tasks: ParsedTask[] = [
      { folder: "01-a", order: 1, name: "A", description: "", dependsOnNumbers: [] },
      { folder: "02-b", order: 2, name: "B", description: "", dependsOnNumbers: [1] },
      { folder: "03-c", order: 3, name: "C", description: "", dependsOnNumbers: [1, 2] },
    ];

    expect(() => validateDependencyGraph(tasks, "test-feature")).not.toThrow();
  });

  test("accepts tasks with null (implicit) dependencies", () => {
    const tasks: ParsedTask[] = [
      { folder: "01-a", order: 1, name: "A", description: "", dependsOnNumbers: null },
      { folder: "02-b", order: 2, name: "B", description: "", dependsOnNumbers: null },
    ];

    expect(() => validateDependencyGraph(tasks, "test-feature")).not.toThrow();
  });

  test("throws on self-dependency", () => {
    const tasks: ParsedTask[] = [
      { folder: "01-a", order: 1, name: "A", description: "", dependsOnNumbers: [1] },
    ];

    expect(() => validateDependencyGraph(tasks, "test-feature")).toThrow(/Self-dependency/);
  });

  test("throws on reference to missing task number", () => {
    const tasks: ParsedTask[] = [
      { folder: "01-a", order: 1, name: "A", description: "", dependsOnNumbers: [] },
      { folder: "02-b", order: 2, name: "B", description: "", dependsOnNumbers: [99] },
    ];

    expect(() => validateDependencyGraph(tasks, "test-feature")).toThrow(/Unknown task number 99/);
  });

  test("throws on cyclic dependencies", () => {
    const tasks: ParsedTask[] = [
      { folder: "01-a", order: 1, name: "A", description: "", dependsOnNumbers: [2] },
      { folder: "02-b", order: 2, name: "B", description: "", dependsOnNumbers: [1] },
    ];

    expect(() => validateDependencyGraph(tasks, "test-feature")).toThrow(/Cycle detected/);
  });
});

describe("resolveDependencies", () => {
  const allTasks: ParsedTask[] = [
    { folder: "01-setup", order: 1, name: "Setup", description: "", dependsOnNumbers: [] },
    { folder: "02-core", order: 2, name: "Core", description: "", dependsOnNumbers: [1] },
    { folder: "03-finish", order: 3, name: "Finish", description: "", dependsOnNumbers: null },
  ];

  test("resolves explicit dependency numbers to folder names", () => {
    const deps = resolveDependencies(allTasks[1], allTasks);
    expect(deps).toEqual(["01-setup"]);
  });

  test("returns empty array for explicit empty deps", () => {
    const deps = resolveDependencies(allTasks[0], allTasks);
    expect(deps).toEqual([]);
  });

  test("resolves null deps to implicit sequential (N-1)", () => {
    const deps = resolveDependencies(allTasks[2], allTasks);
    expect(deps).toEqual(["02-core"]);
  });

  test("returns empty array for first task with null deps", () => {
    const firstWithNull: ParsedTask = {
      folder: "01-first",
      order: 1,
      name: "First",
      description: "",
      dependsOnNumbers: null,
    };
    const deps = resolveDependencies(firstWithNull, allTasks);
    expect(deps).toEqual([]);
  });

  test("resolves multiple explicit dependencies", () => {
    const task: ParsedTask = {
      folder: "04-multi",
      order: 4,
      name: "Multi",
      description: "",
      dependsOnNumbers: [1, 2],
    };
    const deps = resolveDependencies(task, allTasks);
    expect(deps).toEqual(["01-setup", "02-core"]);
  });
});
