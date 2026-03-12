import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { BUILTIN_TOOLS, getToolRegistry, getActiveAdapter, sanitizeTemplateVar } from "../../plugins/registry";
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
