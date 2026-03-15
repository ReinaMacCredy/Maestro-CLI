import { describe, test, expect } from 'bun:test';
import { collectCodexSkills } from '../../symphony/renderers/codex-skills.ts';
import { renderWorkflowMd } from '../../symphony/renderers/workflow.ts';

describe('collectCodexSkills', () => {
  test('finds all 6 skill directories', () => {
    const files = collectCodexSkills();
    const skillNames = new Set(files.map(f => f.path.split('/')[2])); // .codex/skills/<name>/...
    expect(skillNames.has('commit')).toBe(true);
    expect(skillNames.has('debug')).toBe(true);
    expect(skillNames.has('land')).toBe(true);
    expect(skillNames.has('linear')).toBe(true);
    expect(skillNames.has('pull')).toBe(true);
    expect(skillNames.has('push')).toBe(true);
  });

  test('all files have content', () => {
    const files = collectCodexSkills();
    for (const f of files) {
      expect(f.content.length).toBeGreaterThan(0);
    }
  });

  test('land skill includes land_watch.py', () => {
    const files = collectCodexSkills();
    const landPy = files.find(f => f.path.includes('land_watch.py'));
    expect(landPy).toBeDefined();
    expect(landPy!.path).toBe('.codex/skills/land/land_watch.py');
  });

  test('all paths start with .codex/skills/', () => {
    const files = collectCodexSkills();
    for (const f of files) {
      expect(f.path.startsWith('.codex/skills/')).toBe(true);
    }
  });
});

describe('renderWorkflowMd', () => {
  test('replaces build-time placeholders', () => {
    const result = renderWorkflowMd({
      projectName: 'my-app',
      repoUrl: 'git@github.com:org/my-app.git',
      linearProjectSlug: 'MY-APP',
      primaryBranch: 'main',
    });

    expect(result.path).toBe('WORKFLOW.md');
    expect(result.content).toContain('MY-APP');
    expect(result.content).toContain('git@github.com:org/my-app.git');
    expect(result.content).not.toContain('{{PROJECT_SLUG}}');
    expect(result.content).not.toContain('{{REPO_CLONE_URL}}');
  });

  test('preserves runtime Jinja2 templates', () => {
    const result = renderWorkflowMd({
      projectName: 'test',
      primaryBranch: 'main',
    });

    expect(result.content).toContain('{{ issue.identifier }}');
    expect(result.content).toContain('{{ issue.title }}');
    expect(result.content).toContain('{{ issue.state }}');
  });

  test('handles missing optional values gracefully', () => {
    const result = renderWorkflowMd({
      projectName: 'test',
      primaryBranch: 'main',
    });

    // Should not contain 'undefined'
    expect(result.content).not.toContain('undefined');
  });
});
