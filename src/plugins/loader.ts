/**
 * Plugin loader -- discovers TOOL.md files from ~/.config/maestro/tools/.
 *
 * Each subdirectory may contain a TOOL.md whose YAML frontmatter (between
 * `---` markers) defines a ToolDefinition.
 */

import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import type { ToolDefinition } from "./types";

const TOOLS_DIR = join(homedir(), ".config", "maestro", "tools");

/**
 * Parse YAML frontmatter from a TOOL.md string.
 * Handles the subset of YAML we need: simple `key: value` pairs.
 * Returns null if no valid frontmatter is found.
 */
export function parseFrontmatter(content: string): Record<string, string> | null {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;

  const body = match[1];
  const result: Record<string, string> = {};

  for (const line of body.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const colonIdx = trimmed.indexOf(":");
    if (colonIdx < 1) continue;

    const key = trimmed.slice(0, colonIdx).trim();
    let value = trimmed.slice(colonIdx + 1).trim();
    // Strip surrounding quotes
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }

  return Object.keys(result).length > 0 ? result : null;
}

/**
 * Convert parsed frontmatter into a ToolDefinition.
 * Returns null if required fields (name, binary) are missing.
 */
function toToolDefinition(fm: Record<string, string>): ToolDefinition | null {
  if (!fm.name || !fm.binary) return null;
  const def: ToolDefinition = {
    name: fm.name,
    binary: fm.binary,
  };
  if (fm.detect) def.detect = fm.detect;
  if (fm.install) def.install = fm.install;
  if (fm.provides) def.provides = fm.provides;
  if (fm.description) def.description = fm.description;
  return def;
}

/**
 * Load all plugin ToolDefinitions from the tools directory.
 * Returns empty array if the directory doesn't exist or has no valid plugins.
 */
export function loadPlugins(toolsDir: string = TOOLS_DIR): ToolDefinition[] {
  let entries: string[];
  try {
    entries = readdirSync(toolsDir);
  } catch {
    // Directory doesn't exist -- that's fine
    return [];
  }

  const tools: ToolDefinition[] = [];

  for (const entry of entries) {
    const entryPath = join(toolsDir, entry);
    try {
      if (!statSync(entryPath).isDirectory()) continue;
    } catch {
      continue;
    }

    const toolMdPath = join(entryPath, "TOOL.md");
    let content: string;
    try {
      content = readFileSync(toolMdPath, "utf-8");
    } catch {
      continue; // No TOOL.md in this subdirectory
    }

    const fm = parseFrontmatter(content);
    if (!fm) continue;

    const def = toToolDefinition(fm);
    if (def) tools.push(def);
  }

  return tools;
}
