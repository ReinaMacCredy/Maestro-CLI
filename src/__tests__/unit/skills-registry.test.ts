import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { listSkills, loadSkill, loadSkillReference, BUILTIN_SKILL_NAMES } from '../../skills/registry.ts';
import { SKILL_ALIASES } from '../../skills/aliases.ts';

describe('skills registry', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'maestro-skills-'));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test('loads repo-external skills from skills/external', async () => {
    const skillDir = join(tmpDir, 'skills', 'external', 'demo-skill');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(
      join(skillDir, 'SKILL.md'),
      [
        '---',
        'name: demo-skill',
        'description: Demo external skill',
        '---',
        '',
        '# Demo',
      ].join('\n'),
    );

    const result = await loadSkill('demo-skill', tmpDir);

    expect(result).toEqual({
      content: ['---', 'name: demo-skill', 'description: Demo external skill', '---', '', '# Demo'].join('\n'),
    });
  });

  test('repo-external skills override builtins with the same name', async () => {
    const skillDir = join(tmpDir, 'skills', 'external', 'prompt-leverage');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(
      join(skillDir, 'SKILL.md'),
      [
        '---',
        'name: prompt-leverage',
        'description: External override',
        '---',
        '',
        '# External prompt leverage',
      ].join('\n'),
    );

    const result = await loadSkill('prompt-leverage', tmpDir);

    expect(result).toEqual({
      content: ['---', 'name: prompt-leverage', 'description: External override', '---', '', '# External prompt leverage'].join('\n'),
    });
  });

  test('listSkills prefers the external source when names collide', async () => {
    const skillDir = join(tmpDir, 'skills', 'external', 'prompt-leverage');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(
      join(skillDir, 'SKILL.md'),
      [
        '---',
        'name: prompt-leverage',
        'description: External override',
        '---',
        '',
        '# External prompt leverage',
      ].join('\n'),
    );

    const skills = await listSkills(tmpDir);
    const promptLeverage = skills.find((skill) => skill.name === 'prompt-leverage');

    expect(promptLeverage).toEqual({
      name: 'prompt-leverage',
      description: 'External override',
      source: 'external',
      argumentHint: undefined,
    });
  });

  test('SKILL_ALIASES contains all 12 mappings', () => {
    expect(Object.keys(SKILL_ALIASES)).toHaveLength(12);
    expect(SKILL_ALIASES['writing-plans']).toBe('maestro:design');
    expect(SKILL_ALIASES['executing-plans']).toBe('maestro:implement');
    expect(SKILL_ALIASES['code-reviewer']).toBe('maestro:review');
    expect(SKILL_ALIASES['agents-md-mastery']).toBe('maestro:agents-md');
    expect(SKILL_ALIASES['brainstorming']).toBe('maestro:brainstorming');
    expect(SKILL_ALIASES['dispatching-parallel-agents']).toBe('maestro:dispatching');
    expect(SKILL_ALIASES['docker-mastery']).toBe('maestro:docker');
    expect(SKILL_ALIASES['parallel-exploration']).toBe('maestro:parallel-exploration');
    expect(SKILL_ALIASES['prompt-leverage']).toBe('maestro:prompt-leverage');
    expect(SKILL_ALIASES['systematic-debugging']).toBe('maestro:debugging');
    expect(SKILL_ALIASES['test-driven-development']).toBe('maestro:tdd');
    expect(SKILL_ALIASES['verification-before-completion']).toBe('maestro:verification');
  });

  test('loadSkillReference loads from external skill filesystem', async () => {
    const skillDir = join(tmpDir, 'skills', 'external', 'my-skill');
    const refDir = join(skillDir, 'reference');
    mkdirSync(refDir, { recursive: true });
    writeFileSync(
      join(skillDir, 'SKILL.md'),
      ['---', 'name: my-skill', 'description: Test skill', '---', '', '# My Skill'].join('\n'),
    );
    writeFileSync(join(refDir, 'guide.md'), '# Reference Guide');

    const result = await loadSkillReference('my-skill', 'guide.md', tmpDir);
    expect(result).toEqual({ content: '# Reference Guide' });
  });

  test('loadSkillReference returns error for missing reference', async () => {
    const skillDir = join(tmpDir, 'skills', 'external', 'my-skill');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(
      join(skillDir, 'SKILL.md'),
      ['---', 'name: my-skill', 'description: Test skill', '---', '', '# My Skill'].join('\n'),
    );

    const result = await loadSkillReference('my-skill', 'nonexistent.md', tmpDir);
    expect(result).toHaveProperty('error');
  });

  test('all 19 built-in skills load without error', async () => {
    expect(BUILTIN_SKILL_NAMES).toHaveLength(19);
    for (const name of BUILTIN_SKILL_NAMES) {
      const result = await loadSkill(name, tmpDir);
      expect(result).toHaveProperty('content');
    }
  });

  test('all built-in skill names use colon prefix', () => {
    for (const name of BUILTIN_SKILL_NAMES) {
      expect(name).toMatch(/^maestro:/);
    }
  });

  test('loadSkill resolves alias to new name', async () => {
    const result = await loadSkill('writing-plans', tmpDir);
    expect(result).toHaveProperty('content');
  });

  test('loadSkillReference loads embedded reference from built-in skill', async () => {
    const result = await loadSkillReference('maestro:design', 'steps/step-01-init.md', tmpDir);
    expect(result).toHaveProperty('content');
    expect((result as { content: string }).content).toContain('Step 1');
  });

  test('loadSkillReference returns error for skill with no references', async () => {
    const result = await loadSkillReference('maestro:docker', 'nonexistent.md', tmpDir);
    expect(result).toHaveProperty('error');
    expect((result as { error: string }).error).toContain('no reference files');
  });

  test('external skill with colon name overrides built-in', async () => {
    const skillDir = join(tmpDir, 'skills', 'external', 'maestro:brainstorming');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(
      join(skillDir, 'SKILL.md'),
      ['---', 'name: maestro:brainstorming', 'description: Custom brainstorming', '---', '', '# Custom'].join('\n'),
    );

    const result = await loadSkill('maestro:brainstorming', tmpDir);
    expect((result as { content: string }).content).toContain('# Custom');
  });

  test('listSkills includes argumentHint from frontmatter', async () => {
    const skillDir = join(tmpDir, 'skills', 'external', 'hinted-skill');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(
      join(skillDir, 'SKILL.md'),
      ['---', 'name: hinted-skill', 'description: Skill with hint', 'argument-hint: <track-id>', '---', '', '# Hinted'].join('\n'),
    );

    const skills = await listSkills(tmpDir);
    const hinted = skills.find((s) => s.name === 'hinted-skill');
    expect(hinted?.argumentHint).toBe('<track-id>');
  });
});
