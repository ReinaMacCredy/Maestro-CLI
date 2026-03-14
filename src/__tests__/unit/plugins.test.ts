import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { BUILTIN_TOOLS, getToolRegistry, getActiveAdapter, sanitizeTemplateVar, checkTool, checkAllTools } from "../../plugins/registry";
import type { ToolDefinition } from "../../plugins/types";
import { parseFrontmatter, loadPlugins } from "../../plugins/loader";

// ============================================================================
// Built-in registry
// ============================================================================

describe("BUILTIN_TOOLS", () => {
  test("has 4 entries", () => {
    expect(BUILTIN_TOOLS).toHaveLength(4);
  });

  test("includes br, git, rg, tilth", () => {
    const names = BUILTIN_TOOLS.map((t) => t.name);
    expect(names).toEqual(["br", "git", "rg", "tilth"]);
  });
});

// ============================================================================
// getActiveAdapter
// ============================================================================

describe("getActiveAdapter", () => {
  // Use a non-existent dir so no plugins are loaded
  const noPlugins = join(tmpdir(), "maestro-no-plugins-" + Date.now());

  test("returns br for 'tasks' port", () => {
    const adapter = getActiveAdapter("tasks", noPlugins);
    expect(adapter).toBeDefined();
    expect(adapter!.name).toBe("br");
  });

  test("returns rg for 'search' port", () => {
    const adapter = getActiveAdapter("search", noPlugins);
    expect(adapter).toBeDefined();
    expect(adapter!.name).toBe("rg");
  });

  test("returns tilth for 'code-intel' port", () => {
    const adapter = getActiveAdapter("code-intel", noPlugins);
    expect(adapter).toBeDefined();
    expect(adapter!.name).toBe("tilth");
  });

  test("returns undefined for unknown port", () => {
    expect(getActiveAdapter("nonexistent", noPlugins)).toBeUndefined();
  });

  test("git has no port so is not returned for any port query", () => {
    // git is registered but has no 'provides' field
    const gitTool = BUILTIN_TOOLS.find((t) => t.name === "git");
    expect(gitTool).toBeDefined();
    expect(gitTool!.provides).toBeUndefined();
  });
});

// ============================================================================
// Plugin override
// ============================================================================

describe("plugin override", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "maestro-tools-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test("user plugin providing 'search' overrides built-in rg", () => {
    // Create a plugin that provides 'search'
    const pluginDir = join(tmpDir, "my-search");
    mkdirSync(pluginDir);
    writeFileSync(
      join(pluginDir, "TOOL.md"),
      [
        "---",
        "name: ag",
        "binary: ag",
        "detect: ag --version",
        "provides: search",
        "description: the silver searcher",
        "---",
        "",
        "# ag",
        "A fast grep alternative.",
      ].join("\n"),
    );

    const registry = getToolRegistry(tmpDir);
    // rg should be gone, ag should be present
    const names = registry.map((t) => t.name);
    expect(names).not.toContain("rg");
    expect(names).toContain("ag");

    // getActiveAdapter should return the plugin
    const adapter = getActiveAdapter("search", tmpDir);
    expect(adapter).toBeDefined();
    expect(adapter!.name).toBe("ag");
  });

  test("user plugin providing unknown port does not remove any built-in", () => {
    const pluginDir = join(tmpDir, "my-lint");
    mkdirSync(pluginDir);
    writeFileSync(
      join(pluginDir, "TOOL.md"),
      [
        "---",
        "name: eslint",
        "binary: eslint",
        "provides: lint",
        "---",
      ].join("\n"),
    );

    const registry = getToolRegistry(tmpDir);
    // All 4 built-ins + 1 plugin
    expect(registry).toHaveLength(5);
  });
});

// ============================================================================
// parseFrontmatter
// ============================================================================

describe("parseFrontmatter", () => {
  test("parses simple key-value pairs", () => {
    const content = "---\nname: foo\nbinary: bar\n---\n# Body";
    const fm = parseFrontmatter(content);
    expect(fm).toEqual({ name: "foo", binary: "bar" });
  });

  test("strips quotes from values", () => {
    const content = '---\nname: "quoted"\nbinary: \'single\'\n---';
    const fm = parseFrontmatter(content);
    expect(fm).toEqual({ name: "quoted", binary: "single" });
  });

  test("returns null when no frontmatter markers", () => {
    expect(parseFrontmatter("just a file")).toBeNull();
  });

  test("skips comment lines", () => {
    const content = "---\n# comment\nname: x\nbinary: y\n---";
    const fm = parseFrontmatter(content);
    expect(fm).toEqual({ name: "x", binary: "y" });
  });
});

// ============================================================================
// loadPlugins
// ============================================================================

describe("loadPlugins", () => {
  test("returns empty for non-existent directory", () => {
    const result = loadPlugins(join(tmpdir(), "no-such-dir-" + Date.now()));
    expect(result).toEqual([]);
  });
});

// ============================================================================
// Template sanitization
// ============================================================================

describe("sanitizeTemplateVar", () => {
  test("escapes $ sign", () => {
    expect(sanitizeTemplateVar("$HOME")).toBe("\\$HOME");
  });

  test("escapes backtick", () => {
    expect(sanitizeTemplateVar("`whoami`")).toBe("\\`whoami\\`");
  });

  test("escapes semicolon", () => {
    expect(sanitizeTemplateVar("foo; rm -rf")).toBe("foo\\; rm -rf");
  });

  test("escapes pipe", () => {
    expect(sanitizeTemplateVar("a | b")).toBe("a \\| b");
  });

  test("escapes ampersand", () => {
    expect(sanitizeTemplateVar("a && b")).toBe("a \\&\\& b");
  });

  test("escapes multiple dangerous chars in one string", () => {
    expect(sanitizeTemplateVar("$(`cmd`); rm | x & y")).toBe(
      "\\$(\\`cmd\\`)\\; rm \\| x \\& y",
    );
  });

  test("leaves safe strings unchanged", () => {
    expect(sanitizeTemplateVar("hello-world_123")).toBe("hello-world_123");
  });
});

// ============================================================================
// checkTool
// ============================================================================

describe("checkTool", () => {
  test("detects an installed tool with a detect command", async () => {
    const tool: ToolDefinition = {
      name: "echo-tool",
      binary: "echo",
      detect: "echo hello 1.2.3",
    };
    const status = await checkTool(tool);
    expect(status.installed).toBe(true);
    expect(status.name).toBe("echo-tool");
    expect(status.binary).toBe("echo");
    expect(status.detectError).toBeUndefined();
  });

  test("reports not installed for a nonexistent binary", async () => {
    const tool: ToolDefinition = {
      name: "no-such-tool",
      binary: "maestro_nonexistent_binary_xyz_999",
      detect: "maestro_nonexistent_binary_xyz_999 --version",
    };
    const status = await checkTool(tool);
    expect(status.installed).toBe(false);
    expect(status.detectError).toBeDefined();
    expect(typeof status.detectError).toBe("string");
    expect(status.detectError!.length).toBeGreaterThan(0);
  });

  test("falls back to command -v when no detect command is set", async () => {
    // 'true' is a shell built-in available on all POSIX systems
    const tool: ToolDefinition = {
      name: "true-tool",
      binary: "true",
    };
    const status = await checkTool(tool);
    expect(status.installed).toBe(true);
    expect(status.detectError).toBeUndefined();
  });

  test("falls back to command -v and reports missing for nonexistent binary", async () => {
    const tool: ToolDefinition = {
      name: "missing-fallback",
      binary: "maestro_nonexistent_fallback_xyz_999",
    };
    const status = await checkTool(tool);
    expect(status.installed).toBe(false);
    expect(status.detectError).toBeDefined();
  });

  test("extracts version from detect output", async () => {
    const tool: ToolDefinition = {
      name: "versioned-tool",
      binary: "echo",
      detect: "echo 'tool version 3.14.159'",
    };
    const status = await checkTool(tool);
    expect(status.installed).toBe(true);
    expect(status.version).toBe("3.14.159");
  });

  test("respects source parameter", async () => {
    const tool: ToolDefinition = {
      name: "src-tool",
      binary: "echo",
      detect: "echo ok",
    };
    const asBuiltin = await checkTool(tool, "builtin");
    expect(asBuiltin.source).toBe("builtin");

    const asPlugin = await checkTool(tool, "plugin");
    expect(asPlugin.source).toBe("plugin");
  });

  test("defaults source to builtin", async () => {
    const tool: ToolDefinition = {
      name: "default-src",
      binary: "echo",
      detect: "echo ok",
    };
    const status = await checkTool(tool);
    expect(status.source).toBe("builtin");
  });

  test("preserves provides field in status", async () => {
    const tool: ToolDefinition = {
      name: "port-tool",
      binary: "echo",
      detect: "echo ok",
      provides: "search",
    };
    const status = await checkTool(tool);
    expect(status.provides).toBe("search");
  });
});

// ============================================================================
// checkAllTools
// ============================================================================

describe("checkAllTools", () => {
  test("returns statuses for all built-in tools", async () => {
    // Use a nonexistent plugin dir so only built-ins are checked
    const noPlugins = join(tmpdir(), "maestro-no-plugins-check-" + Date.now());
    const statuses = await checkAllTools(noPlugins);
    expect(statuses).toHaveLength(BUILTIN_TOOLS.length);

    const names = statuses.map((s) => s.name);
    for (const builtin of BUILTIN_TOOLS) {
      expect(names).toContain(builtin.name);
    }
  });

  test("each status has required fields", async () => {
    const noPlugins = join(tmpdir(), "maestro-no-plugins-fields-" + Date.now());
    const statuses = await checkAllTools(noPlugins);

    for (const status of statuses) {
      expect(typeof status.name).toBe("string");
      expect(typeof status.binary).toBe("string");
      expect(typeof status.installed).toBe("boolean");
      expect(["builtin", "plugin"]).toContain(status.source);
    }
  });

  test("includes user plugins with source 'plugin'", async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "maestro-check-all-"));
    try {
      const pluginDir = join(tmpDir, "my-tool");
      mkdirSync(pluginDir);
      writeFileSync(
        join(pluginDir, "TOOL.md"),
        [
          "---",
          "name: my-checker",
          "binary: echo",
          "detect: echo 'checker 2.0.0'",
          "provides: lint",
          "description: a test checker",
          "---",
        ].join("\n"),
      );

      const statuses = await checkAllTools(tmpDir);
      const pluginStatus = statuses.find((s) => s.name === "my-checker");
      expect(pluginStatus).toBeDefined();
      expect(pluginStatus!.source).toBe("plugin");
      expect(pluginStatus!.installed).toBe(true);
      expect(pluginStatus!.version).toBe("2.0.0");
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
