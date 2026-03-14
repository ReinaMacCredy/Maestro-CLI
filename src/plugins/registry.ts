/**
 * Tool registry -- merges built-in tools with user plugins.
 *
 * Port conflict resolution: user plugins override built-in tools for the same port.
 * Template variable sanitization: escapes shell-dangerous characters in substitutions.
 */

import { execSync } from "child_process";
import type { ToolDefinition, ToolStatus } from "./types";
import { loadPlugins } from "./loader";

// ============================================================================
// Built-in Tools
// ============================================================================

export const BUILTIN_TOOLS: ToolDefinition[] = [
  { name: "br", binary: "br", detect: "br --version", provides: "tasks", description: "beads_rust task manager" },
  { name: "git", binary: "git", detect: "git --version", description: "version control" },
  { name: "rg", binary: "rg", detect: "rg --version", provides: "search", description: "ripgrep search" },
  { name: "tilth", binary: "tilth", detect: "tilth --version", provides: "code-intel", description: "code intelligence" },
];

// ============================================================================
// Template Sanitization
// ============================================================================

/**
 * Characters that must be escaped in template variable substitutions to
 * prevent shell injection: $, backtick, ;, |, &
 */
const DANGEROUS_CHARS = /[$`;|&]/g;

/**
 * Escape dangerous shell characters in a value destined for template substitution.
 */
export function sanitizeTemplateVar(value: string): string {
  return value.replace(DANGEROUS_CHARS, (ch) => `\\${ch}`);
}

// ============================================================================
// Registry
// ============================================================================

/**
 * Return all registered tools: built-in + user plugins.
 * When a user plugin declares the same `provides` port as a built-in tool,
 * the user plugin wins (last-configured wins).
 */
export function getToolRegistry(pluginDir?: string): ToolDefinition[] {
  const plugins = loadPlugins(pluginDir);

  // Collect ports claimed by user plugins
  const pluginPorts = new Set<string>();
  for (const p of plugins) {
    if (p.provides) pluginPorts.add(p.provides);
  }

  // Filter built-ins: exclude any whose port is overridden by a plugin
  const filtered = BUILTIN_TOOLS.filter(
    (b) => !b.provides || !pluginPorts.has(b.provides),
  );

  return [...filtered, ...plugins];
}

/**
 * Check whether a single tool is installed by running its detect command.
 */
export async function checkTool(
  tool: ToolDefinition,
  source: "builtin" | "plugin" = "builtin",
): Promise<ToolStatus> {
  const status: ToolStatus = {
    name: tool.name,
    binary: tool.binary,
    installed: false,
    provides: tool.provides,
    source,
  };

  const cmd = tool.detect;
  if (!cmd) {
    // No detect command -- try `which <binary>`
    try {
      const safeBinary = tool.binary.replace(/'/g, "'\\''");
      execSync(`command -v '${safeBinary}'`, { stdio: "pipe" });
      status.installed = true;
    } catch (err) {
      status.detectError = err instanceof Error ? err.message : "not found";
    }
    return status;
  }

  try {
    const output = execSync(cmd, { stdio: "pipe", timeout: 5000 }).toString().trim();
    status.installed = true;
    // Attempt to extract a version string from the first line
    const firstLine = output.split("\n")[0];
    const versionMatch = firstLine.match(/(\d+\.\d+[\w.-]*)/);
    if (versionMatch) status.version = versionMatch[1];
  } catch (err) {
    status.detectError = err instanceof Error ? err.message : "detect command failed";
  }

  return status;
}

/**
 * Check all registered tools and return their statuses.
 */
export async function checkAllTools(pluginDir?: string): Promise<ToolStatus[]> {
  const registry = getToolRegistry(pluginDir);
  const pluginNames = new Set(loadPlugins(pluginDir).map((p) => p.name));

  const results = await Promise.all(
    registry.map((tool) =>
      checkTool(tool, pluginNames.has(tool.name) ? "plugin" : "builtin"),
    ),
  );

  return results;
}

/**
 * Return the tool that currently provides a given port name.
 * If a user plugin overrides a built-in port, the plugin is returned.
 */
export function getActiveAdapter(portName: string, pluginDir?: string): ToolDefinition | undefined {
  const registry = getToolRegistry(pluginDir);
  // Walk in reverse so plugins (appended last) win
  for (let i = registry.length - 1; i >= 0; i--) {
    if (registry[i].provides === portName) return registry[i];
  }
  return undefined;
}
