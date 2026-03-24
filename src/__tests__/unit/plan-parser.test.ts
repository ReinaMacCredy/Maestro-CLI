import { describe, test, expect } from "bun:test";
import {
  parseTasksFromPlan,
  validateDependencyGraph,
  resolveDependencies,
  extractPlanOutline,
} from "../../plans/parser.ts";
import type { ParsedTask } from "../../plans/parser.ts";

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

  test("parses bullet-prefixed dependency annotations", () => {
    const plan = [
      "### 1. Foundation",
      "Base work.",
      "- Depends on: none",
      "",
      "### 2. Core logic",
      "Main implementation.",
      "- **Depends on**: 1",
      "",
      "### 3. Integration",
      "Wire it together.",
      "- **Depends on**: 1, 3",
      "",
      "### 4. Final",
      "Wrap up.",
      "* **Depends on**: 2",
    ].join("\n");

    const tasks = parseTasksFromPlan(plan);

    expect(tasks).toHaveLength(4);
    expect(tasks[0].dependsOnNumbers).toEqual([]);
    expect(tasks[1].dependsOnNumbers).toEqual([1]);
    expect(tasks[2].dependsOnNumbers).toEqual([1, 3]);
    expect(tasks[3].dependsOnNumbers).toEqual([2]);
  });

  test("leaves dependsOnNumbers empty when no annotation present on task 1", () => {
    const plan = "### 1. Solo task\nDo the thing.";
    const tasks = parseTasksFromPlan(plan);
    // Task 1 has no annotation and order === 1, so implicit dep is empty
    expect(tasks[0].dependsOnNumbers).toEqual([]);
  });

  test("applies implicit sequential dep when no annotation present on task 2+", () => {
    const plan = [
      "### 1. First",
      "Do one.",
      "",
      "### 2. Second",
      "Do two.",
    ].join("\n");
    const tasks = parseTasksFromPlan(plan);
    // Task 2 has no annotation -> implicit dep on task 1
    expect(tasks[1].dependsOnNumbers).toEqual([1]);
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
      { id: "a", folder: "01-a", order: 1, name: "A", description: "", dependsOnNumbers: [] },
      { id: "b", folder: "02-b", order: 2, name: "B", description: "", dependsOnNumbers: [1] },
      { id: "c", folder: "03-c", order: 3, name: "C", description: "", dependsOnNumbers: [1, 2] },
    ];

    expect(() => validateDependencyGraph(tasks, "test-feature")).not.toThrow();
  });

  test("accepts tasks with implicit (sequential) dependencies", () => {
    // dependsOnNumbers is never null now -- implicit deps resolved at parse time
    const tasks: ParsedTask[] = [
      { id: "a", folder: "01-a", order: 1, name: "A", description: "", dependsOnNumbers: [] },
      { id: "b", folder: "02-b", order: 2, name: "B", description: "", dependsOnNumbers: [1] },
    ];

    expect(() => validateDependencyGraph(tasks, "test-feature")).not.toThrow();
  });

  test("throws on self-dependency", () => {
    const tasks: ParsedTask[] = [
      { id: "a", folder: "01-a", order: 1, name: "A", description: "", dependsOnNumbers: [1] },
    ];

    expect(() => validateDependencyGraph(tasks, "test-feature")).toThrow(/Self-dependency/);
  });

  test("throws on reference to missing task number", () => {
    const tasks: ParsedTask[] = [
      { id: "a", folder: "01-a", order: 1, name: "A", description: "", dependsOnNumbers: [] },
      { id: "b", folder: "02-b", order: 2, name: "B", description: "", dependsOnNumbers: [99] },
    ];

    expect(() => validateDependencyGraph(tasks, "test-feature")).toThrow(/Unknown task number 99/);
  });

  test("throws on cyclic dependencies", () => {
    const tasks: ParsedTask[] = [
      { id: "a", folder: "01-a", order: 1, name: "A", description: "", dependsOnNumbers: [2] },
      { id: "b", folder: "02-b", order: 2, name: "B", description: "", dependsOnNumbers: [1] },
    ];

    expect(() => validateDependencyGraph(tasks, "test-feature")).toThrow(/Cycle detected/);
  });
});

describe("resolveDependencies", () => {
  // id is the slug derived from the task name (no numeric prefix)
  const allTasks: ParsedTask[] = [
    { id: "setup", folder: "01-setup", order: 1, name: "Setup", description: "", dependsOnNumbers: [] },
    { id: "core", folder: "02-core", order: 2, name: "Core", description: "", dependsOnNumbers: [1] },
    // Implicit dep resolved at parse time: task 3 depends on task 2
    { id: "finish", folder: "03-finish", order: 3, name: "Finish", description: "", dependsOnNumbers: [2] },
  ];

  test("resolves explicit dependency numbers to task ids", () => {
    const deps = resolveDependencies(allTasks[1], allTasks);
    expect(deps).toEqual(["setup"]);
  });

  test("returns empty array for explicit empty deps", () => {
    const deps = resolveDependencies(allTasks[0], allTasks);
    expect(deps).toEqual([]);
  });

  test("resolves implicit sequential dep (N-1) to task id", () => {
    // dependsOnNumbers: [2] -> resolves to id of task order 2
    const deps = resolveDependencies(allTasks[2], allTasks);
    expect(deps).toEqual(["core"]);
  });

  test("returns empty array for first task with no deps", () => {
    const firstTask: ParsedTask = {
      id: "first",
      folder: "01-first",
      order: 1,
      name: "First",
      description: "",
      dependsOnNumbers: [],
    };
    const deps = resolveDependencies(firstTask, allTasks);
    expect(deps).toEqual([]);
  });

  test("resolves multiple explicit dependencies to task ids", () => {
    const task: ParsedTask = {
      id: "multi",
      folder: "04-multi",
      order: 4,
      name: "Multi",
      description: "",
      dependsOnNumbers: [1, 2],
    };
    const deps = resolveDependencies(task, allTasks);
    expect(deps).toEqual(["setup", "core"]);
  });
});

describe("extractPlanOutline", () => {
  test("returns full content as preview when under 500 chars", () => {
    const short = "## Overview\n\nA short plan.";
    const { preview, headings } = extractPlanOutline(short);
    expect(preview).toBe(short);
    expect(headings).toEqual(["Overview"]);
  });

  test("truncates preview at last newline before 500 chars", () => {
    const lines = Array.from({ length: 50 }, (_, i) => `Line ${i + 1} of the plan content.`);
    const content = lines.join("\n");
    expect(content.length).toBeGreaterThan(500);

    const { preview } = extractPlanOutline(content);
    expect(preview.length).toBeLessThanOrEqual(500);
    expect(preview.endsWith("\n")).toBe(false);
    // Should end at a complete line
    expect(content.startsWith(preview)).toBe(true);
  });

  test("extracts ## and ### headings", () => {
    const plan = [
      "# Title",
      "## Discovery",
      "Some notes.",
      "### 1. Setup",
      "Details.",
      "### 2. Build",
      "More details.",
      "## Non-Goals",
      "None.",
    ].join("\n");

    const { headings } = extractPlanOutline(plan);
    expect(headings).toEqual(["Discovery", "1. Setup", "2. Build", "Non-Goals"]);
  });

  test("returns empty headings for plan with no headings", () => {
    const { headings } = extractPlanOutline("Just plain text.");
    expect(headings).toEqual([]);
  });

  test("handles empty string", () => {
    const { preview, headings } = extractPlanOutline("");
    expect(preview).toBe("");
    expect(headings).toEqual([]);
  });
});
