import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { listSkills, loadSkill } from '../../skills/registry.ts';

describe('skills registry', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'maestro-skills-'));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test('loads repo-internal skills from skills/internal', async () => {
    const skillDir = join(tmpDir, 'skills', 'internal', 'demo-skill');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(
      join(skillDir, 'SKILL.md'),
      [
        '---',
        'name: demo-skill',
        'description: Demo internal skill',
        '---',
        '',
        '# Demo',
      ].join('\n'),
    );

    const result = await loadSkill('demo-skill', tmpDir);

    expect(result).toEqual({
      content: ['---', 'name: demo-skill', 'description: Demo internal skill', '---', '', '# Demo'].join('\n'),
    });
  });

  test('repo-internal skills override builtins with the same name', async () => {
    const skillDir = join(tmpDir, 'skills', 'internal', 'prompt-leverage');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(
      join(skillDir, 'SKILL.md'),
      [
        '---',
        'name: prompt-leverage',
        'description: Internal override',
        '---',
        '',
        '# Internal prompt leverage',
      ].join('\n'),
    );

    const result = await loadSkill('prompt-leverage', tmpDir);

    expect(result).toEqual({
      content: ['---', 'name: prompt-leverage', 'description: Internal override', '---', '', '# Internal prompt leverage'].join('\n'),
    });
  });

  test('listSkills prefers the internal source when names collide', async () => {
    const skillDir = join(tmpDir, 'skills', 'internal', 'prompt-leverage');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(
      join(skillDir, 'SKILL.md'),
      [
        '---',
        'name: prompt-leverage',
        'description: Internal override',
        '---',
        '',
        '# Internal prompt leverage',
      ].join('\n'),
    );

    const skills = await listSkills(tmpDir);
    const promptLeverage = skills.find((skill) => skill.name === 'prompt-leverage');

    expect(promptLeverage).toEqual({
      name: 'prompt-leverage',
      description: 'Internal override',
      source: 'internal',
    });
  });
});
