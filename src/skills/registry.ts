import { BUILTIN_SKILLS, BUILTIN_SKILL_NAMES, type BuiltinSkillName } from './registry.generated.ts';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { parseFrontmatter } from '../utils/frontmatter.ts';

export { BUILTIN_SKILLS, BUILTIN_SKILL_NAMES, type BuiltinSkillName };

export type SkillSource = 'builtin' | 'maestro' | 'claude';

export interface SkillEntry {
  name: string;
  description: string;
  source: SkillSource;
}

/** Directories to scan for internal (project-local) skills, in priority order. */
const INTERNAL_SOURCES: Array<{ dir: string; source: SkillSource }> = [
  { dir: '.maestro/skills', source: 'maestro' },
  { dir: '.claude/skills', source: 'claude' },
];

interface InternalSkill {
  slug: string;
  description: string;
  content: string;
  source: SkillSource;
}

/**
 * Discover internal skills from project-local directories.
 * Expects the same layout as builtin: <dir>/<slug>/SKILL.md with name+description frontmatter.
 */
async function discoverInternal(projectRoot: string): Promise<InternalSkill[]> {
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

      results.push({ slug, description: fm.description, content: raw, source });
    }
  }

  return results;
}

export async function loadSkill(name: string, basePath?: string): Promise<{ content: string } | { error: string }> {
  // Check builtin first -- content is embedded at build time, no file I/O needed
  const builtin = BUILTIN_SKILLS[name as BuiltinSkillName];
  if (builtin) {
    return { content: builtin.content };
  }

  // Check internal sources (runtime discovery)
  const projectRoot = basePath || process.cwd();
  const internals = await discoverInternal(projectRoot);
  const match = internals.find((s) => s.slug === name);
  if (match) {
    return { content: match.content };
  }

  // Collect all available names for the error message
  const allNames = [
    ...BUILTIN_SKILL_NAMES,
    ...internals.map((s) => s.slug),
  ];
  return { error: `Unknown skill: ${name}. Available: ${allNames.join(', ')}` };
}

export async function listSkills(basePath?: string): Promise<Array<SkillEntry>> {
  const projectRoot = basePath || process.cwd();
  const seen = new Set<string>();

  // Builtin skills first
  const results: SkillEntry[] = BUILTIN_SKILL_NAMES.map((name) => {
    seen.add(name);
    return { name, description: BUILTIN_SKILLS[name].description, source: 'builtin' as const };
  });

  // Internal skills (skip if name collides with builtin)
  const internals = await discoverInternal(projectRoot);
  for (const s of internals) {
    if (seen.has(s.slug)) continue;
    seen.add(s.slug);
    results.push({ name: s.slug, description: s.description, source: s.source });
  }

  return results;
}
