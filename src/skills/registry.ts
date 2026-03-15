import { BUILTIN_SKILLS, BUILTIN_SKILL_NAMES, type BuiltinSkillName } from './registry.generated.ts';
import { SKILL_ALIASES } from './aliases.ts';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { parseFrontmatter } from '../utils/frontmatter.ts';

export { BUILTIN_SKILLS, BUILTIN_SKILL_NAMES, type BuiltinSkillName };

export type SkillSource = 'builtin' | 'internal' | 'maestro' | 'claude';

export interface SkillEntry {
  name: string;
  description: string;
  source: SkillSource;
  argumentHint?: string;
}

/** Directories to scan for internal skills, in priority order. */
const INTERNAL_SOURCES: Array<{ dir: string; source: SkillSource }> = [
  { dir: 'skills/internal', source: 'internal' },
  { dir: '.maestro/skills', source: 'maestro' },
  { dir: '.claude/skills', source: 'claude' },
];

interface InternalSkill {
  slug: string;
  description: string;
  content: string;
  source: SkillSource;
  dirPath: string;
  argumentHint?: string;
}

/** Resolve old skill name to canonical name. Returns { resolved, wasAliased }. */
function resolveAlias(name: string): { resolved: string; wasAliased: boolean } {
  const alias = SKILL_ALIASES[name];
  if (alias) {
    return { resolved: alias, wasAliased: true };
  }
  return { resolved: name, wasAliased: false };
}

/** Per-projectRoot cache -- skills don't change mid-session. */
const _internalCache = new Map<string, InternalSkill[]>();

/**
 * Discover internal skills from repository-local and project-local directories.
 * Expects the same layout as builtin: <dir>/<slug>/SKILL.md with name+description frontmatter.
 * Results are cached per projectRoot for the process lifetime.
 */
async function discoverInternal(projectRoot: string): Promise<InternalSkill[]> {
  const cached = _internalCache.get(projectRoot);
  if (cached) return cached;
  const results: InternalSkill[] = [];

  for (const { dir, source } of INTERNAL_SOURCES) {
    const base = join(projectRoot, dir);
    let entries;
    try {
      entries = await readdir(base, { withFileTypes: true });
    } catch {
      continue; // directory doesn't exist -- skip
    }

    const dirs = entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();

    for (const slug of dirs) {
      const mdPath = join(base, slug, 'SKILL.md');
      let raw: string;
      try {
        raw = await readFile(mdPath, 'utf-8');
      } catch {
        continue;
      }

      const fm = parseFrontmatter(raw);
      if (!fm?.name || !fm?.description) continue;

      const skillDirPath = join(base, slug);
      results.push({
        slug,
        description: fm.description,
        content: raw,
        source,
        dirPath: skillDirPath,
        argumentHint: fm['argument-hint'],
      });
    }
  }

  _internalCache.set(projectRoot, results);
  return results;
}

export async function loadSkill(name: string, basePath?: string): Promise<{ content: string } | { error: string }> {
  const projectRoot = basePath || process.cwd();
  const internals = await discoverInternal(projectRoot);

  // Check internal sources first (original name) -- internal overrides take priority over aliases.
  const directMatch = internals.find((s) => s.slug === name);
  if (directMatch) {
    return { content: directMatch.content };
  }

  // Resolve aliases with deprecation warning.
  const { resolved: resolvedName, wasAliased } = resolveAlias(name);
  if (wasAliased) {
    console.error(`[maestro] Skill '${name}' has been renamed to '${resolvedName}'. Please update your references.`);

    // Check internals again with resolved name (in case internal uses new name).
    const aliasMatch = internals.find((s) => s.slug === resolvedName);
    if (aliasMatch) {
      return { content: aliasMatch.content };
    }
  }

  // Fall back to builtin -- content is embedded at build time, no file I/O needed.
  const builtin = BUILTIN_SKILLS[resolvedName as BuiltinSkillName];
  if (builtin) {
    return { content: builtin.content };
  }

  // Collect all available names for the error message
  const allNames = [
    ...BUILTIN_SKILL_NAMES,
    ...internals.map((s) => s.slug),
  ];
  return { error: `Unknown skill: ${resolvedName}. Available: ${allNames.join(', ')}` };
}

/**
 * Load a specific reference file from a skill's reference/ directory.
 * Works for both built-in (embedded) and internal (filesystem) skills.
 */
export async function loadSkillReference(
  name: string,
  refPath: string,
  basePath?: string,
): Promise<{ content: string } | { error: string }> {
  const projectRoot = basePath || process.cwd();
  const internals = await discoverInternal(projectRoot);

  // Check internal sources first with original name -- internal overrides take priority over aliases.
  const { resolved: resolvedName, wasAliased } = resolveAlias(name);
  const match = internals.find((s) => s.slug === name) ??
    (wasAliased ? internals.find((s) => s.slug === resolvedName) : undefined);
  if (match) {
    const refFilePath = join(match.dirPath, 'reference', refPath);
    try {
      const content = await readFile(refFilePath, 'utf-8');
      return { content };
    } catch {
      return { error: `Reference file '${refPath}' not found in skill '${match.slug}'` };
    }
  }

  // Check builtins -- references are embedded at build time.
  const builtin = BUILTIN_SKILLS[resolvedName as BuiltinSkillName];
  if (builtin) {
    if (builtin.references?.[refPath]) {
      return { content: builtin.references[refPath] };
    }
    const available = builtin.references ? Object.keys(builtin.references) : [];
    if (available.length > 0) {
      return { error: `Reference file '${refPath}' not found in skill '${resolvedName}'. Available: ${available.join(', ')}` };
    }
    return { error: `Skill '${resolvedName}' has no reference files` };
  }

  return { error: `Unknown skill: ${resolvedName}` };
}

export async function listSkills(basePath?: string): Promise<Array<SkillEntry>> {
  const projectRoot = basePath || process.cwd();
  const seen = new Set<string>();
  const results: SkillEntry[] = [];

  // Internal skills first so repo-local overrides replace builtin entries in the listing.
  const internals = await discoverInternal(projectRoot);
  for (const s of internals) {
    if (seen.has(s.slug)) {
      continue;
    }
    seen.add(s.slug);
    results.push({ name: s.slug, description: s.description, source: s.source, argumentHint: s.argumentHint });
  }

  // Builtins last; skip any names already provided by internal sources.
  for (const name of BUILTIN_SKILL_NAMES) {
    if (seen.has(name)) {
      continue;
    }
    seen.add(name);
    const { description, argumentHint } = BUILTIN_SKILLS[name];
    results.push({ name, description, source: 'builtin', argumentHint });
  }

  return results;
}
