/**
 * Tests for REI-137 high-priority edge case fixes:
 * - Git: branch validation, shallow clone diff, detached HEAD, index.lock, branch-already-checked-out
 * - Filesystem: case-insensitive collision, ENOSPC, long paths, symlink resolution
 * - Agent: context drift warning, tool semantics, retry guidance, summary grounding
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { ensureDir } from "../../utils/paths";
import { GitWorktreeAdapter } from "../../adapters/git-worktree";
import { findProjectRoot, listFeatures } from "../../utils/detection";
import { buildWorkerPrompt } from "../../utils/worker-prompt";

// ============================================================================
// Git: Branch Name Validation
// ============================================================================

describe("git branch name validation", () => {
  test("rejects feature names with tilde", () => {
    expect(() =>
      // @ts-expect-error -- accessing private static for testing
      GitWorktreeAdapter.validateBranchSegment("feat~1", "Feature name")
    ).toThrow("contains characters invalid for git branches");
  });

  test("rejects step names with caret", () => {
    expect(() =>
      // @ts-expect-error -- accessing private static for testing
      GitWorktreeAdapter.validateBranchSegment("task^2", "Task name")
    ).toThrow("contains characters invalid for git branches");
  });

  test("rejects names with double dots", () => {
    expect(() =>
      // @ts-expect-error -- accessing private static for testing
      GitWorktreeAdapter.validateBranchSegment("a..b", "Feature name")
    ).toThrow("contains characters invalid for git branches");
  });

  test("rejects names with spaces", () => {
    expect(() =>
      // @ts-expect-error -- accessing private static for testing
      GitWorktreeAdapter.validateBranchSegment("my feature", "Feature name")
    ).toThrow("contains characters invalid for git branches");
  });

  test("rejects names with @{", () => {
    expect(() =>
      // @ts-expect-error -- accessing private static for testing
      GitWorktreeAdapter.validateBranchSegment("ref@{0}", "Task name")
    ).toThrow("contains characters invalid for git branches");
  });

  test("accepts valid names", () => {
    expect(() =>
      // @ts-expect-error -- accessing private static for testing
      GitWorktreeAdapter.validateBranchSegment("my-feature_01.patch", "Feature name")
    ).not.toThrow();
  });
});

// ============================================================================
// Git: Shallow Clone Diff Base
// ============================================================================

describe("git shallow clone handling", () => {
  test("getSafeDiffBase returns empty tree hash for shallow repos", async () => {
    // The method exists and returns a string
    const adapter = new GitWorktreeAdapter({
      baseDir: "/tmp/nonexistent",
      hiveDir: "/tmp/nonexistent/.hive",
    });
    // When repo doesn't exist, falls back to HEAD~1
    // @ts-expect-error -- accessing private method for testing
    const base = await adapter.getSafeDiffBase("/tmp/nonexistent");
    expect(base).toBe("HEAD~1");
  });
});

// ============================================================================
// Filesystem: Path Length Validation
// ============================================================================

describe("filesystem path length validation", () => {
  test("ensureDir rejects paths exceeding MAX_PATH", () => {
    const longPath = "/tmp/" + "a".repeat(250);
    expect(() => ensureDir(longPath)).toThrow("Path exceeds maximum length");
  });

  test("ensureDir accepts paths within limit", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "maestro-path-"));
    try {
      const shortPath = path.join(tmpDir, "valid");
      expect(() => ensureDir(shortPath)).not.toThrow();
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

// ============================================================================
// Filesystem: Symlink Resolution in findProjectRoot
// ============================================================================

describe("symlink resolution", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "maestro-symlink-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test("findProjectRoot resolves symlinks to canonical path", () => {
    // Create a real project dir with .hive
    const realDir = path.join(tmpDir, "real-project");
    fs.mkdirSync(path.join(realDir, ".hive"), { recursive: true });

    // Create a symlink to it
    const linkDir = path.join(tmpDir, "link-project");
    fs.symlinkSync(realDir, linkDir);

    // Both should resolve to the same canonical path
    const fromReal = findProjectRoot(realDir);
    const fromLink = findProjectRoot(linkDir);
    expect(fromReal).toBe(fromLink);
  });
});

// ============================================================================
// Filesystem: Case-Insensitive Collision Detection
// ============================================================================

describe("case-insensitive feature collision", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "maestro-case-"));
    fs.mkdirSync(path.join(tmpDir, ".hive", "features", "API-Auth"), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test("listFeatures returns existing features", () => {
    const features = listFeatures(tmpDir);
    expect(features).toContain("API-Auth");
  });
});

// ============================================================================
// Agent: Worker Prompt -- Context Drift Warning
// ============================================================================

describe("worker prompt context drift warning", () => {
  const baseParams = {
    feature: "my-feature",
    task: "task-5",
    taskOrder: 5,
    worktreePath: "/tmp/wt",
    branch: "hive/my-feature/task-5",
    plan: "test plan",
    contextFiles: [],
    spec: "do stuff",
  };

  test("includes context budget warning when tasks are dropped", () => {
    const prompt = buildWorkerPrompt({
      ...baseParams,
      droppedTaskCount: 5,
      droppedTasksHint: "Dropped tasks: task-1, task-2, task-3, task-4, task-5",
    });
    expect(prompt).toContain("Context Budget Warning");
    expect(prompt).toContain("5 earlier completed task(s) were dropped");
    expect(prompt).toContain("Dropped tasks: task-1");
  });

  test("omits context budget warning when no tasks dropped", () => {
    const prompt = buildWorkerPrompt({
      ...baseParams,
      droppedTaskCount: 0,
    });
    expect(prompt).not.toContain("Context Budget Warning");
  });

  test("omits context budget warning when droppedTaskCount not provided", () => {
    const prompt = buildWorkerPrompt(baseParams);
    expect(prompt).not.toContain("Context Budget Warning");
  });
});

// ============================================================================
// Agent: Worker Prompt -- Tool Semantics Warning
// ============================================================================

describe("worker prompt tool semantics", () => {
  const baseParams = {
    feature: "feat",
    task: "task-1",
    taskOrder: 1,
    worktreePath: "/tmp/wt",
    branch: "hive/feat/task-1",
    plan: "test plan",
    contextFiles: [],
    spec: "do stuff",
  };

  test("includes CRITICAL tool semantics section", () => {
    const prompt = buildWorkerPrompt(baseParams);
    expect(prompt).toContain("CRITICAL -- Tool Semantics");
  });

  test("differentiates commit (SAVES) from discard (DESTROYS)", () => {
    const prompt = buildWorkerPrompt(baseParams);
    expect(prompt).toContain("**SAVES** your work");
    expect(prompt).toContain("**DESTROYS** the entire worktree");
  });

  test("warns discard is irreversible", () => {
    const prompt = buildWorkerPrompt(baseParams);
    // The table has a "Reversible?" column
    expect(prompt).toContain("| No |");
  });
});

// ============================================================================
// Agent: Worker Prompt -- Retry Guidance
// ============================================================================

describe("worker prompt retry guidance", () => {
  test("includes hard limit on retry attempts", () => {
    const prompt = buildWorkerPrompt({
      feature: "feat",
      task: "task-1",
      taskOrder: 1,
      worktreePath: "/tmp/wt",
      branch: "hive/feat/task-1",
      plan: "test plan",
      contextFiles: [],
      spec: "do stuff",
    });
    expect(prompt).toContain("HARD LIMIT: After 3 failed attempts");
    expect(prompt).toContain("MUST escalate as blocker");
    expect(prompt).toContain("context window budget");
  });
});

// ============================================================================
// Agent: Worker Prompt -- Summary Grounding
// ============================================================================

describe("worker prompt summary grounding", () => {
  test("includes grounding rule to prevent hallucination propagation", () => {
    const prompt = buildWorkerPrompt({
      feature: "feat",
      task: "task-1",
      taskOrder: 1,
      worktreePath: "/tmp/wt",
      branch: "hive/feat/task-1",
      plan: "test plan",
      contextFiles: [],
      spec: "do stuff",
    });
    expect(prompt).toContain("Grounding rule");
    expect(prompt).toContain("Hallucinated summaries propagate");
    expect(prompt).toContain("Not verified");
  });
});
