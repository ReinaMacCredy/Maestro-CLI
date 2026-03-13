/**
 * Tests for REI-136 critical edge case fixes:
 * - Atomic writes (writeJson, writeText)
 * - PID-based stale lock detection
 * - Docker shell escaping
 * - Worker prompt sanitization
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { writeJson, writeAtomic, readJson } from "../../utils/fs-io";
import { DockerSandboxAdapter } from "../../adapters/docker-sandbox";

// ============================================================================
// Atomic Writes
// ============================================================================

describe("atomic writes", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "maestro-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test("writeJson produces valid JSON", () => {
    const filePath = path.join(tmpDir, "test.json");
    const data = { name: "test", count: 42 };
    writeJson(filePath, data);
    const result = readJson<typeof data>(filePath);
    expect(result).toEqual(data);
  });

  test("writeJson creates parent directories", () => {
    const filePath = path.join(tmpDir, "nested", "deep", "test.json");
    writeJson(filePath, { ok: true });
    expect(fs.existsSync(filePath)).toBe(true);
  });

  test("writeJson leaves no temp files on success", () => {
    const filePath = path.join(tmpDir, "clean.json");
    writeJson(filePath, { clean: true });
    const files = fs.readdirSync(tmpDir);
    expect(files).toEqual(["clean.json"]);
  });

  test("writeAtomic leaves no temp files on success", () => {
    const filePath = path.join(tmpDir, "atomic.txt");
    writeAtomic(filePath, "hello world");
    const files = fs.readdirSync(tmpDir);
    expect(files).toEqual(["atomic.txt"]);
    expect(fs.readFileSync(filePath, "utf-8")).toBe("hello world");
  });

  test("writeJson overwrites existing file atomically", () => {
    const filePath = path.join(tmpDir, "overwrite.json");
    writeJson(filePath, { version: 1 });
    writeJson(filePath, { version: 2 });
    const result = readJson<{ version: number }>(filePath);
    expect(result?.version).toBe(2);
  });
});

// ============================================================================
// Docker Shell Escaping
// ============================================================================

describe("DockerSandboxAdapter shell escaping", () => {
  test("buildRunCommand quotes worktree path with spaces", () => {
    const cmd = DockerSandboxAdapter.buildRunCommand(
      "/path/with spaces/worktree",
      "npm test",
      "node:22-slim",
    );
    expect(cmd).toContain("'/path/with spaces/worktree'");
    expect(cmd).toContain("'node:22-slim'");
    expect(cmd).toContain("'npm test'");
  });

  test("buildRunCommand escapes single quotes in command", () => {
    const cmd = DockerSandboxAdapter.buildRunCommand(
      "/safe/path",
      "echo 'hello'",
      "node:22-slim",
    );
    expect(cmd).toContain("'echo '\\''hello'\\'''");
  });

  test("buildRunCommand neutralizes shell metacharacters in path", () => {
    const cmd = DockerSandboxAdapter.buildRunCommand(
      "/path/$(whoami)/worktree",
      "ls",
      "node:22-slim",
    );
    // Path is single-quoted, so $() is not expanded
    expect(cmd).toContain("'/path/$(whoami)/worktree'");
  });

  test("buildExecCommand quotes container name and command", () => {
    const cmd = DockerSandboxAdapter.buildExecCommand("my-container", "npm test");
    expect(cmd).toContain("'my-container'");
    expect(cmd).toContain("'npm test'");
  });

  test("containerName sanitizes to safe characters", () => {
    // Simulate a worktree path
    const name = DockerSandboxAdapter.containerName(
      "/project/.maestro/.worktrees/my feature!/task-1",
    );
    expect(name).toMatch(/^[a-z0-9-]+$/);
    expect(name).not.toContain(" ");
    expect(name).not.toContain("!");
  });
});

// ============================================================================
// Worker Prompt Sanitization
// ============================================================================

describe("worker prompt sanitization", () => {
  // Import the sanitize function directly since it's not exported
  // Test via buildWorkerPrompt output instead
  const { buildWorkerPrompt } = require("../../utils/worker/prompt");

  test("escapes double quotes in feature name in bash examples", () => {
    const prompt = buildWorkerPrompt({
      feature: 'feat"injection',
      task: "task-1",
      taskOrder: 1,
      worktreePath: "/tmp/wt",
      branch: "maestro/feat/task-1",
      plan: "test plan",
      contextFiles: [],
      spec: "do stuff",
    });
    // Bash examples should have escaped quotes
    expect(prompt).not.toContain('--feature "feat"injection"');
    expect(prompt).toContain('--feature "feat\\"injection"');
  });

  test("escapes dollar sign in task name in bash examples", () => {
    const prompt = buildWorkerPrompt({
      feature: "feat",
      task: "task-$(rm -rf /)",
      taskOrder: 1,
      worktreePath: "/tmp/wt",
      branch: "maestro/feat/task-1",
      plan: "test plan",
      contextFiles: [],
      spec: "do stuff",
    });
    expect(prompt).not.toContain('--task "task-$(rm -rf /)"');
    expect(prompt).toContain("\\$");
  });

  test("escapes backticks in feature name in bash examples", () => {
    const prompt = buildWorkerPrompt({
      feature: "feat`whoami`",
      task: "task-1",
      taskOrder: 1,
      worktreePath: "/tmp/wt",
      branch: "maestro/feat/task-1",
      plan: "test plan",
      contextFiles: [],
      spec: "do stuff",
    });
    expect(prompt).toContain("\\`");
  });

  test("safe names pass through unchanged in markdown table", () => {
    const prompt = buildWorkerPrompt({
      feature: "my-feature",
      task: "task-1",
      taskOrder: 1,
      worktreePath: "/tmp/wt",
      branch: "maestro/my-feature/task-1",
      plan: "test plan",
      contextFiles: [],
      spec: "do stuff",
    });
    // Markdown table uses raw values (display only, not executed)
    expect(prompt).toContain("| Feature | my-feature |");
    expect(prompt).toContain("| Task | task-1 |");
  });
});
