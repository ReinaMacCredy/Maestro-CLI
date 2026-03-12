import { BUILTIN_SKILLS, BUILTIN_SKILL_NAMES, type BuiltinSkillName } from './registry.generated.ts';
import { readFile } from 'fs/promises';
import { join } from 'path';

export { BUILTIN_SKILLS, BUILTIN_SKILL_NAMES, type BuiltinSkillName };

export async function loadSkill(name: string, basePath?: string): Promise<{ content: string } | { error: string }> {
  const skill = BUILTIN_SKILLS[name as BuiltinSkillName];
  if (!skill) {
    return { error: `Unknown skill: ${name}. Available: ${BUILTIN_SKILL_NAMES.join(', ')}` };
  }
  try {
    // basePath defaults to the project root (2 levels up from src/skills/)
    const root = basePath || join(import.meta.dir, '..', '..');
    const content = await readFile(join(root, skill.path), 'utf-8');
    return { content };
  } catch {
    return { error: `Failed to read skill file: ${skill.path}` };
  }
}

export function listSkills(): Array<{ name: string; description: string }> {
  return BUILTIN_SKILL_NAMES.map((name) => ({
    name,
    description: BUILTIN_SKILLS[name].description,
  }));
}
